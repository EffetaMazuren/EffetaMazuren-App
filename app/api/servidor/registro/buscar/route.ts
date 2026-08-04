import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

function normalizarDocumento(valor: string): string {
  return valor.trim()
}

export async function POST(request: NextRequest) {
  try {
    const { numero_documento } = await request.json()

    if (!numero_documento || typeof numero_documento !== 'string') {
      return NextResponse.json({ error: 'Falta numero_documento' }, { status: 400 })
    }

    const documento = normalizarDocumento(numero_documento)

    const { data: persona } = await supabase
      .from('personas')
      .select('id, foto_url')
      .eq('numero_documento_normalizado', documento)
      .maybeSingle()

    // Red de seguridad: cuentas creadas antes de que existiera la vinculación
    // a `personas` (o nunca vinculadas por un líder) no tienen id_persona, así
    // que además de buscar por ese camino, se busca directo por numero_documento
    // en servidores_inscripcion, en cualquier retiro.
    const { data: porDocumentoDirecto, error: errDirecto } = await supabase
      .from('servidores_inscripcion')
      .select('id, usuario_id')
      .eq('numero_documento', documento)
      .not('usuario_id', 'is', null)

    if (errDirecto) {
      return NextResponse.json({ error: errDirecto.message }, { status: 500 })
    }

    if ((porDocumentoDirecto?.length ?? 0) > 1) {
      return NextResponse.json({
        estado: 'error',
        mensaje: 'Hay más de una inscripción con este documento. Contacta a tu líder.',
      })
    }

    if ((porDocumentoDirecto?.length ?? 0) === 1) {
      return NextResponse.json({ estado: 'tiene_cuenta' })
    }

    if (persona) {
      const { data: porIdPersona, error: errIdPersona } = await supabase
        .from('servidores_inscripcion')
        .select('id')
        .eq('id_persona', persona.id)
        .not('usuario_id', 'is', null)

      if (errIdPersona) {
        return NextResponse.json({ error: errIdPersona.message }, { status: 500 })
      }

      if ((porIdPersona?.length ?? 0) > 0) {
        return NextResponse.json({ estado: 'tiene_cuenta' })
      }

      return NextResponse.json({
        estado: 'persona_existente',
        personaId: persona.id,
        tieneFoto: !!persona.foto_url,
      })
    }

    return NextResponse.json({ estado: 'nuevo' })
  } catch (error) {
    console.error('Error en /api/servidor/registro/buscar:', error)
    return NextResponse.json({ error: 'Error interno del servidor' }, { status: 500 })
  }
}
