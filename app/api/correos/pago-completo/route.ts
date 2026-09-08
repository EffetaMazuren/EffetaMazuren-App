import { NextRequest, NextResponse } from 'next/server'
import { Resend } from 'resend'
import { createClient } from '@supabase/supabase-js'
import { formatearFechasRetiro } from '@/lib/formato-fecha'

const resend = new Resend(process.env.RESEND_API_KEY)
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

    await resend.emails.send({
      from: 'Effetá Mazuren <effetamazuren@gmail.com>',
      to: cam.correo,
      subject: '🎉 ¡Tu pago está completo! Retiro Effetá Mazuren',
      html: `
        <div style="font-family:-apple-system,sans-serif;max-width:520px;margin:0 auto;padding:32px 24px">
          <div style="text-align:center;margin-bottom:32px">
            <h1 style="font-size:32px;font-weight:500;color:#0f1787;letter-spacing:3px;margin:0">EFFETÁ</h1>
            <p style="font-size:11px;color:#9ca3af;letter-spacing:3px;margin:4px 0 0">"ABRIR EL CORAZÓN" · MAZUREN</p>
          </div>
          <div style="background:#dcfce7;border-radius:12px;padding:16px;text-align:center;margin-bottom:24px">
            <p style="font-size:16px;font-weight:500;color:#166534;margin:0">✅ ¡Pago completo confirmado!</p>
          </div>
          <h2 style="font-size:20px;font-weight:500;color:#0d0d14;margin-bottom:8px">Hola, ${cam.nombre} 🎉</h2>
          <p style="color:#6b7280;font-size:15px;line-height:1.6;margin-bottom:24px">
            Tu pago de <strong>$${costoCaminante.toLocaleString('es-CO')} COP</strong> ha sido completado. Tu cupo en el Retiro Espiritual Effetá Mazuren está <strong>100% confirmado</strong>.
          </p>
          <div style="background:#0f1787;border-radius:12px;padding:20px;text-align:center;margin-bottom:24px">
            <p style="color:rgba(255,255,255,0.7);font-size:13px;margin:0 0 4px">Te esperamos en el</p>
            <p style="color:#fff;font-size:20px;font-weight:500;margin:0">Retiro Espiritual Effetá</p>
            <p style="color:rgba(255,255,255,0.7);font-size:14px;margin:8px 0 0">${fechasRetiro}</p>
          </div>
          <p style="color:#9ca3af;font-size:12px;text-align:center;margin:0">Grupo Effetá Mazuren · Bogotá, Colombia</p>
        </div>`,
    })

    return NextResponse.json({ ok: true })
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}
