'use client'

import { useEffect, useMemo, useState } from 'react'
import { supabase } from '@/lib/supabase'
import { useRetiroActual } from '@/lib/retiro-context'
import { normalizarNombre, puntajeNombre } from '@/lib/nombres'

// ─────────────────────────────────────────────────────────────────────────────
// Carga masiva de los roles del fin de semana (roles_retiro) + interruptor de
// visibilidad para los servidores. Va arriba de la pestaña Roles en
// dashboard/retiro.
//
// Acepta lo que se copia directo de Excel/Sheets, en cualquiera de los 2 formatos:
//   A) Rol | N° de personas | Personas        (un rol por fila)
//   B) Nombre | N° de roles | Roles           (un servidor por fila)
// ─────────────────────────────────────────────────────────────────────────────

// IMPORTANTE: misma regla que usa la app del servidor (servidor/retiro/page.tsx)
// para saber si un rol es suyo. Si un nombre pasa aquí, el servidor lo verá.
function norm(s: string) {
  return s.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').trim()
}
function tokensOf(s: string): string[] {
  return norm(s).split(' ').filter(t => t.length > 2)
}
function nombreMatch(a: string, b: string): boolean {
  const nA = norm(a), nB = norm(b)
  if (nA === nB) return true
  const tA = tokensOf(a), tB = tokensOf(b)
  if (tA.filter(t => tB.includes(t)).length >= 3) return true
  if (tA.length >= 3 && tB.length >= 3 && tB.includes(tA[0]) && tA.slice(1).filter(t => tB.includes(t)).length >= 2) return true
  return false
}

// ── Lectura del texto pegado (TSV con celdas entre comillas de varias líneas) ──
function parsearTSV(texto: string): string[][] {
  const filas: string[][] = []
  let fila: string[] = []
  let celda = ''
  let enComillas = false
  const t = texto.replace(/\r\n?/g, '\n')
  for (let i = 0; i < t.length; i++) {
    const ch = t[i]
    if (enComillas) {
      if (ch === '"') {
        if (t[i + 1] === '"') { celda += '"'; i++ } else enComillas = false
      } else celda += ch
    } else if (ch === '"' && celda.trim() === '') {
      enComillas = true; celda = ''
    } else if (ch === '\t') {
      fila.push(celda); celda = ''
    } else if (ch === '\n') {
      fila.push(celda); filas.push(fila); fila = []; celda = ''
    } else celda += ch
  }
  fila.push(celda); filas.push(fila)
  return filas.filter(f => f.some(c => c.trim() !== ''))
}

const esNumero = (s: string) => /^\s*\d+\s*$/.test(s)
const partirLista = (s: string) => s.split(/[,;\n]/).map(x => x.trim()).filter(Boolean)
const categoriaDe = (rol: string) => (/^mesa\s*\d+/i.test(rol.trim()) ? 'Mesas' : 'General')
const capitalizar = (s: string) => (s ? s.charAt(0).toUpperCase() + s.slice(1) : s)

type RolCrudo = { rol: string; categoria: string; personas: string[] }
type Formato = 'rol' | 'persona'

function interpretar(texto: string): { roles: RolCrudo[]; formato: Formato } {
  const filas = parsearTSV(texto)
  if (filas.length === 0) return { roles: [], formato: 'rol' }

  const enc = normalizarNombre(filas[0][0] || '')
  let formato: Formato = 'rol'
  let datos = filas
  if (enc === 'rol' || enc === 'roles') { datos = filas.slice(1) }
  else if (enc === 'nombre' || enc === 'nombres' || enc === 'servidor' || enc === 'servidores') { formato = 'persona'; datos = filas.slice(1) }

  // Lo que va después de la primera columna, sin la columna de conteo
  const resto = (f: string[]) => f.slice(1).filter(c => c.trim() !== '' && !esNumero(c)).join(',')

  if (formato === 'rol') {
    const mapa = new Map<string, RolCrudo>()
    for (const f of datos) {
      const rol = (f[0] || '').trim()
      if (!rol) continue
      const clave = normalizarNombre(rol)
      const existente = mapa.get(clave) ?? { rol: capitalizar(rol), categoria: categoriaDe(rol), personas: [] }
      existente.personas.push(...partirLista(resto(f)))
      mapa.set(clave, existente)
    }
    return { roles: [...mapa.values()], formato }
  }

  // Formato persona → se invierte a un rol por fila
  const mapa = new Map<string, RolCrudo>()
  for (const f of datos) {
    const persona = (f[0] || '').trim()
    if (!persona) continue
    for (const r of partirLista(resto(f))) {
      const clave = normalizarNombre(r)
      const existente = mapa.get(clave) ?? { rol: capitalizar(r), categoria: categoriaDe(r), personas: [] }
      existente.personas.push(persona)
      mapa.set(clave, existente)
    }
  }
  return { roles: [...mapa.values()], formato }
}

