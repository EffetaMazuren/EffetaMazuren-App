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

    await supabase.from('asignaciones_mesa').delete().eq('persona_id', id)
    await supabase.from('asistencias').delete().eq('persona_id', id)
    await supabase.from('contactos_emergencia').delete().eq('persona_id', id)
    await supabase.from('pagos').delete().eq('persona_id', id)
    await supabase.from('transacciones').delete().eq('persona_id', id)

    const { error } = await supabase.from('caminantes').delete().eq('id', id)

    if (error) {
      return NextResponse.json({ error: 'Error al eliminar' }, { status: 500 })
    }

    return NextResponse.json({ success: true })
  } catch (error) {
    return NextResponse.json({ error: 'Error interno' }, { status: 500 })
  }
}
