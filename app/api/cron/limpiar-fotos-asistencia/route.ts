import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

const BUCKET = 'comprobantes-pagos'
const DIAS_RETENCION = 15

// Corre diariamente vía Vercel Cron (ver vercel.json). Borra del storage las
// fotos de asistencia con más de 15 días -- NO borra la fila de `asistencias`
// ni ninguno de sus otros campos (asistio, fuera_de_horario, fecha_registro,
// motivo_alerta quedan intactos). Solo `foto_url` pasa a null y el archivo
// deja de existir en el bucket. Objetivo: la asistencia sigue contando para
// siempre, la foto (que ya cumplió su propósito de verificación al momento
// de tomarse) no se queda ocupando storage indefinidamente.
export async function GET(request: NextRequest) {
  const auth = request.headers.get('authorization')
  if (auth !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: 'No autorizado' }, { status: 401 })
  }

  try {
    const limite = new Date(Date.now() - DIAS_RETENCION * 24 * 60 * 60 * 1000).toISOString()

    const { data: asistencias, error: errBusqueda } = await supabase
      .from('asistencias')
      .select('id, foto_url')
      .not('foto_url', 'is', null)
      .lt('fecha_registro', limite)

    if (errBusqueda) {
      return NextResponse.json({ error: errBusqueda.message }, { status: 500 })
    }

    if (!asistencias || asistencias.length === 0) {
      return NextResponse.json({ success: true, borradas: 0 })
    }

    const marcador = `/public/${BUCKET}/`
    const rutas = asistencias
      .map(a => {
        const idx = (a.foto_url ?? '').indexOf(marcador)
        return idx === -1 ? null : a.foto_url!.slice(idx + marcador.length)
      })
      .filter((r): r is string => r !== null)

    if (rutas.length > 0) {
      const { error: errStorage } = await supabase.storage.from(BUCKET).remove(rutas)
      if (errStorage) {
        console.error('Error borrando fotos de storage:', errStorage)
      }
    }

    const ids = asistencias.map(a => a.id)
    const { error: errUpdate } = await supabase
      .from('asistencias')
      .update({ foto_url: null })
      .in('id', ids)

    if (errUpdate) {
      return NextResponse.json({ error: errUpdate.message }, { status: 500 })
    }

    return NextResponse.json({ success: true, borradas: ids.length })
  } catch (error) {
    console.error('Error en limpiar-fotos-asistencia:', error)
    return NextResponse.json({ error: 'Error interno del servidor' }, { status: 500 })
  }
}
