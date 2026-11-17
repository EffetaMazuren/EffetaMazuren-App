import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { verificarLider } from '@/lib/auth-lider'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    if (!id) {
      return NextResponse.json({ error: 'ID requerido' }, { status: 400 })
    }

    // Obtener nombre del caminante ANTES de borrarlo (lo necesitamos para limpiar los Sheets)
    const { data: caminante } = await supabase
      .from('caminantes')
      .select('nombre')
      .eq('id', id)
      .single()

    // Borrar en cascada las tablas relacionadas en Supabase
    await supabase.from('asignaciones_mesa').delete().eq('persona_id', id)
    await supabase.from('asignaciones_habitacion').delete().eq('caminante_id', id)
    await supabase.from('asistencias').delete().eq('persona_id', id)
    await supabase.from('contactos_emergencia').delete().eq('persona_id', id)
    await supabase.from('transacciones').delete().eq('persona_id', id)
    await supabase.from('seguimiento_caminantes').delete().eq('caminante_id', id)

    // Palancas se referencia por NOMBRE, no por id
    if (caminante?.nombre) {
      await supabase
        .from('palancas_seguimiento')
        .delete()
        .ilike('caminante_nombre', caminante.nombre)
    }

    // Pagos: NO se borra, se marca como retirado (conserva historial contable)
    await supabase
      .from('pagos')
      .update({ retirado: true, fecha_retiro: new Date().toISOString() })
      .eq('persona_id', id)

    // Borrar el caminante
    const { error } = await supabase.from('caminantes').delete().eq('id', id)
    if (error) {
      return NextResponse.json({ error: 'Error al eliminar' }, { status: 500 })
    }

    // Limpiar filas en los Google Sheets (Palancas y Camisetas) vía Apps Script
    if (caminante?.nombre) {
      const webhookUrl = process.env.NEXT_PUBLIC_APPS_SCRIPT_PALANCAS_URL
      if (webhookUrl) {
        try {
          await fetch(webhookUrl, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              type: 'eliminar_caminante',
              caminante_nombre: caminante.nombre,
            }),
          })
        } catch (err) {
          // No bloqueamos el borrado si falla la limpieza de Sheets
          console.error('Error limpiando sheets:', err)
        }
      }
    }

    return NextResponse.json({ success: true })
  } catch (error) {
    return NextResponse.json({ error: 'Error interno' }, { status: 500 })
  }
}

// ── Editar los datos de un caminante (solo líderes) ──────────────────────────
// Body: { datos: {...campos de caminantes}, contactos?: [{nombre, parentesco, celular}] }
// Si cambia el nombre, también se actualiza donde se guarda por nombre
// (palancas_seguimiento y asignaciones_habitacion).
const CAMPOS_TEXTO = [
  'tipo_documento', 'numero_documento', 'celular', 'correo', 'direccion', 'barrio',
  'telefono_fijo', 'talla_camiseta', 'eps', 'alergias', 'restricciones_alimentarias', 'medicamentos',
] as const

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const liderId = await verificarLider(request, supabase)
    if (!liderId) {
      return NextResponse.json({ error: 'Solo los líderes pueden editar caminantes. Vuelve a iniciar sesión.' }, { status: 401 })
    }

    const { id } = await params
    const body = await request.json()
    const datos = body?.datos ?? {}

    const { data: actual } = await supabase.from('caminantes').select('id, nombre, retiro_id').eq('id', id).maybeSingle()
    if (!actual) return NextResponse.json({ error: 'El caminante no existe.' }, { status: 404 })

    const nombre = String(datos.nombre ?? '').replace(/\s+/g, ' ').trim()
    if (!nombre) return NextResponse.json({ error: 'El nombre es obligatorio.' }, { status: 400 })

    const cambios: Record<string, unknown> = { nombre }
    for (const campo of CAMPOS_TEXTO) {
      if (!(campo in datos)) continue
      let v = String(datos[campo] ?? '').trim()
      if (campo === 'numero_documento') v = v.replace(/\./g, '')
      if (campo === 'correo') v = v.toLowerCase()
      cambios[campo] = v || null
    }
    if ('fecha_nacimiento' in datos) {
      const f = String(datos.fecha_nacimiento ?? '').trim()
      if (f && !/^\d{4}-\d{2}-\d{2}$/.test(f)) return NextResponse.json({ error: 'La fecha de nacimiento no es válida.' }, { status: 400 })
      cambios.fecha_nacimiento = f || null
    }
    if ('edad' in datos) {
      const e = datos.edad === '' || datos.edad === null ? null : Number(datos.edad)
      if (e !== null && (!Number.isInteger(e) || e < 0 || e > 120)) return NextResponse.json({ error: 'La edad no es válida.' }, { status: 400 })
      cambios.edad = e
    }
    if ('sacramentos' in datos) {
      const lista = Array.isArray(datos.sacramentos) ? datos.sacramentos.map((x: unknown) => String(x).trim()).filter(Boolean) : []
      // Columna ARRAY: vacío va como null, nunca []
      cambios.sacramentos = lista.length > 0 ? lista : null
    }

    const { error } = await supabase.from('caminantes').update(cambios).eq('id', id)
    if (error) return NextResponse.json({ error: error.message }, { status: 500 })

    // Nombre: actualizar donde se referencia por texto
    if (nombre !== actual.nombre) {
      await supabase.from('palancas_seguimiento').update({ caminante_nombre: nombre })
        .eq('retiro_id', actual.retiro_id).ilike('caminante_nombre', actual.nombre)
      await supabase.from('asignaciones_habitacion').update({ nombre })
        .eq('persona_id', id).eq('tipo_persona', 'caminante')
    }

    // Contactos de emergencia: se reemplazan por los que llegan (máx. 2)
    if (Array.isArray(body?.contactos)) {
      const contactos = body.contactos
        .map((c: any) => ({ nombre: String(c?.nombre ?? '').trim(), parentesco: String(c?.parentesco ?? '').trim(), celular: String(c?.celular ?? '').trim() }))
        .filter((c: { nombre: string }) => c.nombre)
        .slice(0, 2)
      const { data: previos } = await supabase.from('contactos_emergencia').select('persona_id, tipo_persona, nombre, parentesco, celular, orden').eq('persona_id', id)
      const { error: e1 } = await supabase.from('contactos_emergencia').delete().eq('persona_id', id)
      if (e1) return NextResponse.json({ error: 'Datos guardados, pero no se pudieron actualizar los contactos: ' + e1.message }, { status: 500 })
      if (contactos.length > 0) {
        const { error: e2 } = await supabase.from('contactos_emergencia').insert(
          contactos.map((c: { nombre: string; parentesco: string; celular: string }, i: number) => ({ ...c, persona_id: id, tipo_persona: 'caminante', orden: i + 1 }))
        )
        if (e2) {
          if (previos && previos.length > 0) await supabase.from('contactos_emergencia').insert(previos)
          return NextResponse.json({ error: 'Datos guardados, pero no se pudieron guardar los contactos (se dejaron los anteriores): ' + e2.message }, { status: 500 })
        }
      }
    }

    return NextResponse.json({ success: true })
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : 'Error interno' }, { status: 500 })
  }
}
