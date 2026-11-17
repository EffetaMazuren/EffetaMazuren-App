import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { verificarLider } from '@/lib/auth-lider'

// Estructura de logística del retiro ACTIVO: crear/eliminar mesas y
// crear/editar/eliminar/copiar habitaciones. Las asignaciones de personas
// (asignaciones_mesa, asignaciones_habitacion) se siguen haciendo desde el
// dashboard como hasta ahora.
//
// Corre con service_role: mesas y habitaciones no tienen garantizadas
// políticas RLS de INSERT/DELETE, y sin ellas fallarían en silencio.
const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

type CamposHab = { numero?: unknown; piso?: unknown; bloque?: unknown; tipo_cama?: unknown; capacidad?: unknown; solo_servidores?: unknown }

function limpiarHabitacion(h: CamposHab): { ok: true; datos: { numero: string; piso: number; bloque: string; tipo_cama: string; capacidad: number; solo_servidores: boolean } } | { ok: false; error: string } {
  const numero = String(h.numero ?? '').trim()
  const bloque = String(h.bloque ?? '').trim() || 'General'
  const tipo_cama = String(h.tipo_cama ?? '').trim()
  const piso = Number(h.piso)
  const capacidad = Number(h.capacidad)
  if (!numero) return { ok: false, error: 'El número de la habitación es obligatorio.' }
  if (!Number.isInteger(piso) || piso < 0 || piso > 20) return { ok: false, error: 'El piso no es válido.' }
  if (!Number.isInteger(capacidad) || capacidad < 1 || capacidad > 50) return { ok: false, error: 'La capacidad debe ser un número entre 1 y 50.' }
  return { ok: true, datos: { numero, piso, bloque, tipo_cama, capacidad, solo_servidores: h.solo_servidores === true } }
}

