import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { verificarLider } from '@/lib/auth-lider'
import { ASUNTO_CUPOS_LLENOS_DEFECTO, TEXTO_CUPOS_LLENOS_DEFECTO, personalizar } from '@/lib/cupos-llenos'

// Correo de "cupos llenos" para el retiro ACTIVO.
//   GET   → texto actual, a quién le llegaría y estado de los envíos.
//   PATCH → guarda el asunto/texto de este retiro.
//   POST  → (requiere confirmacion: 'ENVIAR') pone en cola los correos.
//           El Apps Script de correos los envía cada 15 minutos.
//
// Destinatarios: caminantes del retiro activo SIN ningún pago (ni abono,
// ni comprobante pendiente), que no sean sorpresa y que tengan correo, y
// a quienes todavía no se les haya enviado.
//
// Corre con service_role (la tabla de envíos no es accesible desde el
// navegador), por eso exige que quien llama sea líder.

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

type Cam = { id: string; nombre: string; correo: string | null; es_sorpresa: boolean | null }

function correoValido(c: string | null): boolean {
  const v = (c || '').trim()
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v)
}

async function cargarTodo() {
  const { data: retiro, error: errRetiro } = await supabase
    .from('retiros')
    .select('id, nombre, cupos_llenos_asunto, cupos_llenos_texto')
    .eq('estado', 'activo')
    .maybeSingle()
  if (errRetiro) throw new Error(errRetiro.message)
  if (!retiro) return null

  const [{ data: cams, error: e1 }, { data: pagos, error: e2 }, { data: envios, error: e3 }] = await Promise.all([
    supabase.from('caminantes').select('id, nombre, correo, es_sorpresa').eq('retiro_id', retiro.id).range(0, 4999),
    supabase.from('pagos').select('persona_id, retirado').eq('retiro_id', retiro.id).eq('tipo_persona', 'caminante').range(0, 9999),
    supabase.from('correos_cupos_llenos').select('caminante_id, nombre, correo, estado, error, enviado_at').eq('retiro_id', retiro.id).range(0, 4999),
  ])
  if (e1) throw new Error(e1.message)
  if (e2) throw new Error(e2.message)
  if (e3) throw new Error(e3.message)

  // Cualquier pago no retirado cuenta (confirmado, pendiente de revisar, etc.)
  const conPago = new Set((pagos || []).filter(p => !p.retirado).map(p => p.persona_id))
  const estadoEnvio = new Map((envios || []).map(e => [e.caminante_id, e.estado as string]))

  const sinPago = ((cams || []) as Cam[]).filter(c => !conPago.has(c.id))
  const sorpresas = sinPago.filter(c => c.es_sorpresa)
  const normales = sinPago.filter(c => !c.es_sorpresa)
  const sinCorreo = normales.filter(c => !correoValido(c.correo))
  const destinatarios = normales
    .filter(c => correoValido(c.correo))
    .filter(c => { const e = estadoEnvio.get(c.id); return !e || e === 'error' })
    .sort((a, b) => a.nombre.localeCompare(b.nombre, 'es'))

  return {
    retiro,
    asunto: retiro.cupos_llenos_asunto || ASUNTO_CUPOS_LLENOS_DEFECTO,
    texto: retiro.cupos_llenos_texto || TEXTO_CUPOS_LLENOS_DEFECTO,
    destinatarios,
    sorpresas,
    sinCorreo,
    envios: envios || [],
  }
}

async function exigirLider(req: NextRequest) {
  const liderId = await verificarLider(req, supabase)
  if (!liderId) {
    return { liderId: null, resp: NextResponse.json({ error: 'Solo los líderes pueden hacer esto. Vuelve a iniciar sesión.' }, { status: 401 }) }
  }
  return { liderId, resp: null }
}

