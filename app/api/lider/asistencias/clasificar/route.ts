import { createClient } from '@supabase/supabase-js'
import { NextRequest, NextResponse } from 'next/server'

// Editar una asistencia ya registrada: asistió/no asistió y/o si cuenta
// como fuera de horario. Son dos decisiones independientes -- fuera de
// horario describe si llegó dentro de la ventana válida, asistio si
// finalmente cuenta como presente. El líder puede corregir cualquiera de
// las dos (por ejemplo, quitar la marca de fuera de horario para que
// vuelva a contar en la racha). Corre con service_role por la misma razón
// que el resto de escrituras de líder en `asistencias`: no hay política
// RLS de UPDATE para esta tabla.
const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

export async function POST(req: NextRequest) {
  const { id, asistio, fueraDeHorario } = await req.json()

  if (!id || (typeof asistio !== 'boolean' && typeof fueraDeHorario !== 'boolean')) {
    return NextResponse.json({ error: 'Datos inválidos' }, { status: 400 })
  }

  const cambios: { asistio?: boolean; fuera_de_horario?: boolean } = {}
  if (typeof asistio === 'boolean') cambios.asistio = asistio
  if (typeof fueraDeHorario === 'boolean') cambios.fuera_de_horario = fueraDeHorario

  const { error } = await supabase
    .from('asistencias')
    .update(cambios)
    .eq('id', id)

  if (error) {
    console.error('Error clasificando asistencia (lider):', error)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json({ ok: true })
}
