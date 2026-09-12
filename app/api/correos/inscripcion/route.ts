import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { formatearFechasRetiro } from '@/lib/formato-fecha'

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

    const { data: retiro } = await supabase
      .from('retiros')
      .select('fecha_inicio, fecha_fin, costo_caminante')
      .eq('id', cam.retiro_id)
      .maybeSingle()

    const fechasRetiro = retiro ? formatearFechasRetiro(retiro.fecha_inicio, retiro.fecha_fin) : '4, 5 y 6 de diciembre de 2026'
    const costoCaminante = retiro?.costo_caminante ?? 500000

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

    const appsScriptUrl = process.env.APPS_SCRIPT_CORREOS_URL
    if (!appsScriptUrl) {
      return NextResponse.json({ error: 'Falta configurar APPS_SCRIPT_CORREOS_URL' }, { status: 500 })
    }

    // El envío real lo hace el Apps Script vía Gmail -- Resend con el dominio
    // de pruebas onboarding@resend.dev solo puede entregar al correo del
    // propio dueño de la cuenta Resend, nunca a los caminantes reales.
    const envioRes = await fetch(appsScriptUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        tipo: 'pre_inscripcion',
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
