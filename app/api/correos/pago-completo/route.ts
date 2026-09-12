import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { formatearFechasRetiro } from '@/lib/formato-fecha'

const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!)

export async function POST(req: NextRequest) {
  try {
    const { caminante_id } = await req.json()
    const { data: cam } = await supabase.from('caminantes').select('*').eq('id', caminante_id).single()
    if (!cam) return NextResponse.json({ error: 'No encontrado' }, { status: 404 })

    const { data: retiro } = await supabase
      .from('retiros')
      .select('fecha_inicio, fecha_fin, costo_caminante')
      .eq('id', cam.retiro_id)
      .maybeSingle()

    const fechasRetiro = retiro ? formatearFechasRetiro(retiro.fecha_inicio, retiro.fecha_fin) : '4, 5 y 6 de diciembre de 2026'
    const costoCaminante = retiro?.costo_caminante ?? 500000

    const appsScriptUrl = process.env.APPS_SCRIPT_CORREOS_URL
    if (!appsScriptUrl) {
      return NextResponse.json({ error: 'Falta configurar APPS_SCRIPT_CORREOS_URL' }, { status: 500 })
    }

    // El envío real lo hace el Apps Script vía Gmail -- Resend con el dominio
    // de pruebas onboarding@resend.dev / effetamazuren@gmail.com no puede
    // entregar a destinatarios externos sin verificar un dominio propio.
    const envioRes = await fetch(appsScriptUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        tipo: 'pago_completo',
        correo: cam.correo,
        nombre: cam.nombre,
        costo_caminante: costoCaminante,
        fechas_retiro: fechasRetiro,
      }),
    })
    const envioData = await envioRes.json().catch(() => ({}))
    if (!envioData.success) {
      console.error('Error enviando correo (Apps Script):', envioData.error)
      return NextResponse.json({ error: envioData.error || 'Error enviando el correo' }, { status: 500 })
    }

    return NextResponse.json({ ok: true })
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}
