import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { verificarLider } from '@/lib/auth-lider'
import { puntajeNombre, soloDigitos } from '@/lib/nombres'

// Carga masiva de servidores INTERNOS para el retiro activo.
//
// El líder pega (o sube en un archivo) la lista de nombres -- opcionalmente
// con cédula -- y este endpoint, para cada persona:
//   1. Si ya tiene fila en el retiro activo  → la marca es_interno = true.
//   2. Si solo existe en un retiro anterior  → crea su fila del retiro activo
//      copiando sus datos y su usuario_id (entra con su misma cuenta de antes).
//   3. Si no existe en ningún lado            → crea una fila precargada con
//      el nombre (y la cédula si vino). Cuando la persona se registre en
//      /servidor/registro, esa fila se reclama automáticamente.
//
// Se llama dos veces desde la pantalla:
//   - aplicar = false → solo analiza y devuelve qué haría (vista previa).
//   - aplicar = true  → ejecuta, usando las decisiones del líder en los
//                       casos con varias coincidencias posibles.
//
// Corre con service_role (servidores_inscripcion no permite INSERT desde el
// navegador), por eso exige que quien llama sea líder.

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

type Entrada = { nombre: string; documento?: string | null }

type Candidato = {
  id: string
  nombre: string
  numero_documento: string | null
  retiro_id: string
  retiro_nombre: string
  tiene_cuenta: boolean
  es_interno: boolean
  origen: 'actual' | 'anterior'
}

type Decision = { accion: 'actual' | 'anterior' | 'nuevo' | 'omitir'; id?: string }

type Analisis = {
  indice: number
  nombre: string
  documento: string | null
  estado: 'actual' | 'anterior' | 'nuevo' | 'ambiguo'
  candidato: Candidato | null
  candidatos: Candidato[]
}

// Campos que se copian de la fila de un retiro anterior a la del retiro activo.
const CAMPOS_COPIABLES = [
  'nombre', 'correo', 'numero_documento', 'tipo_documento', 'celular',
  'direccion', 'barrio', 'fecha_nacimiento', 'edad', 'talla_camiseta',
  'sacramentos', 'eps', 'alergias', 'restricciones_alimentarias',
  'medicamentos', 'usuario_id', 'id_persona',
] as const

