import { createClient } from '@supabase/supabase-js'
import { NextRequest, NextResponse } from 'next/server'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

export async function PATCH(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  const { es_interno } = await req.json()

  if (typeof es_interno !== 'boolean') {
    return NextResponse.json({ error: 'Valor inválido' }, { status: 400 })
  }

  const { error } = await supabase
    .from('servidores_inscripcion')
    .update({ es_interno })
    .eq('id', params.id)

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json({ ok: true })
}
