import { createClient } from '@supabase/supabase-js'
import { NextRequest, NextResponse } from 'next/server'

// Registrar la propia asistencia del servidor (auto check-in con selfie).
// Corre con service_role porque `asistencias` no tiene ninguna política RLS
// de INSERT/UPDATE (solo hay una de SELECT para líderes) -- el upsert
// directo desde el cliente queda bloqueado por RLS para todo el mundo,
// no solo para el líder marcando a otra persona.
const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

export async function POST(req: NextRequest) {
  const { usuarioId, servidorInscripcionId, reunionId, fotoUrl, fueraDeHorario, motivoAlerta } = await req.json()

  if (!usuarioId || !servidorInscripcionId || !reunionId || !fotoUrl) {
    return NextResponse.json({ error: 'Datos inválidos' }, { status: 400 })
  }

  const { data: existente, error: errBuscar } = await supabase
    .from('asistencias')
    .select('id')
    .eq('servidor_inscripcion_id', servidorInscripcionId)
    .eq('reunion_id', reunionId)
    .maybeSingle()

  if (errBuscar) {
    console.error('Error buscando asistencia (servidor):', errBuscar)
    return NextResponse.json({ error: errBuscar.message }, { status: 500 })
  }

  const ahora = new Date().toISOString()
  const fila = {
    usuario_id: usuarioId,
    servidor_inscripcion_id: servidorInscripcionId,
    reunion_id: reunionId,
    asistio: true,
    foto_url: fotoUrl,
    fecha_registro: ahora,
    fecha_hora: ahora,
    fuera_de_horario: !!fueraDeHorario,
    motivo_alerta: motivoAlerta ?? null,
  }

  const { error } = existente
    ? await supabase.from('asistencias').update(fila).eq('id', existente.id)
    : await supabase.from('asistencias').insert(fila)

  if (error) {
    console.error('Error registrando asistencia (servidor):', error)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json({ ok: true })
}
