import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const {
      nombre, fecha_inicio, fecha_fin, lugar,
      meta_financiera, capacidad_caminantes, capacidad_servidores,
      costo_caminante, costo_servidor, link_formulario, link_manual,
    } = body

    const faltantes: string[] = []
    if (!nombre?.trim()) faltantes.push('nombre')
    if (!fecha_inicio) faltantes.push('fecha_inicio')
    if (!fecha_fin) faltantes.push('fecha_fin')
    if (!lugar?.trim()) faltantes.push('lugar')
    if (faltantes.length > 0) {
      return NextResponse.json({ error: `Faltan datos requeridos: ${faltantes.join(', ')}` }, { status: 400 })
    }

    // Archivar el retiro que hoy está activo (no se borra nada, solo deja de ser el activo)
    const { data: actual } = await supabase
      .from('retiros')
      .select('id')
      .eq('estado', 'activo')
      .maybeSingle()

    if (actual) {
      const { error: errArchivar } = await supabase
        .from('retiros')
        .update({ estado: 'archivado' })
        .eq('id', actual.id)
      if (errArchivar) {
        return NextResponse.json({ error: `Error archivando el retiro anterior: ${errArchivar.message}` }, { status: 500 })
      }
    }

    // Crear el retiro nuevo, ya activo
    const { data: nuevo, error: errCrear } = await supabase
      .from('retiros')
      .insert({
        nombre: nombre.trim(),
        fecha_inicio,
        fecha_fin,
        lugar: lugar.trim(),
        meta_financiera: Number(meta_financiera) || 0,
        capacidad_caminantes: Number(capacidad_caminantes) || 0,
        capacidad_servidores: Number(capacidad_servidores) || 0,
        costo_caminante: Number(costo_caminante) || 0,
        costo_servidor: Number(costo_servidor) || 0,
        link_formulario: link_formulario?.trim() || '',
        link_manual: link_manual?.trim() || '',
        estado: 'activo',
      })
      .select('id')
      .single()

    if (errCrear || !nuevo) {
      // Revertir el archivado si la creación del nuevo falló, para no dejar la app sin retiro activo
      if (actual) {
        await supabase.from('retiros').update({ estado: 'activo' }).eq('id', actual.id)
      }
      return NextResponse.json({ error: errCrear?.message || 'Error creando el nuevo retiro' }, { status: 500 })
    }

    return NextResponse.json({ success: true, id: nuevo.id })
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : 'Error interno' }, { status: 500 })
  }
}
