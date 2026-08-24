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

    // Desasignar (sin borrar) el seguimiento de palancas que tenía a cargo,
    // para que un líder lo reasigne a otro servidor
    await supabase.from('palancas_seguimiento').update({ servidor_inscripcion_id: null }).eq('servidor_inscripcion_id', id)

    // Borrar en cascada las tablas relacionadas en Supabase
    // (roles_pre_retiro_asignaciones se borra sola por el "on delete cascade" de su FK)
    await supabase.from('asignaciones_habitacion').delete().eq('persona_id', id).eq('tipo_persona', 'servidor')
    await supabase.from('asistencias').delete().eq('servidor_inscripcion_id', id)

    // Pagos: NO se borran, se marcan como retirados (conserva historial contable)
    await supabase
      .from('pagos')
      .update({ retirado: true, fecha_retiro: new Date().toISOString() })
      .eq('persona_id', id)
      .eq('tipo_persona', 'servidor')

    // Borrar la inscripción del servidor. La cuenta de acceso (usuarios / Auth)
    // se deja intacta a propósito -- si vuelve a inscribirse en otro retiro,
    // conserva su cuenta.
    const { error } = await supabase.from('servidores_inscripcion').delete().eq('id', id)
    if (error) {
      return NextResponse.json({ error: 'Error al eliminar' }, { status: 500 })
    }

    return NextResponse.json({ success: true })
  } catch (error) {
    return NextResponse.json({ error: 'Error interno' }, { status: 500 })
  }
}