// Separa "Juan Pablo Cardona (líder)" → nombre "Juan Pablo Cardona", anotación "(líder)"
function separarAnotacion(s: string): { limpio: string; anotacion: string } {
  const anot = (s.match(/\([^)]*\)/g) || []).join(' ')
  const limpio = s.replace(/\([^)]*\)/g, '').replace(/\s+/g, ' ').replace(/[.,;:]+$/, '').trim()
  return { limpio, anotacion: anot }
}

type Estado = 'ok' | 'auto' | 'revisar'
type Resolucion = { estado: Estado; resuelto: string | null; candidatos: string[] }

function resolverNombre(limpio: string, servidores: string[]): Resolucion {
  const exactos = servidores.filter(s => nombreMatch(s, limpio))
  if (exactos.length === 1) return { estado: 'ok', resuelto: exactos[0], candidatos: exactos }

  const parecidos = servidores.filter(s => puntajeNombre(limpio, s) >= 80)
  if (exactos.length === 0 && parecidos.length === 1) return { estado: 'auto', resuelto: parecidos[0], candidatos: parecidos }

  // Sugerencias: comparten alguna palabra o una empieza por la otra (Santi → Santiago)
  const tL = normalizarNombre(limpio).split(' ').filter(t => t.length > 2)
  const sugeridos = servidores.filter(s => {
    const tS = normalizarNombre(s).split(' ')
    return tL.some(a => tS.some(b => a === b || (a.length >= 4 && b.startsWith(a)) || (b.length >= 4 && a.startsWith(b))))
  })
  // Primero los que comparten más palabras completas ("Santi florian" → Santiago Florian)
  const comunes = (s: string) => {
    const tS = normalizarNombre(s).split(' ')
    return tL.filter(a => tS.includes(a)).length
  }
  const candidatos = [...new Set([...exactos, ...parecidos, ...sugeridos])].sort((a, b) => comunes(b) - comunes(a))
  return { estado: 'revisar', resuelto: null, candidatos }
}

const QUITAR = '__quitar__'
const DEJAR = '__dejar__'

