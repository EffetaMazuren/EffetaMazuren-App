import { NextRequest, NextResponse } from 'next/server'
import { Resend } from 'resend'
import { createClient } from '@supabase/supabase-js'

const resend = new Resend(process.env.RESEND_API_KEY)
const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!)

export async function POST(req: NextRequest) {
  try {
    const { caminante_id } = await req.json()
    const { data: cam } = await supabase.from('caminantes').select('*').eq('id', caminante_id).single()
    if (!cam) return NextResponse.json({ error: 'No encontrado' }, { status: 404 })

    const { data: contactos } = await supabase.from('contactos_emergencia').select('*').eq('persona_id', caminante_id).order('orden')

    const destinatario = cam.es_sorpresa ? cam.correo : cam.correo
    const nombreDestinatario = cam.es_sorpresa ? contactos?.[0]?.nombre || 'Familiar' : cam.nombre

    await resend.emails.send({
      from: 'Effetá Mazuren <effetamazuren@gmail.com>',
      to: destinatario,
      subject: cam.es_sorpresa ? `Información importante sobre ${cam.nombre}` : `¡Confirmación de inscripción al Retiro Effetá!`,
      html: `
        <div style="font-family:-apple-system,sans-serif;max-width:520px;margin:0 auto;padding:32px 24px">
          <div style="text-align:center;margin-bottom:32px">
            <h1 style="font-size:32px;font-weight:500;color:#0f1787;letter-spacing:3px;margin:0">EFFETÁ</h1>
            <p style="font-size:11px;color:#9ca3af;letter-spacing:3px;margin:4px 0 0">"ABRIR EL CORAZÓN" · MAZUREN</p>
          </div>
          <h2 style="font-size:20px;font-weight:500;color:#0d0d14;margin-bottom:8px">Hola, ${nombreDestinatario} 👋</h2>
          <p style="color:#6b7280;font-size:15px;line-height:1.6;margin-bottom:24px">
            ${cam.es_sorpresa
              ? `Te escribimos porque <strong>${cam.nombre}</strong> ha sido inscrito(a) al Retiro Espiritual Effetá Mazuren. Como contacto de confianza, te compartimos la información de pago.`
              : `Tu inscripción al <strong>Retiro Espiritual Effetá Mazuren</strong> ha sido recibida. ¡Estamos muy felices de que seas parte de esta experiencia!`}
          </p>
          <div style="background:#f7f8fc;border-radius:12px;padding:20px;margin-bottom:24px">
            <p style="font-size:13px;font-weight:500;color:#0d0d14;margin:0 0 12px">Información de pago</p>
            <p style="font-size:13px;color:#6b7280;margin:0 0 8px">Valor total: <strong style="color:#0d0d14">$500.000 COP</strong></p>
            <p style="font-size:13px;color:#6b7280;margin:0">Puedes realizar abonos parciales. El cupo queda asegurado desde el primer abono.</p>
          </div>
          <div style="background:#0f1787;border-radius:12px;padding:20px;text-align:center;margin-bottom:24px">
            <p style="color:rgba(255,255,255,0.7);font-size:13px;margin:0 0 4px">Retiro Espiritual Effetá</p>
            <p style="color:#fff;font-size:18px;font-weight:500;margin:0">3, 4 y 5 de julio de 2026</p>
          </div>
          <p style="color:#9ca3af;font-size:12px;text-align:center;margin:0">Grupo Effetá Mazuren · Bogotá, Colombia</p>
        </div>`,
    })

    await supabase.from('caminantes').update({ estado_correo: cam.es_sorpresa ? 'enviado_contacto' : 'enviado' }).eq('id', caminante_id)
    return NextResponse.json({ ok: true })
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}
