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
      retiroId, numero,
      compradorNombre, compradorDocumento, compradorTelefono,
      vendedorNombre, comprobanteUrl, comprobanteNombre, registradoPor,
    } = body

    const faltantes: string[] = []
    if (!retiroId) faltantes.push('retiroId')
    if (numero === undefined || numero === null || numero === '') faltantes.push('numero')
    if (!compradorNombre?.trim()) faltantes.push('compradorNombre')
    if (!compradorDocumento?.trim()) faltantes.push('compradorDocumento')
    if (!compradorTelefono?.trim()) faltantes.push('compradorTelefono')
    if (!vendedorNombre?.trim()) faltantes.push('vendedorNombre')
    if (!comprobanteUrl) faltantes.push('comprobanteUrl')

    if (faltantes.length > 0) {
      return NextResponse.json({ error: `Faltan datos requeridos: ${faltantes.join(', ')}` }, { status: 400 })
    }

    const numeroInt = Number(numero)
    if (!Number.isInteger(numeroInt) || numeroInt < 0 || numeroInt > 99) {
      return NextResponse.json({ error: 'El número debe estar entre 00 y 99' }, { status: 400 })
    }

    const { data: boleto, error: errInsert } = await supabase
      .from('rifa_boletos')
      .insert({
        retiro_id: retiroId,
        numero: numeroInt,
        comprador_nombre: compradorNombre.trim(),
        comprador_documento: compradorDocumento.trim(),
        comprador_telefono: compradorTelefono.trim(),
        vendedor_nombre: vendedorNombre.trim(),
        comprobante_url: comprobanteUrl,
        comprobante_nombre: comprobanteNombre || null,
        registrado_por: registradoPor || null,
      })
      .select()
      .single()

    if (errInsert) {
      // 23505 = violación de índice único -- alguien más ya tiene ese número reservado
      if (errInsert.code === '23505') {
        return NextResponse.json({ error: `El número ${String(numeroInt).padStart(2, '0')} ya fue vendido o está pendiente de revisión.` }, { status: 409 })
      }
      return NextResponse.json({ error: errInsert.message }, { status: 500 })
    }

    // Espejo hacia el Google Sheet (dispara y olvida, no bloquea el registro si falla)
    if (process.env.APPS_SCRIPT_RIFA_URL) {
      try {
        await fetch(process.env.APPS_SCRIPT_RIFA_URL, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            type: 'rifa_registrar',
            fecha: new Date().toISOString(),
            numero: String(numeroInt).padStart(2, '0'),
            comprador_nombre: boleto.comprador_nombre,
            comprador_documento: boleto.comprador_documento,
            comprador_telefono: boleto.comprador_telefono,
            vendedor_nombre: boleto.vendedor_nombre,
            comprobante_url: boleto.comprobante_url,
          }),
        })
      } catch (err) {
        console.error('Error enviando rifa al Google Sheet:', err)
      }
    }

    return NextResponse.json({ success: true, boleto })
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : 'Error interno' }, { status: 500 })
  }
}
