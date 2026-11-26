import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { verificarLider } from '@/lib/auth-lider'
import { puntajeNombre } from '@/lib/nombres'

// Importar habitaciones desde el Excel (plantilla "HABITACIONES Y
// ACOMODACIÓN") para el retiro ACTIVO.
//   aplicar = false → solo analiza y devuelve qué haría (vista previa).
//   aplicar = true  → crea/actualiza las habitaciones y asigna a las
//                     personas encontradas (caminantes y servidores).
//
// Las personas se buscan por nombre entre los caminantes y servidores de
// este retiro. Si alguien ya tenía cuarto, se le cambia al del archivo.
// Los nombres que no se encuentran se reportan y no se asignan.
//
// Corre con service_role, por eso exige que quien llama sea líder.

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

type HabEntrada = { bloque: string; numero: string; piso: number; tipo_cama: string; capacidad: number; nombres: string[] }
type Persona = { id: string; nombre: string; tipo: 'caminante' | 'servidor' }
type ResultadoNombre = {
  clave: string
  habitacion: string
  nombreArchivo: string
  estado: 'ok' | 'ambiguo' | 'no_encontrado' | 'repetido'
  persona: Persona | null
  candidatos: Persona[]
  cuartoAnterior: string | null
}

function limpiarHab(h: any): HabEntrada | null {
  const numero = String(h?.numero ?? '').trim()
  if (!numero) return null
  const piso = Number(h?.piso)
  const capacidad = Number(h?.capacidad)
  return {
    numero,
    bloque: String(h?.bloque ?? '').trim() || 'General',
    piso: Number.isInteger(piso) && piso >= 0 && piso <= 20 ? piso : 1,
    tipo_cama: String(h?.tipo_cama ?? '').trim(),
    capacidad: Number.isInteger(capacidad) && capacidad >= 1 && capacidad <= 50 ? capacidad : 1,
    nombres: Array.isArray(h?.nombres) ? h.nombres.map((n: any) => String(n).trim()).filter(Boolean).slice(0, 20) : [],
  }
}

