import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
 
const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)
 
const VALOR_TOTAL = 380000
 
export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { servidorId, valor, comprovanteUrl, comprobanteName } = body
 
    if (!servidorId || !valor) {
      return NextResponse.json({ error: 'Faltan datos requeridos' }, { status: 400 })
    }
 
    // Obtener retiro activo
    const { data: retiro } = await supabase
      .from('retiros')
      .select('id')
      .eq('estado', 'activo')
      .single()
 
    // Registrar el pago
    const { error: errorPago } = await supabase.from('pagos').insert({
      persona_id: servidorId,
      tipo_persona: 'servidor',
      retiro_id: retiro?.id,
      valor: Number(valor),
      fecha: new Date().toISOString().split('T')[0],
      estado: 'confirmado',
      comprobante_url: comprovanteUrl || null,
      comprobante_nombre: comprobanteName || null,
    })
 
    if (errorPago) {
      return NextResponse.json({ error: 'Error al registrar pago' }, { status: 500 })
    }
 
    // Calcular total pagado actualizado
    const { data: pagos } = await supabase
      .from('pagos')
      .select('valor')
      .eq('persona_id', servidorId)
      .eq('tipo_persona', 'servidor')
      .eq('estado', 'confirmado')
 
    const totalPagado = pagos?.reduce((sum, p) => sum + Number(p.valor), 0) || 0
    const esPagoCompleto = totalPagado >= VALOR_TOTAL
 
    // Obtener datos del servidor para el correo
    const { data: servidor } = await supabase
      .from('servidores_inscripcion')
      .select('nombre, correo')
      .eq('id', servidorId)
      .single()
 
    // Enviar correo via Apps Script
    if (servidor?.correo) {
      try {
        await fetch(process.env.APPS_SCRIPT_CORREOS_URL!, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            tipo: 'confirmacion_pago_servidor',
            nombre: servidor.nombre,
            correo: servidor.correo,
            total_pagado: totalPagado,
            valor_total: VALOR_TOTAL,
            es_pago_completo: esPagoCompleto,
          }),
        })
      } catch (errCorreo) {
        console.error('Error enviando correo servidor:', errCorreo)
      }
    }
 
    return NextResponse.json({ success: true, totalPagado, esPagoCompleto })
  } catch (error) {
    console.error('Error en API pagos servidor:', error)
    return NextResponse.json({ error: 'Error interno del servidor' }, { status: 500 })
  }
}
 
