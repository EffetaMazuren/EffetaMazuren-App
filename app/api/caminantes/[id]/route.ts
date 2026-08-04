import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

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
