import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { registrarIngresoRifa } from '@/lib/rifa-finanzas'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    if (!id) {
      return NextResponse.json({ error: 'ID requerido' }, { status: 400 })
    }

    const body = await request.json().catch(() => ({}))
    const { usuarioId } = body

    const { data: boleto, error: errUpdate } = await supabase
      .from('rifa_boletos')
      .update({ estado: 'confirmado' })
      .eq('id', id)
      .select()
      .single()

    if (errUpdate || !boleto) {
      return NextResponse.json({ error: errUpdate?.message || 'No se pudo confirmar la boleta' }, { status: 500 })
    }

    // Que la plata recolectada y el comprobante se vean también en Finanzas
    try {
      await registrarIngresoRifa(supabase, boleto, usuarioId || boleto.registrado_por || null)
    } catch (err) {
      console.error('Error registrando ingreso de rifa en Finanzas:', err)
    }

    return NextResponse.json({ success: true, boleto })
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : 'Error interno' }, { status: 500 })
  }
}
