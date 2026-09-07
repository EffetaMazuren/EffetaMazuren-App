import type { SupabaseClient } from '@supabase/supabase-js'

const PRECIO_BOLETA = 20000
const CATEGORIA_RIFA_NOMBRE = 'Rifa'

type BoletoParaFinanzas = {
  id: string
  retiro_id: string
  numero: number
  comprador_nombre: string
  comprobante_url: string
  comprobante_nombre: string | null
}

// Registra (o actualiza, si ya existía) el ingreso en Finanzas que
// corresponde a una boleta de rifa confirmada, para que la plata
// recolectada y el comprobante se vean también ahí. Se llama tanto al
// aprobar una boleta pendiente como al registrar una venta ya confirmada
// directamente desde el tablero de líder.
export async function registrarIngresoRifa(
  supabase: SupabaseClient,
  boleto: BoletoParaFinanzas,
  usuarioId: string | null
) {
  let categoriaId: string | null = null

  const { data: categoria } = await supabase
    .from('categorias_financieras')
    .select('id')
    .eq('retiro_id', boleto.retiro_id)
    .eq('nombre', CATEGORIA_RIFA_NOMBRE)
    .maybeSingle()

  if (categoria) {
    categoriaId = categoria.id
  } else {
    const { data: nueva } = await supabase
      .from('categorias_financieras')
      .insert({
        retiro_id: boleto.retiro_id,
        nombre: CATEGORIA_RIFA_NOMBRE,
        tipo_cuenta: 'Nequi Effetá',
        tipo_movimiento: 'ingreso',
        activa: true,
        presupuesto: 0,
      })
      .select('id')
      .single()
    categoriaId = nueva?.id ?? null
  }

  if (!categoriaId) return

  await supabase.from('transacciones').upsert(
    {
      retiro_id: boleto.retiro_id,
      usuario_id: usuarioId,
      categoria_id: categoriaId,
      tipo: 'ingreso',
      valor: PRECIO_BOLETA,
      descripcion: `Boleta rifa № ${String(boleto.numero).padStart(2, '0')} - ${boleto.comprador_nombre}`,
      fecha: new Date().toISOString().split('T')[0],
      comprobante_url: boleto.comprobante_url,
      comprobante_nombre: boleto.comprobante_nombre,
      estado: 'aprobado',
      rifa_boleto_id: boleto.id,
    },
    { onConflict: 'rifa_boleto_id' }
  )
}
