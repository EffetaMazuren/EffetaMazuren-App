import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { verificarLider } from '@/lib/auth-lider'

// Roles del fin de semana (roles_retiro) del retiro ACTIVO.
//
//   POST  → sincroniza: reemplaza TODOS los roles del retiro activo por la
//           lista que manda el líder (carga masiva desde Excel/Sheets).
//   PATCH → prende/apaga retiros.roles_visibles (si los servidores los ven).
//
// Corre con service_role para no depender de que existan políticas RLS de
// DELETE/UPDATE en roles_retiro y retiros (sin ellas fallarían en silencio).
const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

type RolEntrada = { rol: string; categoria: string; encargados: string[] }

async function retiroActivoId(): Promise<string | null> {
  const { data } = await supabase.from('retiros').select('id').eq('estado', 'activo').maybeSingle()
  return data?.id ?? null
}

export async function POST(req: NextRequest) {
  try {
    const liderId = await verificarLider(req, supabase)
    if (!liderId) {
      return NextResponse.json({ error: 'Solo los líderes pueden cargar roles. Vuelve a iniciar sesión.' }, { status: 401 })
    }

    const body = await req.json()
    const entrada: RolEntrada[] = Array.isArray(body?.roles) ? body.roles : []

    const roles = entrada
      .map(r => ({
        rol: String(r?.rol ?? '').trim(),
        categoria: String(r?.categoria ?? '').trim() || 'General',
        encargados: (Array.isArray(r?.encargados) ? r.encargados : [])
          .map((e: unknown) => String(e ?? '').trim())
          .filter((e: string) => e.length > 0),
      }))
      .filter(r => r.rol.length > 0)

    if (roles.length === 0) {
      return NextResponse.json({ error: 'La lista no tiene ningún rol.' }, { status: 400 })
    }

    const retiroId = await retiroActivoId()
    if (!retiroId) {
      return NextResponse.json({ error: 'No hay un retiro activo.' }, { status: 400 })
    }

    // Copia de seguridad por si la inserción falla después de borrar
    const { data: anteriores, error: errLeer } = await supabase
      .from('roles_retiro')
      .select('retiro_id, categoria, rol, encargados, orden')
      .eq('retiro_id', retiroId)
    if (errLeer) {
      return NextResponse.json({ error: errLeer.message }, { status: 500 })
    }

    const { error: errBorrar } = await supabase.from('roles_retiro').delete().eq('retiro_id', retiroId)
    if (errBorrar) {
      return NextResponse.json({ error: errBorrar.message }, { status: 500 })
    }

    const filas = roles.map((r, i) => ({
      retiro_id: retiroId,
      categoria: r.categoria,
      rol: r.rol,
      encargados: r.encargados,
      orden: i + 1,
    }))

    const { error: errInsertar } = await supabase.from('roles_retiro').insert(filas)
    if (errInsertar) {
      if (anteriores && anteriores.length > 0) {
        await supabase.from('roles_retiro').insert(anteriores)
      }
      return NextResponse.json({ error: 'No se pudo guardar la lista (se dejaron los roles anteriores): ' + errInsertar.message }, { status: 500 })
    }

    return NextResponse.json({ success: true, total: filas.length })
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : 'Error interno' }, { status: 500 })
  }
}

export async function PATCH(req: NextRequest) {
  try {
    const liderId = await verificarLider(req, supabase)
    if (!liderId) {
      return NextResponse.json({ error: 'Solo los líderes pueden cambiar la visibilidad. Vuelve a iniciar sesión.' }, { status: 401 })
    }

    const body = await req.json()
    if (typeof body?.visibles !== 'boolean') {
      return NextResponse.json({ error: 'Datos inválidos' }, { status: 400 })
    }

    const retiroId = await retiroActivoId()
    if (!retiroId) {
      return NextResponse.json({ error: 'No hay un retiro activo.' }, { status: 400 })
    }

    const { error } = await supabase
      .from('retiros')
      .update({ roles_visibles: body.visibles })
      .eq('id', retiroId)

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    return NextResponse.json({ success: true, visibles: body.visibles })
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : 'Error interno' }, { status: 500 })
  }
}
