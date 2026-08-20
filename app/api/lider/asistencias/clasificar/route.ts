import { createClient } from '@supabase/supabase-js'
import { NextRequest, NextResponse } from 'next/server'

// Clasificar una asistencia ya registrada (típicamente una marcada
// fuera_de_horario) como asistió/no asistió, sin tocar fuera_de_horario --
// esa bandera describe si llegó dentro de la ventana válida, es una
// decisión aparte de si finalmente cuenta como presente. Corre con
// service_role por la misma razón que el resto de escrituras de líder en
// `asistencias`: no hay política RLS de UPDATE para esta tabla.
const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

export async function POST(req: NextRequest) {
  const { id, asistio } = await req.json()

  if (!id || typeof asistio !== 'boolean') {
    return NextResponse.json({ error: 'Datos inválidos' }, { status: 400 })
  }

  const { error } = await supabase
    .from('asistencias')
    .update({ asistio })
    .eq('id', id)

  if (error) {
    console.error('Error clasificando asistencia (lider):', error)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json({ ok: true })
}
