import { NextRequest, NextResponse } from 'next/server'
import { Resend } from 'resend'
import { createClient } from '@supabase/supabase-js'

const resend = new Resend(process.env.RESEND_API_KEY)
const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

export async function POST(req: NextRequest) {
  try {
    const { caminante_id } = await req.json()

    const { data: cam } = await supabase
      .from('caminantes')
      .select('*')
      .eq('id', caminante_id)
      .single()

    if (!cam) return NextResponse.json({ error: 'No encontrado' }, { status: 404 })

    const { data: contactos } = await supabase
      .from('contactos_emergencia')
      .select('*')
      .eq('persona_id', caminante_id)
      .order('orden')

    // Si es sorpresa: NO enviamos correo automático, solo marcamos para aviso manual
    if (cam.es_sorpresa) {
      await supabase
        .from('caminantes')
        .update({ estado_correo: 'pendiente_manual' })
        .eq('id', caminante_id)

      return NextResponse.json({
        ok: true,
        sorpresa: true,
        mensaje: 'Es sorpresa — notificación manual requerida',
        contacto: contactos?.[0] || null,
      })
    }

    // Correo normal al caminante
    if (!cam.correo) {
      return NextResponse.json({ error: 'El caminante no tiene correo registrado' }, { status: 400 })
    }

    await resend.emails.send({
      from: 'Effetá Mazuren <onboarding@resend.dev>',
      to: cam.correo,
      subject: 'Pre Inscripción 9 Retiro Effetá PJR',
      html: `
        <div style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;max-width:560px;margin:0 auto;padding:32px 24px;color:#0d0d14">
          
          <div style="text-align:center;margin-bottom:36px">
            <h1 style="font-size:28px;font-weight:500;color:#0f1787;letter-spacing:4px;margin:0">EFFETÁ</h1>
            <p style="font-size:11px;color:#9ca3af;letter-spacing:3px;margin:6px 0 0;text-transform:uppercase">Jesucristo Redentor</p>
          </div>

          <p style="font-size:15px;line-height:1.7;color:#374151;margin-bottom:16px">
            Te saludamos desde <strong>Effetá Jesucristo Redentor</strong>.
          </p>

          <p style="font-size:15px;line-height:1.7;color:#374151;margin-bottom:24px">
            Hemos recibido tu pre-inscripción de forma satisfactoria. Te informamos que para completar el proceso de inscripción debes cancelar y enviar el comprobante de pago a este mismo correo, de lo contrario tu cupo será asignado a otro caminante que se encuentra en la lista de espera.
          </p>

          <div style="background:#f7f8fc;border-radius:14px;padding:24px;margin-bottom:24px;border:1px solid #e5e7eb">
            <p style="font-size:13px;font-weight:600;color:#0f1787;letter-spacing:1px;text-transform:uppercase;margin:0 0 16px">Datos de pago</p>
            
            <table style="width:100%;border-collapse:collapse">
              <tr>
                <td style="padding:8px 0;border-bottom:1px solid #e5e7eb;font-size:13px;color:#6b7280">Valor total</td>
                <td style="padding:8px 0;border-bottom:1px solid #e5e7eb;font-size:15px;font-weight:600;color:#0d0d14;text-align:right">$500.000</td>
              </tr>
              <tr>
                <td style="padding:8px 0;border-bottom:1px solid #e5e7eb;font-size:13px;color:#6b7280">Tipo de cuenta</td>
                <td style="padding:8px 0;border-bottom:1px solid #e5e7eb;font-size:13px;font-weight:500;color:#0d0d14;text-align:right">Cuenta de Ahorros</td>
              </tr>
              <tr>
                <td style="padding:8px 0;border-bottom:1px solid #e5e7eb;font-size:13px;color:#6b7280">Banco</td>
                <td style="padding:8px 0;border-bottom:1px solid #e5e7eb;font-size:13px;font-weight:500;color:#0d0d14;text-align:right">Banco Caja Social</td>
              </tr>
              <tr>
                <td style="padding:8px 0;border-bottom:1px solid #e5e7eb;font-size:13px;color:#6b7280">Número de cuenta</td>
                <td style="padding:8px 0;border-bottom:1px solid #e5e7eb;font-size:15px;font-weight:600;color:#0f1787;text-align:right">24091748063</td>
              </tr>
              <tr>
                <td style="padding:8px 0;border-bottom:1px solid #e5e7eb;font-size:13px;color:#6b7280">A nombre de</td>
                <td style="padding:8px 0;border-bottom:1px solid #e5e7eb;font-size:13px;font-weight:500;color:#0d0d14;text-align:right">Parroquia Jesucristo Redentor</td>
              </tr>
              <tr>
                <td style="padding:8px 0;font-size:13px;color:#6b7280">NIT</td>
                <td style="padding:8px 0;font-size:13px;font-weight:500;color:#0d0d14;text-align:right">830.023.101-6</td>
              </tr>
            </table>
          </div>

          <p style="font-size:14px;line-height:1.7;color:#374151;margin-bottom:24px">
            Una vez realizado el pago, por favor envíanos pantallazo de la transacción o comprobante de pago donde se vea el número de aprobación, respondiendo este correo o a cualquiera de los números de contacto que se encuentran en el link de inscripciones.
          </p>

          <div style="background:#0f1787;border-radius:14px;padding:20px;text-align:center;margin-bottom:28px">
            <p style="color:rgba(255,255,255,0.7);font-size:12px;margin:0 0 4px;letter-spacing:1px;text-transform:uppercase">9° Retiro Espiritual</p>
            <p style="color:#fff;font-size:20px;font-weight:500;margin:0">3, 4 y 5 de julio de 2026</p>
          </div>

          <p style="font-size:15px;color:#374151;margin-bottom:4px">¡Te esperamos en nuestro retiro!</p>
          <p style="font-size:15px;color:#374151;margin-bottom:24px">Que Dios te bendiga.</p>
          <p style="font-size:15px;font-weight:500;color:#0f1787;margin:0">Effetá Jesucristo Redentor</p>

          <hr style="border:none;border-top:1px solid #e5e7eb;margin:28px 0">
          <p style="font-size:11px;color:#9ca3af;text-align:center;margin:0">Grupo Effetá Mazuren · Parroquia Jesucristo Redentor · Bogotá, Colombia</p>
        </div>
      `,
    })

    await supabase
      .from('caminantes')
      .update({ estado_correo: 'enviado' })
      .eq('id', caminante_id)

    return NextResponse.json({ ok: true, sorpresa: false })

  } catch (err: any) {
    console.error('Error enviando correo:', err)
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}