export async function POST(req: NextRequest) {
  try {
    const liderId = await verificarLider(req, supabase)
    if (!liderId) {
      return NextResponse.json({ error: 'Solo los líderes pueden cargar servidores internos. Vuelve a iniciar sesión.' }, { status: 401 })
    }

    const body = await req.json()
    const entradas: Entrada[] = Array.isArray(body.personas) ? body.personas : []
    const aplicar = body.aplicar === true
    const decisiones: Record<string, Decision> = body.decisiones || {}

    const limpias = entradas
      .map(e => ({ nombre: String(e?.nombre || '').trim(), documento: soloDigitos(String(e?.documento || '')) || null }))
      .filter(e => e.nombre.length > 0)

    if (limpias.length === 0) {
      return NextResponse.json({ error: 'La lista está vacía.' }, { status: 400 })
    }
    if (limpias.length > 500) {
      return NextResponse.json({ error: 'Máximo 500 personas por carga.' }, { status: 400 })
    }

    // ── Retiro activo y todos los servidores (de todos los retiros) ──
    const { data: retiro } = await supabase
      .from('retiros').select('id, nombre').eq('estado', 'activo').maybeSingle()
    if (!retiro) return NextResponse.json({ error: 'No hay un retiro activo.' }, { status: 400 })

    const [{ data: retiros }, { data: filas, error: errFilas }] = await Promise.all([
      supabase.from('retiros').select('id, nombre, fecha_inicio'),
      supabase.from('servidores_inscripcion')
        .select('id, nombre, numero_documento, retiro_id, usuario_id, es_interno, fecha_inscripcion'),
    ])
    if (errFilas) throw new Error(errFilas.message)

    const infoRetiro: Record<string, { nombre: string; fecha: string }> = {}
    for (const r of retiros || []) infoRetiro[r.id] = { nombre: r.nombre, fecha: r.fecha_inicio || '' }

    const aCandidato = (f: any): Candidato => ({
      id: f.id,
      nombre: f.nombre,
      numero_documento: f.numero_documento,
      retiro_id: f.retiro_id,
      retiro_nombre: infoRetiro[f.retiro_id]?.nombre || '—',
      tiene_cuenta: !!f.usuario_id,
      es_interno: !!f.es_interno,
      origen: f.retiro_id === retiro.id ? 'actual' : 'anterior',
    })

    const delActual = (filas || []).filter(f => f.retiro_id === retiro.id)
    const deAnteriores = (filas || []).filter(f => f.retiro_id !== retiro.id)

    // De los retiros anteriores, quedarse con UNA fila por persona (la más
    // reciente, prefiriendo la que tiene cuenta), agrupando por cédula.
    const ordenRetiro = (f: any) => infoRetiro[f.retiro_id]?.fecha || ''
    const porPersona = new Map<string, any>()
    for (const f of deAnteriores) {
      const clave = soloDigitos(f.numero_documento || '') || `nombre:${f.nombre}`
      const previa = porPersona.get(clave)
      const mejor = !previa
        || (!!f.usuario_id && !previa.usuario_id)
        || (!!f.usuario_id === !!previa.usuario_id && ordenRetiro(f) > ordenRetiro(previa))
      if (mejor) porPersona.set(clave, f)
    }
    const anterioresUnicos = [...porPersona.values()]

    // ── Análisis ──
    const analisis: Analisis[] = limpias.map((e, indice) => {
      const base = { indice, nombre: e.nombre, documento: e.documento }

      // 1) Por cédula, si vino
      if (e.documento) {
        const enActual = delActual.find(f => soloDigitos(f.numero_documento || '') === e.documento)
        if (enActual) return { ...base, estado: 'actual', candidato: aCandidato(enActual), candidatos: [] }
        const enAnterior = anterioresUnicos.find(f => soloDigitos(f.numero_documento || '') === e.documento)
        if (enAnterior) return { ...base, estado: 'anterior', candidato: aCandidato(enAnterior), candidatos: [] }
      }

      // 2) Por nombre en el retiro activo
      const enActual = delActual
        .map(f => ({ f, p: puntajeNombre(e.nombre, f.nombre) }))
        .filter(x => x.p > 0)
        .sort((a, b) => b.p - a.p)
      const exactosActual = enActual.filter(x => x.p === 100)
      if (exactosActual.length === 1 || (enActual.length === 1)) {
        const f = (exactosActual[0] || enActual[0]).f
        return { ...base, estado: 'actual', candidato: aCandidato(f), candidatos: [] }
      }

      // 3) Por nombre en retiros anteriores
      const enAnterior = anterioresUnicos
        .map(f => ({ f, p: puntajeNombre(e.nombre, f.nombre) }))
        .filter(x => x.p > 0)
        .sort((a, b) => b.p - a.p)

      if (enActual.length > 1) {
        return {
          ...base, estado: 'ambiguo', candidato: null,
          candidatos: [...enActual.map(x => aCandidato(x.f)), ...enAnterior.map(x => aCandidato(x.f))],
        }
      }

      const exactosAnt = enAnterior.filter(x => x.p === 100)
      if (exactosAnt.length === 1 || enAnterior.length === 1) {
        const f = (exactosAnt[0] || enAnterior[0]).f
        return { ...base, estado: 'anterior', candidato: aCandidato(f), candidatos: [] }
      }
      if (enAnterior.length > 1) {
        return { ...base, estado: 'ambiguo', candidato: null, candidatos: enAnterior.map(x => aCandidato(x.f)) }
      }

      return { ...base, estado: 'nuevo', candidato: null, candidatos: [] }
    })

    if (!aplicar) {
      return NextResponse.json({ success: true, retiro: retiro.nombre, analisis })
    }

    // ── Aplicar ──
    const resultados: { indice: number; nombre: string; ok: boolean; mensaje: string }[] = []
    const yaMarcados = new Set<string>()

    for (const a of analisis) {
      const d: Decision = decisiones[String(a.indice)]
        || (a.estado === 'ambiguo' ? { accion: 'omitir' } : { accion: a.estado, id: a.candidato?.id })

      try {
        if (d.accion === 'omitir') {
          resultados.push({ indice: a.indice, nombre: a.nombre, ok: true, mensaje: 'Omitido' })
          continue
        }

        if (d.accion === 'actual') {
          const fila = delActual.find(f => f.id === d.id)
          if (!fila) throw new Error('No se encontró la fila del retiro actual')
          if (yaMarcados.has(fila.id)) {
            resultados.push({ indice: a.indice, nombre: a.nombre, ok: true, mensaje: 'Repetido en la lista — ya quedó marcado' })
            continue
          }
          const { error } = await supabase.from('servidores_inscripcion').update({ es_interno: true }).eq('id', fila.id)
          if (error) throw new Error(error.message)
          yaMarcados.add(fila.id)
          resultados.push({ indice: a.indice, nombre: a.nombre, ok: true, mensaje: fila.es_interno ? 'Ya era interno' : 'Marcado como interno' })
          continue
        }

        if (d.accion === 'anterior') {
          const { data: origen } = await supabase.from('servidores_inscripcion').select('*').eq('id', d.id!).maybeSingle()
          if (!origen) throw new Error('No se encontró la fila del retiro anterior')

          // Doble verificación anti-duplicados: ¿ya tiene fila en el retiro activo?
          const doc = soloDigitos(origen.numero_documento || '')
          const existente = delActual.find(f =>
            (origen.usuario_id && f.usuario_id === origen.usuario_id) ||
            (doc && soloDigitos(f.numero_documento || '') === doc)
          )
          if (existente) {
            const { error } = await supabase.from('servidores_inscripcion').update({ es_interno: true }).eq('id', existente.id)
            if (error) throw new Error(error.message)
            yaMarcados.add(existente.id)
            resultados.push({ indice: a.indice, nombre: a.nombre, ok: true, mensaje: 'Ya tenía fila en este retiro — marcado como interno' })
            continue
          }

          const nueva: Record<string, any> = {
            retiro_id: retiro.id,
            es_interno: true,
            inscrito_oficialmente: true,
            estado_correo: 'sin_enviar',
            fecha_inscripcion: new Date().toISOString(),
          }
          for (const c of CAMPOS_COPIABLES) if (origen[c] !== undefined) nueva[c] = origen[c]

          const { data: creada, error } = await supabase
            .from('servidores_inscripcion').insert(nueva).select('id, nombre, numero_documento, retiro_id, usuario_id, es_interno').single()
          if (error) throw new Error(error.message)
          delActual.push(creada as any)
          yaMarcados.add(creada.id)

          // Copiar contactos de emergencia (si tenía)
          const { data: contactos } = await supabase
            .from('contactos_emergencia').select('nombre, parentesco, celular, orden')
            .eq('persona_id', origen.id).eq('tipo_persona', 'servidor')
          if (contactos && contactos.length > 0) {
            await supabase.from('contactos_emergencia').insert(
              contactos.map(c => ({ ...c, persona_id: creada.id, tipo_persona: 'servidor' }))
            )
          }

          resultados.push({
            indice: a.indice, nombre: a.nombre, ok: true,
            mensaje: origen.usuario_id
              ? 'Agregado desde un retiro anterior — entra con su misma cuenta'
              : 'Agregado desde un retiro anterior (aún no tiene cuenta)',
          })
          continue
        }

        // d.accion === 'nuevo'
        const { data: creada, error } = await supabase
          .from('servidores_inscripcion')
          .insert({
            retiro_id: retiro.id,
            nombre: a.nombre,
            numero_documento: a.documento,
            es_interno: true,
            inscrito_oficialmente: true,
            estado_correo: 'sin_enviar',
            fecha_inscripcion: new Date().toISOString(),
          })
          .select('id, nombre, numero_documento, retiro_id, usuario_id, es_interno')
          .single()
        if (error) throw new Error(error.message)
        delActual.push(creada as any)
        yaMarcados.add(creada.id)
        resultados.push({ indice: a.indice, nombre: a.nombre, ok: true, mensaje: 'Creado (debe registrarse en la app para tener cuenta)' })
      } catch (err) {
        resultados.push({ indice: a.indice, nombre: a.nombre, ok: false, mensaje: err instanceof Error ? err.message : 'Error' })
      }
    }

    return NextResponse.json({ success: true, retiro: retiro.nombre, resultados })
  } catch (error) {
    console.error('Error en /api/servidores/internos:', error)
    return NextResponse.json({ error: error instanceof Error ? error.message : 'Error interno' }, { status: 500 })
  }
}
