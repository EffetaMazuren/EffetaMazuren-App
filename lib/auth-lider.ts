import { SupabaseClient } from '@supabase/supabase-js'
import { NextRequest } from 'next/server'

// Verifica que la petición venga de una cuenta de líder.
// El navegador debe mandar el header  Authorization: Bearer <access_token>
// (el token de la sesión actual de Supabase). Devuelve el id del usuario
// si es líder, o null si no.
export async function verificarLider(req: NextRequest, admin: SupabaseClient): Promise<string | null> {
  const auth = req.headers.get('authorization') || ''
  const token = auth.startsWith('Bearer ') ? auth.slice(7) : ''
  if (!token) return null

  const { data: { user }, error } = await admin.auth.getUser(token)
  if (error || !user) return null

  const { data: usuario } = await admin
    .from('usuarios')
    .select('rol, es_lider')
    .eq('id', user.id)
    .maybeSingle()

  if (usuario?.rol === 'lider' || usuario?.es_lider === true) return user.id
  return null
}