export async function GET(req: NextRequest) {
  try {
    const { resp } = await exigirLider(req)
    if (resp) return resp

    const d = await cargarTodo()
    if (!d) return NextResponse.json({ error: 'No hay un retiro activo.' }, { status: 400 })

    const cuenta = (estado: string) => d.envios.filter(e => e.estado === estado).length
    return NextResponse.json({
      success: true,
      retiro: { id: d.retiro.id, nombre: d.retiro.nombre },
      asunto: d.asunto,
      texto: d.texto,
      textoPorDefecto: TEXTO_CUPOS_LLENOS_DEFECTO,
      asuntoPorDefecto: ASUNTO_CUPOS_LLENOS_DEFECTO,
      destinatarios: d.destinatarios.map(c => ({ id: c.id, nombre: c.nombre.trim(), correo: (c.correo || '').trim() })),
      sorpresas: d.sorpresas.map(c => ({ id: c.id, nombre: c.nombre.trim() })),
      sinCorreo: d.sinCorreo.map(c => ({ id: c.id, nombre: c.nombre.trim() })),
      envios: {
        pendientes: cuenta('pendiente'),
        enviados: cuenta('enviado'),
        cancelados: cuenta('cancelado'),
        errores: d.envios.filter(e => e.estado === 'error').map(e => ({ nombre: e.nombre, correo: e.correo, error: e.error })),
      },
    })
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : 'Error interno' }, { status: 500 })
  }
}

export async function PATCH(req: NextRequest) {
  try {
    const { resp } = await exigirLider(req)
    if (resp) return resp

    const body = await req.json()
    const asunto = String(body?.asunto ?? '').trim()
    const texto = String(body?.texto ?? '').trim()
    if (!asunto || !texto) {
      return NextResponse.json({ error: 'El asunto y el texto no pueden quedar vacíos.' }, { status: 400 })
    }
    if (asunto.length > 200 || texto.length > 5000) {
      return NextResponse.json({ error: 'El texto es demasiado largo.' }, { status: 400 })
    }

    const { data: retiro } = await supabase.from('retiros').select('id').eq('estado', 'activo').maybeSingle()
    if (!retiro) return NextResponse.json({ error: 'No hay un retiro activo.' }, { status: 400 })

    const { error } = await supabase
      .from('retiros')
      .update({ cupos_llenos_asunto: asunto, cupos_llenos_texto: texto })
      .eq('id', retiro.id)
    if (error) return NextResponse.json({ error: error.message }, { status: 500 })

    return NextResponse.json({ success: true })
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : 'Error interno' }, { status: 500 })
  }
}

export async function POST(req: NextRequest) {
  try {
    const { liderId, resp } = await exigirLider(req)
    if (resp) return resp

    const body = await req.json()
    if (String(body?.confirmacion || '').trim().toUpperCase() !== 'ENVIAR') {
      return NextResponse.json({ error: 'Falta la confirmación: escribe ENVIAR.' }, { status: 400 })
    }

    const d = await cargarTodo()
    if (!d) return NextResponse.json({ error: 'No hay un retiro activo.' }, { status: 400 })
    if (d.destinatarios.length === 0) {
      return NextResponse.json({ error: 'No hay nadie nuevo a quien enviarle este correo.' }, { status: 400 })
    }

    // Seguridad extra: solo se envía a quienes el líder vio en pantalla.
    const vistos: string[] | null = Array.isArray(body?.ids) ? body.ids.map(String) : null
    const lista = vistos ? d.destinatarios.filter(c => vistos.includes(c.id)) : d.destinatarios

    const filas = lista.map(c => ({
      retiro_id: d.retiro.id,
      caminante_id: c.id,
      nombre: c.nombre.trim(),
      correo: (c.correo || '').trim(),
      asunto: personalizar(d.asunto, c.nombre, d.retiro.nombre),
      cuerpo: personalizar(d.texto, c.nombre, d.retiro.nombre),
      estado: 'pendiente',
      error: null,
      creado_por: liderId,
      creado_at: new Date().toISOString(),
    }))

    const { error } = await supabase
      .from('correos_cupos_llenos')
      .upsert(filas, { onConflict: 'retiro_id,caminante_id' })
    if (error) return NextResponse.json({ error: error.message }, { status: 500 })

    return NextResponse.json({ success: true, enCola: filas.length })
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : 'Error interno' }, { status: 500 })
  }
}