export async function POST(req: NextRequest) {
  try {
    const liderId = await verificarLider(req, supabase)
    if (!liderId) {
      return NextResponse.json({ error: 'Solo los líderes pueden hacer esto. Vuelve a iniciar sesión.' }, { status: 401 })
    }

    const body = await req.json()
    const aplicar = body?.aplicar === true
    const decisiones: Record<string, string> = body?.decisiones || {}
    const entrada: HabEntrada[] = (Array.isArray(body?.habitaciones) ? body.habitaciones : [])
      .map(limpiarHab).filter(Boolean) as HabEntrada[]
    if (entrada.length === 0) return NextResponse.json({ error: 'El archivo no trae habitaciones.' }, { status: 400 })
    if (entrada.length > 500) return NextResponse.json({ error: 'Máximo 500 habitaciones por archivo.' }, { status: 400 })

    const { data: retiro } = await supabase.from('retiros').select('id').eq('estado', 'activo').maybeSingle()
    if (!retiro) return NextResponse.json({ error: 'No hay un retiro activo.' }, { status: 400 })
    const RETIRO_ID = retiro.id

    const [habRes, camRes, srvRes, asigRes] = await Promise.all([
      supabase.from('habitaciones').select('id, numero, bloque, piso, tipo_cama, capacidad').eq('retiro_id', RETIRO_ID),
      supabase.from('caminantes').select('id, nombre').eq('retiro_id', RETIRO_ID).range(0, 4999),
      supabase.from('servidores_inscripcion').select('id, nombre').eq('retiro_id', RETIRO_ID).range(0, 4999),
      supabase.from('asignaciones_habitacion').select('id, habitacion_id, persona_id').eq('retiro_id', RETIRO_ID).range(0, 4999),
    ])
    for (const r of [habRes, camRes, srvRes, asigRes]) if (r.error) throw new Error(r.error.message)

    const existentes = habRes.data || []
    const porNumero = new Map(existentes.map(h => [String(h.numero).trim(), h]))
    const numeroPorHabId = new Map(existentes.map(h => [h.id, String(h.numero)]))
    const personas: Persona[] = [
      ...(camRes.data || []).map(c => ({ id: c.id, nombre: (c.nombre || '').trim(), tipo: 'caminante' as const })),
      ...(srvRes.data || []).map(s => ({ id: s.id, nombre: (s.nombre || '').trim(), tipo: 'servidor' as const })),
    ]
    const asigPorPersona = new Map((asigRes.data || []).map(a => [a.persona_id, a]))

    // ── Analizar nombres ──
    const resultados: ResultadoNombre[] = []
    const yaAsignadas = new Map<string, string>() // persona_id → habitación del archivo
    for (const h of entrada) {
      for (const nombreArchivo of h.nombres) {
        const clave = `${h.numero}|${nombreArchivo}`
        const puntuados = personas
          .map(p => ({ p, s: puntajeNombre(nombreArchivo, p.nombre) }))
          .filter(x => x.s > 0)
          .sort((a, b) => b.s - a.s)
        const exactos = puntuados.filter(x => x.s === 100)

        let persona: Persona | null = null
        let estado: ResultadoNombre['estado'] = 'no_encontrado'
        const decidida = decisiones[clave]
        if (decidida) {
          persona = personas.find(p => p.id === decidida) || null
          estado = persona ? 'ok' : 'no_encontrado'
        } else if (exactos.length === 1 || puntuados.length === 1) {
          persona = (exactos[0] || puntuados[0]).p
          estado = 'ok'
        } else if (puntuados.length > 1) {
          estado = 'ambiguo'
        }

        if (persona && yaAsignadas.has(persona.id)) {
          estado = 'repetido'
        }
        if (persona && estado === 'ok') yaAsignadas.set(persona.id, h.numero)

        const anterior = persona ? asigPorPersona.get(persona.id) : undefined
        resultados.push({
          clave,
          habitacion: h.numero,
          nombreArchivo,
          estado,
          persona,
          candidatos: estado === 'ambiguo' ? puntuados.slice(0, 6).map(x => x.p) : [],
          cuartoAnterior: anterior ? (numeroPorHabId.get(anterior.habitacion_id) ?? null) : null,
        })
      }
    }

    const resumenHabs = entrada.map(h => {
      const ex = porNumero.get(h.numero)
      return { numero: h.numero, bloque: h.bloque, tipo_cama: h.tipo_cama, nueva: !ex, personas: h.nombres.length }
    })

    if (!aplicar) {
      return NextResponse.json({ success: true, habitaciones: resumenHabs, personas: resultados })
    }

    // ── Aplicar ──
    let creadas = 0, actualizadas = 0, asignadas = 0, movidas = 0
    const errores: string[] = []
    const idPorNumero = new Map<string, string>()

    for (const h of entrada) {
      const okAqui = resultados.filter(r => r.habitacion === h.numero && r.estado === 'ok').length
      const ex = porNumero.get(h.numero)
      if (ex) {
        const { error } = await supabase.from('habitaciones').update({
          bloque: h.bloque,
          piso: h.piso,
          tipo_cama: h.tipo_cama || ex.tipo_cama,
          capacidad: Math.max(Number(ex.capacidad) || 1, h.capacidad, okAqui),
        }).eq('id', ex.id)
        if (error) { errores.push(`Hab. ${h.numero}: ${error.message}`); continue }
        idPorNumero.set(h.numero, ex.id)
        actualizadas++
      } else {
        const { data: nueva, error } = await supabase.from('habitaciones').insert({
          retiro_id: RETIRO_ID,
          numero: h.numero,
          piso: h.piso,
          bloque: h.bloque,
          tipo_cama: h.tipo_cama,
          capacidad: Math.max(h.capacidad, okAqui, 1),
          solo_servidores: false,
        }).select('id').single()
        if (error) { errores.push(`Hab. ${h.numero}: ${error.message}`); continue }
        idPorNumero.set(h.numero, nueva.id)
        creadas++
      }
    }

    for (const r of resultados) {
      if (r.estado !== 'ok' || !r.persona) continue
      const habId = idPorNumero.get(r.habitacion)
      if (!habId) continue
      const anterior = asigPorPersona.get(r.persona.id)
      if (anterior && anterior.habitacion_id === habId) continue // ya estaba ahí
      if (anterior) {
        const { error } = await supabase.from('asignaciones_habitacion').delete().eq('id', anterior.id)
        if (error) { errores.push(`${r.persona.nombre}: ${error.message}`); continue }
        movidas++
      }
      const { error } = await supabase.from('asignaciones_habitacion').insert({
        habitacion_id: habId,
        persona_id: r.persona.id,
        tipo_persona: r.persona.tipo,
        nombre: r.persona.nombre,
        retiro_id: RETIRO_ID,
      })
      if (error) { errores.push(`${r.persona.nombre}: ${error.message}`); continue }
      asignadas++
    }

    return NextResponse.json({ success: true, creadas, actualizadas, asignadas, movidas, errores })
  } catch (error) {
    console.error('Error en /api/lider/habitaciones/importar:', error)
    return NextResponse.json({ error: error instanceof Error ? error.message : 'Error interno' }, { status: 500 })
  }
}
