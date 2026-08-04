import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

// Clave secreta simple para proteger esta ruta — cámbiala por algo tuyo.
const CLAVE_SECRETA = 'effeta2026admin'

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url)
  const clave = searchParams.get('clave')
  const email = searchParams.get('email')

  if (clave !== CLAVE_SECRETA) {
    return NextResponse.json({ error: 'No autorizado' }, { status: 401 })
  }
  if (!email) {
    return NextResponse.json({ error: 'Falta el parámetro email' }, { status: 400 })
  }

  const supabaseAdmin = createClient(
    'https://pckussxwvbpgjkmojpih.supabase.co',
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  )

  const { data, error } = await supabaseAdmin.auth.admin.generateLink({
    type: 'magiclink',
    email,
    options: {
      redirectTo: 'https://effeta-mazuren-app.vercel.app',
    },
  })

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json({ link: data.properties.action_link })
}
