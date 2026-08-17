import { createClient } from '@supabase/supabase-js'
import { NextRequest, NextResponse } from 'next/server'

// Marcar/editar asistencia manualmente desde el dashboard de líderes.
// Corre con service_role porque las políticas RLS de `asistencias` solo
// permiten que un servidor escriba su propia fila (auth.uid() = usuario_id);
// un líder marcando la asistencia de otra persona no cumple esa condición,
// así que el upsert directo desde el cliente queda bloqueado por RLS.
const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

export async function POST(req: NextRequest) {
  const { servidorInscripcionId, usuarioId, reunionId, asistio } = await req.json()

  if (!servidorInscripcionId || !reunionId || typeof asistio !== 'boolean') {
    return NextResponse.json({ error: 'Datos inválidos' }, { status: 400 })
  }

  // Se resuelve con select + insert/update (en vez de upsert con onConflict)
  // porque no hay certeza de que exista una constraint única sobre
  // (servidor_inscripcion_id, reunion_id) en la base real -- así funciona
  // sin depender de eso.
  const { data: existente, error: errBuscar } = await supabase
    .from('asistencias')
    .select('id')
    .eq('servidor_inscripcion_id', servidorInscripcionId)
    .eq('reunion_id', reunionId)
    .maybeSingle()

  if (errBuscar) {
    console.error('Error buscando asistencia (lider):', errBuscar)
    return NextResponse.json({ error: errBuscar.message }, { status: 500 })
  }

  const fila = {
    servidor_inscripcion_id: servidorInscripcionId,
    usuario_id: usuarioId ?? null,
    reunion_id: reunionId,
    asistio,
    fuera_de_horario: false,
    fecha_registro: new Date().toISOString(),
  }

  const { error } = existente
    ? await supabase.from('asistencias').update(fila).eq('id', existente.id)
    : await supabase.from('asistencias').insert(fila)

  if (error) {
    console.error('Error marcando asistencia (lider):', error)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json({ ok: true })
}