export default function CargarRolesRetiro({ rolesActuales, onSincronizado }: { rolesActuales: number; onSincronizado: () => void }) {
  const { id: RETIRO_ID } = useRetiroActual()

  const [visibles, setVisibles] = useState<boolean | null>(null)
  const [cambiandoVis, setCambiandoVis] = useState(false)

  const [abierto, setAbierto] = useState(false)
  const [texto, setTexto] = useState('')
  const [servidores, setServidores] = useState<string[]>([])
  const [preview, setPreview] = useState<{ roles: RolCrudo[]; formato: Formato } | null>(null)
  // Decisión manual del líder por nombre escrito (clave = nombre normalizado)
  const [manual, setManual] = useState<Record<string, string>>({})
  const [guardando, setGuardando] = useState(false)
  const [mensaje, setMensaje] = useState<{ tipo: 'ok' | 'error'; texto: string } | null>(null)
  const [verSinRol, setVerSinRol] = useState(false)

  useEffect(() => {
    supabase.from('retiros').select('roles_visibles').eq('id', RETIRO_ID).maybeSingle()
      .then(({ data }) => setVisibles(!!data?.roles_visibles))
  }, [RETIRO_ID])

  useEffect(() => {
    if (!abierto || servidores.length > 0) return
    supabase.from('servidores_inscripcion').select('nombre').eq('retiro_id', RETIRO_ID).order('nombre')
      .then(({ data }) => setServidores((data || []).map((s: any) => (s.nombre || '').trim()).filter(Boolean)))
  }, [abierto, RETIRO_ID, servidores.length])

  async function token() {
    const { data: { session } } = await supabase.auth.getSession()
    return session?.access_token ?? ''
  }

  async function cambiarVisibilidad() {
    if (visibles === null) return
    const nuevo = !visibles
    const pregunta = nuevo
      ? 'Cada servidor va a ver sus roles en la app desde ya. ¿Publicar los roles?'
      : '¿Ocultar los roles? Los servidores dejarán de verlos en su app.'
    if (!confirm(pregunta)) return
    setCambiandoVis(true)
    try {
      const res = await fetch('/api/lider/roles-retiro', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${await token()}` },
        body: JSON.stringify({ visibles: nuevo }),
      })
      const data = await res.json()
      if (!data.success) throw new Error(data.error || 'No se pudo cambiar la visibilidad')
      setVisibles(nuevo)
    } catch (err: any) {
      alert(err.message || 'Error cambiando la visibilidad')
    } finally {
      setCambiandoVis(false)
    }
  }

  // Resolución de cada nombre único escrito en la lista
  const resoluciones = useMemo(() => {
    const mapa: Record<string, { original: string; limpio: string; res: Resolucion; roles: number }> = {}
    if (!preview) return mapa
    for (const r of preview.roles) {
      for (const p of r.personas) {
        const { limpio } = separarAnotacion(p)
        if (!limpio) continue
        const clave = normalizarNombre(limpio)
        if (!mapa[clave]) mapa[clave] = { original: limpio, limpio, res: resolverNombre(limpio, servidores), roles: 0 }
        mapa[clave].roles++
      }
    }
    return mapa
  }, [preview, servidores])

  // Nombre final que se guarda para una persona escrita en la lista (null = quitarla)
  function nombreFinal(escrito: string): { nombre: string | null; estado: Estado | 'manual' | 'dejar' } {
    const { limpio, anotacion } = separarAnotacion(escrito)
    const clave = normalizarNombre(limpio)
    const info = resoluciones[clave]
    const decision = manual[clave]
    const con = (n: string) => (anotacion ? `${n} ${anotacion}` : n)
    if (decision === QUITAR) return { nombre: null, estado: 'manual' }
    if (decision === DEJAR) return { nombre: con(limpio), estado: 'dejar' }
    if (decision) return { nombre: con(decision), estado: 'manual' }
    if (info?.res.resuelto) return { nombre: con(info.res.resuelto), estado: info.res.estado }
    return { nombre: con(limpio), estado: 'revisar' }
  }

  const rolesFinales = useMemo(() => {
    if (!preview) return []
    return preview.roles.map(r => {
      const vistos = new Set<string>()
      const personas: { escrito: string; nombre: string; estado: string }[] = []
      for (const p of r.personas) {
        const f = nombreFinal(p)
        if (!f.nombre) continue
        const k = normalizarNombre(separarAnotacion(f.nombre).limpio)
        if (vistos.has(k)) continue
        vistos.add(k)
        personas.push({ escrito: p, nombre: f.nombre, estado: f.estado })
      }
      return { rol: r.rol, categoria: r.categoria, personas }
    })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [preview, resoluciones, manual])

  const porRevisar = Object.entries(resoluciones).filter(([clave, v]) => v.res.estado === 'revisar' && !manual[clave])
  const conDecision = Object.entries(resoluciones).filter(([clave, v]) => v.res.estado === 'revisar' && manual[clave])
  const autoCorregidos = Object.values(resoluciones).filter(v => v.res.estado === 'auto' && normalizarNombre(v.res.resuelto || '') !== normalizarNombre(v.limpio))

  const servidoresSinRol = useMemo(() => {
    if (!preview) return []
    const asignados = rolesFinales.flatMap(r => r.personas.map(p => separarAnotacion(p.nombre).limpio))
    return servidores.filter(s => !asignados.some(a => nombreMatch(s, a)))
  }, [rolesFinales, servidores, preview])

  function verPrevia() {
    setMensaje(null)
    setManual({})
    const resultado = interpretar(texto)
    if (resultado.roles.length === 0) {
      setMensaje({ tipo: 'error', texto: 'No encontré roles en lo que pegaste. Copia las celdas desde Excel o Sheets, incluyendo los encabezados.' })
      setPreview(null)
      return
    }
    setPreview(resultado)
  }

  async function sincronizar() {
    if (!preview) return
    const aviso = porRevisar.length > 0
      ? `\n\nOjo: ${porRevisar.length} nombre(s) siguen en naranja. Esas personas NO verán sus roles hasta que se corrijan.`
      : ''
    if (!confirm(`Esto reemplaza los ${rolesActuales} roles actuales por los ${rolesFinales.length} de la lista.${aviso}\n\n¿Continuar?`)) return
    setGuardando(true)
    setMensaje(null)
    try {
      const res = await fetch('/api/lider/roles-retiro', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${await token()}` },
        body: JSON.stringify({
          roles: rolesFinales.map(r => ({ rol: r.rol, categoria: r.categoria, encargados: r.personas.map(p => p.nombre) })),
        }),
      })
      const data = await res.json()
      if (!data.success) throw new Error(data.error || 'No se pudo guardar')
      setMensaje({ tipo: 'ok', texto: `${data.total} roles sincronizados.${visibles ? ' Los servidores ya los están viendo.' : ' Siguen ocultos para los servidores hasta que los publiques.'}` })
      setPreview(null); setTexto(''); setManual({}); setAbierto(false)
      onSincronizado()
    } catch (err: any) {
      setMensaje({ tipo: 'error', texto: err.message || 'Error guardando' })
    } finally {
      setGuardando(false)
    }
  }

  const colorChip = (estado: string) =>
    estado === 'revisar' || estado === 'dejar'
      ? { bg: '#fff7ed', color: '#c2410c', border: '#fed7aa' }
      : { bg: '#f0fdf4', color: '#15803d', border: '#bbf7d0' }

  return (
    <div style={{ marginBottom: 16, display: 'flex', flexDirection: 'column', gap: 12 }}>
      {/* ── Interruptor de visibilidad ── */}
      <div style={{ background: visibles ? '#f0fdf4' : '#fffbeb', border: `1.5px solid ${visibles ? '#bbf7d0' : '#fde68a'}`, borderRadius: 12, padding: '12px 14px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10 }}>
        <div>
          <p style={{ margin: 0, fontSize: 13, fontWeight: 700, color: visibles ? '#15803d' : '#92400e' }}>
            {visibles === null ? 'Cargando…' : visibles ? '👁 Visibles para los servidores' : '🔒 Ocultos para los servidores'}
          </p>
          <p style={{ margin: '2px 0 0', fontSize: 11, color: visibles ? '#16a34a' : '#b45309' }}>
            {visibles ? 'Cada servidor ve sus roles en la pantalla Retiro de su app.' : 'Puedes cargar y corregir los roles; nadie los ve hasta que los publiques.'}
          </p>
        </div>
        <button onClick={cambiarVisibilidad} disabled={visibles === null || cambiandoVis}
          style={{ padding: '8px 12px', borderRadius: 8, border: 'none', cursor: 'pointer', fontSize: 12, fontWeight: 700, flexShrink: 0, background: visibles ? '#fef2f2' : '#0f1787', color: visibles ? '#dc2626' : 'white' }}>
          {cambiandoVis ? '…' : visibles ? 'Ocultar' : 'Publicar'}
        </button>
      </div>

      {mensaje && (
        <div style={{ background: mensaje.tipo === 'ok' ? '#f0fdf4' : '#fef2f2', border: `1px solid ${mensaje.tipo === 'ok' ? '#bbf7d0' : '#fecaca'}`, borderRadius: 8, padding: '8px 14px', fontSize: 13, color: mensaje.tipo === 'ok' ? '#16a34a' : '#dc2626' }}>
          {mensaje.tipo === 'ok' ? '✓ ' : ''}{mensaje.texto}
        </div>
      )}

      {/* ── Carga masiva ── */}
      {!abierto ? (
        <button onClick={() => setAbierto(true)} style={{ width: '100%', padding: '10px', background: 'white', color: '#0f1787', border: '1.5px solid #c7d0ff', borderRadius: 10, fontSize: 13, fontWeight: 600, cursor: 'pointer' }}>
          📋 Cargar lista desde Excel / Sheets
        </button>
      ) : (
        <div style={{ background: 'white', border: '1.5px solid #c7d0ff', borderRadius: 12, padding: 16 }}>
          <p style={{ fontSize: 13, fontWeight: 700, color: '#0f1787', margin: '0 0 4px' }}>Cargar lista de roles</p>
          <p style={{ fontSize: 12, color: '#6b7280', margin: '0 0 10px', lineHeight: 1.5 }}>
            Selecciona las celdas en Excel o Sheets <b>con los encabezados</b>, cópialas y pégalas aquí. Sirve tanto <i>Rol · N° · Personas</i> como <i>Nombre · N° · Roles</i>.
          </p>
          <textarea value={texto} onChange={e => { setTexto(e.target.value); setPreview(null) }} rows={6} placeholder={'Rol\tN° de personas\tPersonas\nMúsica\t2\tValentina Baquero, Nicolás Rivera'}
            style={{ width: '100%', padding: '8px 10px', border: '1.5px solid #e8eaf0', borderRadius: 8, fontSize: 12, outline: 'none', boxSizing: 'border-box', fontFamily: 'monospace', resize: 'vertical' }} />
          <div style={{ display: 'flex', gap: 8, marginTop: 10 }}>
            <button onClick={verPrevia} disabled={!texto.trim()} style={{ flex: 1, padding: 10, background: texto.trim() ? '#f0f2ff' : '#f3f4f6', color: texto.trim() ? '#0f1787' : '#9ca3af', border: '1.5px solid #c7d0ff', borderRadius: 10, fontSize: 13, fontWeight: 600, cursor: 'pointer' }}>
              Vista previa
            </button>
            <button onClick={() => { setAbierto(false); setTexto(''); setPreview(null); setManual({}) }} style={{ padding: '10px 14px', background: '#f3f4f6', color: '#374151', border: 'none', borderRadius: 10, fontSize: 13, cursor: 'pointer' }}>
              Cancelar
            </button>
          </div>

          {preview && (
            <div style={{ marginTop: 16 }}>
              {/* Resumen */}
              <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 12 }}>
                <span style={{ fontSize: 11, background: '#f0f2ff', color: '#0f1787', padding: '4px 10px', borderRadius: 20, fontWeight: 700 }}>{rolesFinales.length} roles</span>
                <span style={{ fontSize: 11, background: '#f0fdf4', color: '#15803d', padding: '4px 10px', borderRadius: 20, fontWeight: 700 }}>{Object.keys(resoluciones).length - porRevisar.length} nombres reconocidos</span>
                {porRevisar.length > 0 && <span style={{ fontSize: 11, background: '#fff7ed', color: '#c2410c', padding: '4px 10px', borderRadius: 20, fontWeight: 700 }}>{porRevisar.length} por revisar</span>}
                <span style={{ fontSize: 11, color: '#9ca3af', padding: '4px 0' }}>Formato: {preview.formato === 'rol' ? 'un rol por fila' : 'un servidor por fila'}</span>
              </div>

              {/* Nombres por revisar */}
              {(porRevisar.length > 0 || conDecision.length > 0) && (
                <div style={{ background: '#fff7ed', border: '1px solid #fed7aa', borderRadius: 10, padding: 12, marginBottom: 12 }}>
                  <p style={{ fontSize: 12, fontWeight: 700, color: '#c2410c', margin: '0 0 4px' }}>Nombres que no coinciden con ningún servidor inscrito</p>
                  <p style={{ fontSize: 11, color: '#9a3412', margin: '0 0 10px', lineHeight: 1.5 }}>
                    Elige a quién se refieren. Se corrige en todos los roles donde aparezca. Si no eliges, esa persona no verá sus roles (déjalo así solo si es un adulto o alguien sin app).
                  </p>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                    {[...porRevisar, ...conDecision].map(([clave, v]) => (
                      <div key={clave} style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                        <span style={{ fontSize: 13, fontWeight: 600, color: '#111827', minWidth: 110 }}>
                          “{v.original}” <span style={{ fontSize: 10, color: '#9ca3af', fontWeight: 400 }}>({v.roles} rol{v.roles !== 1 ? 'es' : ''})</span>
                        </span>
                        <select value={manual[clave] || ''} onChange={e => setManual(prev => ({ ...prev, [clave]: e.target.value }))}
                          style={{ flex: 1, minWidth: 180, padding: '6px 8px', border: `1.5px solid ${manual[clave] ? '#bbf7d0' : '#fed7aa'}`, borderRadius: 8, fontSize: 12, background: 'white', fontFamily: 'inherit' }}>
                          <option value="">— Elegir servidor —</option>
                          {v.res.candidatos.length > 0 && (
                            <optgroup label="Sugeridos">
                              {v.res.candidatos.map(c => <option key={'s' + c} value={c}>{c}</option>)}
                            </optgroup>
                          )}
                          <optgroup label="Todos los servidores">
                            {servidores.map(s => <option key={'t' + s} value={s}>{s}</option>)}
                          </optgroup>
                          <optgroup label="Otras opciones">
                            <option value={DEJAR}>Dejar el nombre tal cual (no es servidor)</option>
                            <option value={QUITAR}>Quitarlo de la lista</option>
                          </optgroup>
                        </select>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Correcciones automáticas */}
              {autoCorregidos.length > 0 && (
                <details style={{ marginBottom: 12 }}>
                  <summary style={{ fontSize: 12, color: '#15803d', cursor: 'pointer', fontWeight: 600 }}>
                    {autoCorregidos.length} nombre{autoCorregidos.length !== 1 ? 's' : ''} completado{autoCorregidos.length !== 1 ? 's' : ''} automáticamente
                  </summary>
                  <div style={{ marginTop: 6, display: 'flex', flexDirection: 'column', gap: 3 }}>
                    {autoCorregidos.map(v => (
                      <span key={v.limpio} style={{ fontSize: 12, color: '#374151' }}>{v.limpio} → <b>{v.res.resuelto}</b></span>
                    ))}
                  </div>
                </details>
              )}

              {/* Servidores sin rol */}
              {servidoresSinRol.length > 0 && (
                <div style={{ marginBottom: 12 }}>
                  <button onClick={() => setVerSinRol(v => !v)} style={{ background: 'none', border: 'none', padding: 0, fontSize: 12, color: '#6b7280', cursor: 'pointer', fontWeight: 600 }}>
                    {verSinRol ? '▾' : '▸'} {servidoresSinRol.length} servidor{servidoresSinRol.length !== 1 ? 'es' : ''} inscrito{servidoresSinRol.length !== 1 ? 's' : ''} sin ningún rol
                  </button>
                  {verSinRol && (
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4, marginTop: 6 }}>
                      {servidoresSinRol.map(s => <span key={s} style={{ fontSize: 11, background: '#f3f4f6', color: '#374151', padding: '2px 8px', borderRadius: 20 }}>{s}</span>)}
                    </div>
                  )}
                </div>
              )}

              {/* Lista de roles */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: 6, maxHeight: 420, overflowY: 'auto', paddingRight: 4 }}>
                {rolesFinales.map((r, i) => (
                  <div key={i} style={{ background: '#f7f8fc', borderRadius: 8, padding: '8px 12px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 5 }}>
                      <span style={{ fontSize: 13, fontWeight: 700, color: '#111827' }}>{r.rol}</span>
                      {r.categoria !== 'General' && <span style={{ fontSize: 10, background: '#e8eaf0', color: '#374151', padding: '1px 7px', borderRadius: 20 }}>{r.categoria}</span>}
                      <span style={{ fontSize: 10, color: '#9ca3af', marginLeft: 'auto' }}>{r.personas.length}</span>
                    </div>
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4 }}>
                      {r.personas.map((p, j) => {
                        const c = colorChip(p.estado)
                        return <span key={j} style={{ fontSize: 11, background: c.bg, color: c.color, border: `1px solid ${c.border}`, padding: '2px 8px', borderRadius: 20 }}>{p.nombre}</span>
                      })}
                      {r.personas.length === 0 && <span style={{ fontSize: 11, color: '#9ca3af', fontStyle: 'italic' }}>Sin personas</span>}
                    </div>
                  </div>
                ))}
              </div>

              <button onClick={sincronizar} disabled={guardando}
                style={{ width: '100%', marginTop: 12, padding: 12, background: guardando ? '#9ca3af' : '#0f1787', color: 'white', border: 'none', borderRadius: 10, fontSize: 14, fontWeight: 700, cursor: 'pointer' }}>
                {guardando ? 'Sincronizando…' : `Sincronizar ${rolesFinales.length} roles`}
              </button>
              <p style={{ fontSize: 11, color: '#9ca3af', textAlign: 'center', margin: '6px 0 0' }}>
                Reemplaza todos los roles actuales del retiro. {visibles ? 'Los servidores los verán de inmediato.' : 'Quedan ocultos hasta que los publiques.'}
              </p>
            </div>
          )}
        </div>
      )}
    </div>
  )
}
