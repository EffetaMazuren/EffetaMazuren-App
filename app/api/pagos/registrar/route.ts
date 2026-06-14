import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const {
      caminanteId,
      retiroId,
      valor,
      fileUrl,
      fileName,
      filePath,
      registradoPor,
      notas,
    } = body

    if (!caminanteId || !retiroId || !valor || !registradoPor) {
      return NextResponse.json({ error: 'Faltan datos requeridos' }, { status: 400 })
    }

    // Registrar el pago en Supabase
    const { data: pago, error: errorPago } = await supabase
      .from('pagos')
      .insert({
        persona_id: caminanteId,
        tipo_persona: 'caminante',
        retiro_id: retiroId,
        valor: valor,
        fecha: new Date().toISOString().split('T')[0],
        comprobante_url: fileUrl || null,
        comprobante_nombre: fileName || null,
        comprobante_path: filePath || null,
        registrado_por: registradoPor,
        notas: notas || null,
        estado: 'confirmado',
        metodo_pago: 'transferencia',
      })
      .select()
      .single()

    if (errorPago) {
      console.error('Error registrando pago:', errorPago)
      return NextResponse.json({ error: 'Error al registrar pago' }, { status: 500 })
    }

    // Calcular total pagado
    const { data: pagos, error: errorPagos } = await supabase
      .from('pagos')
      .select('valor')
      .eq('persona_id', caminanteId)
      .eq('retiro_id', retiroId)
      .eq('tipo_persona', 'caminante')

    if (errorPagos) {
      return NextResponse.json({ error: 'Error calculando total' }, { status: 500 })
    }

    const totalPagado = pagos?.reduce((sum, p) => sum + Number(p.valor), 0) || 0
    const valorTotal = 500000
    const faltaPorPagar = Math.max(0, valorTotal - totalPagado)
    const inscritoOficialmente = totalPagado >= valorTotal

    // Actualizar inscrito_oficialmente si ya pagó completo
    if (inscritoOficialmente) {
      await supabase
        .from('caminantes')
        .update({ inscrito_oficialmente: true })
        .eq('id', caminanteId)
    }

    // ── CORREO DE CONFIRMACIÓN ──────────────────────────────────────────
    const { data: caminante } = await supabase
      .from('caminantes')
      .select('nombre, correo, es_sorpresa')
      .eq('id', caminanteId)
      .single()

    if (caminante) {
      try {
        const appsScriptUrl = process.env.APPS_SCRIPT_CORREOS_URL!

        if (caminante.es_sorpresa) {
          // Obtener ambos contactos de emergencia
          const { data: contactos } = await supabase
            .from('contactos_emergencia')
            .select('nombre, parentesco, celular, orden')
            .eq('persona_id', caminanteId)
            .eq('tipo_persona', 'caminante')
            .order('orden', { ascending: true })

          await fetch(appsScriptUrl, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              tipo: 'sorpresa_pago',
              nombre_caminante: caminante.nombre,
              monto_abonado: Number(valor),
              total_pagado: totalPagado,
              valor_total: valorTotal,
              es_pago_completo: inscritoOficialmente,
              contactos: contactos || [],
              url_ficha: `https://effeta-mazuren-app.vercel.app/dashboard/caminantes/${caminanteId}`,
            }),
          })
        } else if (caminante.correo) {
          // Correo normal al caminante
          await fetch(appsScriptUrl, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              tipo: 'confirmacion_pago',
              nombre: caminante.nombre,
              correo: caminante.correo,
              monto_abonado: Number(valor),
              total_pagado: totalPagado,
              valor_total: valorTotal,
              es_pago_completo: inscritoOficialmente,
            }),
          })
        }
      } catch (errCorreo) {
        console.error('Error enviando correo confirmación:', errCorreo)
      }
    }
    // ────────────────────────────────────────────────────────────────────

    return NextResponse.json({
      success: true,
      pago,
      resumen: {
        totalPagado,
        faltaPorPagar,
        inscritoOficialmente,
        valorTotal,
      },
    })
  } catch (error) {
    console.error('Error en API pagos:', error)
    return NextResponse.json({ error: 'Error interno del servidor' }, { status: 500 })
  }
}
