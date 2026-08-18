
import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
 
export async function POST(req: NextRequest) {
  try {
    // Crear cliente dentro del handler para evitar errores en build
    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
    )
 
    const data = await req.json()
 
    // Obtener retiro activo
    const { data: retiro } = await supabase
      .from('retiros').select('id').eq('estado', 'activo').single()
 
    if (!retiro) {
      return NextResponse.json({ error: 'No hay retiro activo' }, { status: 400 })
    }
 
    // Verificar cupo
    const { data: cupos } = await supabase
      .from('vista_cupos').select('cupo_lleno').eq('retiro_id', retiro.id).single()
 
    if (cupos?.cupo_lleno) {
      return NextResponse.json({ error: 'Cupo lleno' }, { status: 409 })
    }
 
    // Verificar duplicado
    const { data: existente } = await supabase
      .from('caminantes').select('id')
      .eq('numero_documento', data.numero_documento)
      .eq('retiro_id', retiro.id).single()
 
    if (existente) {
      return NextResponse.json({ error: 'Ya registrado' }, { status: 409 })
    }
 
    // Formatear fecha DD/MM/YYYY → YYYY-MM-DD
    let fecha_nacimiento = null
    if (data.fecha_nacimiento) {
      const p = data.fecha_nacimiento.split('/')
      if (p.length === 3) {
        fecha_nacimiento = `${p[2]}-${p[1].padStart(2,'0')}-${p[0].padStart(2,'0')}`
      }
    }
 
    const sacramentos = data.sacramentos
      ? data.sacramentos.split(', ').map((s: string) => s.trim()).filter(Boolean)
      : []
 
    // Insertar caminante
    const { data: nuevo, error: errorCam } = await supabase
      .from('caminantes')
      .insert({
        retiro_id: retiro.id,
        nombre: data.nombre?.trim(),
        tipo_documento: data.tipo_documento || 'C.C.',
        numero_documento: data.numero_documento?.trim(),
        celular: data.celular?.trim(),
        correo: data.correo?.trim(),
        direccion: data.direccion?.trim(),
        barrio: data.barrio?.trim(),
        telefono_fijo: data.telefono_fijo?.trim() || null,
        fecha_nacimiento,
        edad: data.edad || null,
        talla_camiseta: data.talla_camiseta?.trim() || null,
        sacramentos,
        eps: data.eps?.trim() || null,
        alergias: data.alergias?.trim() || null,
        restricciones_alimentarias: data.restricciones_alimentarias?.trim() || null,
        medicamentos: data.medicamentos?.trim() || null,
        es_sorpresa: data.es_sorpresa || false,
        observaciones: data.observaciones?.trim() || null,
        estado_correo: 'sin_enviar',
        inscrito_oficialmente: false,
      })
      .select().single()
 
    if (errorCam) return NextResponse.json({ error: errorCam.message }, { status: 500 })
 
    // Contacto 1
    if (data.contacto1_nombre?.trim()) {
      await supabase.from('contactos_emergencia').insert({
        persona_id: nuevo.id, tipo_persona: 'caminante',
        nombre: data.contacto1_nombre.trim(),
        parentesco: data.contacto1_parentesco?.trim() || null,
        celular: data.contacto1_celular?.trim() || null,
        orden: 1,
      })
    }
 
    // Contacto 2
    if (data.contacto2_nombre?.trim()) {
      await supabase.from('contactos_emergencia').insert({
        persona_id: nuevo.id, tipo_persona: 'caminante',
        nombre: data.contacto2_nombre.trim(),
        parentesco: data.contacto2_parentesco?.trim() || null,
        celular: data.contacto2_celular?.trim() || null,
        orden: 2,
      })
    }
 
    return NextResponse.json({ ok: true, id: nuevo.id, nombre: nuevo.nombre })
 
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}
 
