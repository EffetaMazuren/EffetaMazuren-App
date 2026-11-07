import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { verificarLider } from '@/lib/auth-lider'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

const CAMPOS_TEXTO_OBLIGATORIOS = ['nombre', 'fecha_inicio', 'fecha_fin', 'lugar'] as const
const CAMPOS_TEXTO_OPCIONALES = ['link_formulario', 'link_manual'] as const
const CAMPOS_NUMERICOS = [
  'meta_financiera', 'capacidad_caminantes', 'capacidad_servidores',
  'costo_caminante', 'costo_servidor',
] as const

// Edita el retiro activo EN EL MISMO LUGAR -- no archiva nada, no crea
// ningún retiro nuevo (para eso ya existe /api/retiros/nuevo).
//
// Solo se actualizan los campos que vienen en el body, así se puede usar
// tanto desde "Editar retiro actual" (manda todo) como desde el atajo de
// "Precio para servidores internos" en Configuración (manda solo
// costo_servidor).
export async function PATCH(request: NextRequest) {
  try {
    const liderId = await verificarLider(request, supabase)
    if (!liderId) {
      return NextResponse.json({ error: 'Solo los líderes pueden editar el retiro. Vuelve a iniciar sesión.' }, { status: 401 })
    }

    const body = await request.json()
    const cambios: Record<string, string | number> = {}

    const vacios: string[] = []
    for (const campo of CAMPOS_TEXTO_OBLIGATORIOS) {
      if (!(campo in body)) continue
      const valor = String(body[campo] ?? '').trim()
      if (!valor) vacios.push(campo)
      else cambios[campo] = valor
    }
    if (vacios.length > 0) {
      return NextResponse.json({ error: `Faltan datos requeridos: ${vacios.join(', ')}` }, { status: 400 })
    }

    for (const campo of CAMPOS_TEXTO_OPCIONALES) {
      if (campo in body) cambios[campo] = String(body[campo] ?? '').trim()
    }

    for (const campo of CAMPOS_NUMERICOS) {
      if (!(campo in body)) continue
      const n = Number(body[campo])
      if (!Number.isFinite(n) || n < 0) {
        return NextResponse.json({ error: `El valor de ${campo} no es válido.` }, { status: 400 })
      }
      cambios[campo] = n
    }

    if (Object.keys(cambios).length === 0) {
      return NextResponse.json({ error: 'No hay cambios para guardar.' }, { status: 400 })
    }

    const { data: actual } = await supabase
      .from('retiros')
      .select('id')
      .eq('estado', 'activo')
      .maybeSingle()

    if (!actual) {
      return NextResponse.json({ error: 'No hay ningún retiro activo para editar.' }, { status: 400 })
    }

    const { error } = await supabase
      .from('retiros')
      .update(cambios)
      .eq('id', actual.id)

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    return NextResponse.json({ success: true, id: actual.id })
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : 'Error interno' }, { status: 500 })
  }
}