export async function POST(req: NextRequest) {
  try {
    const liderId = await verificarLider(req, supabase)
    if (!liderId) {
      return NextResponse.json({ error: 'Solo los líderes pueden hacer esto. Vuelve a iniciar sesión.' }, { status: 401 })
    }

    const { data: retiro } = await supabase.from('retiros').select('id').eq('estado', 'activo').maybeSingle()
    if (!retiro) return NextResponse.json({ error: 'No hay un retiro activo.' }, { status: 400 })
    const RETIRO_ID = retiro.id

    const body = await req.json()
    const accion = String(body?.accion ?? '')

    // ── MESAS ────────────────────────────────────────────────────────────
    if (accion === 'crear_mesas') {
      const cantidad = Number(body.cantidad)
      if (!Number.isInteger(cantidad) || cantidad < 1 || cantidad > 40) {
        return NextResponse.json({ error: 'La cantidad de mesas debe estar entre 1 y 40.' }, { status: 400 })
      }
      const { data: existentes } = await supabase.from('mesas').select('numero').eq('retiro_id', RETIRO_ID)
      const max = Math.max(0, ...(existentes ?? []).map((m: { numero: number }) => m.numero || 0))
      const filas = Array.from({ length: cantidad }, (_, i) => ({ retiro_id: RETIRO_ID, numero: max + i + 1, adulto: '', lider: '', colider: '' }))
      const { error } = await supabase.from('mesas').insert(filas)
      if (error) return NextResponse.json({ error: error.message }, { status: 500 })
      return NextResponse.json({ success: true, creadas: cantidad })
    }

    if (accion === 'eliminar_mesa') {
      const id = String(body.id ?? '')
      const { data: mesa } = await supabase.from('mesas').select('id').eq('id', id).eq('retiro_id', RETIRO_ID).maybeSingle()
      if (!mesa) return NextResponse.json({ error: 'La mesa no existe en el retiro actual.' }, { status: 404 })
      const { data: asigs } = await supabase.from('asignaciones_mesa').select('id').eq('mesa_id', id)
      const ids = (asigs ?? []).map((a: { id: string }) => a.id)
      if (ids.length > 0) {
        await supabase.from('seguimiento_caminantes').delete().in('asignacion_mesa_id', ids)
        const { error: e1 } = await supabase.from('asignaciones_mesa').delete().eq('mesa_id', id)
        if (e1) return NextResponse.json({ error: e1.message }, { status: 500 })
      }
      const { error } = await supabase.from('mesas').delete().eq('id', id)
      if (error) return NextResponse.json({ error: error.message }, { status: 500 })
      return NextResponse.json({ success: true, caminantesLiberados: ids.length })
    }

    // ── HABITACIONES ─────────────────────────────────────────────────────
    if (accion === 'crear_habitacion') {
      const r = limpiarHabitacion(body)
      if (!r.ok) return NextResponse.json({ error: r.error }, { status: 400 })
      const { error } = await supabase.from('habitaciones').insert({ ...r.datos, retiro_id: RETIRO_ID })
      if (error) return NextResponse.json({ error: error.message }, { status: 500 })
      return NextResponse.json({ success: true })
    }

    if (accion === 'editar_habitacion') {
      const id = String(body.id ?? '')
      const r = limpiarHabitacion(body)
      if (!r.ok) return NextResponse.json({ error: r.error }, { status: 400 })
      const { data: hab } = await supabase.from('habitaciones').select('id').eq('id', id).eq('retiro_id', RETIRO_ID).maybeSingle()
      if (!hab) return NextResponse.json({ error: 'La habitación no existe en el retiro actual.' }, { status: 404 })
      if (r.datos.solo_servidores) {
        const { count } = await supabase.from('asignaciones_habitacion').select('id', { count: 'exact', head: true }).eq('habitacion_id', id).eq('tipo_persona', 'caminante')
        if ((count ?? 0) > 0) return NextResponse.json({ error: 'Esta habitación tiene caminantes. Sácalos antes de marcarla como solo servidores.' }, { status: 400 })
      }
      const { error } = await supabase.from('habitaciones').update(r.datos).eq('id', id)
      if (error) return NextResponse.json({ error: error.message }, { status: 500 })
      return NextResponse.json({ success: true })
    }

    if (accion === 'eliminar_habitacion') {
      const id = String(body.id ?? '')
      const { data: hab } = await supabase.from('habitaciones').select('id').eq('id', id).eq('retiro_id', RETIRO_ID).maybeSingle()
      if (!hab) return NextResponse.json({ error: 'La habitación no existe en el retiro actual.' }, { status: 404 })
      const { error: e1 } = await supabase.from('asignaciones_habitacion').delete().eq('habitacion_id', id)
      if (e1) return NextResponse.json({ error: e1.message }, { status: 500 })
      const { error } = await supabase.from('habitaciones').delete().eq('id', id)
      if (error) return NextResponse.json({ error: error.message }, { status: 500 })
      return NextResponse.json({ success: true })
    }

    if (accion === 'copiar_habitaciones') {
      const { count: yaHay } = await supabase.from('habitaciones').select('id', { count: 'exact', head: true }).eq('retiro_id', RETIRO_ID)
      if ((yaHay ?? 0) > 0) return NextResponse.json({ error: 'Este retiro ya tiene habitaciones. Solo se puede copiar cuando está vacío.' }, { status: 400 })

      // El retiro anterior más reciente que tenga habitaciones
      const { data: anteriores } = await supabase.from('retiros').select('id, nombre, fecha_inicio').neq('id', RETIRO_ID).order('fecha_inicio', { ascending: false })
      for (const ant of anteriores ?? []) {
        const { data: habs } = await supabase.from('habitaciones').select('numero, piso, bloque, tipo_cama, capacidad, solo_servidores').eq('retiro_id', ant.id)
        if (habs && habs.length > 0) {
          const { error } = await supabase.from('habitaciones').insert(habs.map(h => ({ ...h, retiro_id: RETIRO_ID })))
          if (error) return NextResponse.json({ error: error.message }, { status: 500 })
          return NextResponse.json({ success: true, copiadas: habs.length, desde: ant.nombre })
        }
      }
      return NextResponse.json({ error: 'No encontré habitaciones en retiros anteriores. Créalas una por una.' }, { status: 404 })
    }

    return NextResponse.json({ error: 'Acción no reconocida' }, { status: 400 })
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : 'Error interno' }, { status: 500 })
  }
}
