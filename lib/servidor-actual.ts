import { supabase } from './supabase'

// Encuentra la fila de servidores_inscripcion del RETIRO ACTIVO para la
// cuenta conectada.
//
// Orden de búsqueda:
//   1. usuario_id + retiro_id del retiro activo (el camino normal).
//   2. user_metadata.servidor_inscripcion_id -- solo si esa fila es del
//      retiro activo. Cuentas creadas con el flujo viejo guardaron ahí el id
//      de su fila de JULIO; si se usara a ciegas, un servidor que regresa
//      vería sus roles/mesa del retiro anterior en vez de los de ahora.
//      Si la fila no tiene usuario_id todavía, se reclama para esta cuenta.
export async function buscarInscripcionActual<T extends { id: string }>(
  userId: string,
  metaInscripcionId: string | null | undefined,
  retiroId: string,
  campos: string,
): Promise<T | null> {
  const { data: porUsuario } = await supabase
    .from('servidores_inscripcion')
    .select(campos)
    .eq('usuario_id', userId)
    .eq('retiro_id', retiroId)
    .limit(1)
    .maybeSingle()
  if (porUsuario) return porUsuario as unknown as T

  if (metaInscripcionId) {
    const { data: porMeta } = await supabase
      .from('servidores_inscripcion')
      .select(`${campos}, retiro_id, usuario_id`)
      .eq('id', metaInscripcionId)
      .maybeSingle()
    const fila = porMeta as any
    if (fila && fila.retiro_id === retiroId && (!fila.usuario_id || fila.usuario_id === userId)) {
      if (!fila.usuario_id) {
        await supabase.from('servidores_inscripcion').update({ usuario_id: userId }).eq('id', fila.id)
      }
      return fila as T
    }
  }

  return null
}
