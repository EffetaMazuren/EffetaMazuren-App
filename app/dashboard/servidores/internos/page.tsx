'use client'
import { useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'
import { useRetiroActual } from '@/lib/retiro-context'
import { ChevronLeft, Upload, Info, Check, AlertTriangle, UserPlus, History, HelpCircle } from 'lucide-react'

type Candidato = {
  id: string
  nombre: string
  numero_documento: string | null
  retiro_nombre: string
  tiene_cuenta: boolean
  es_interno: boolean
  origen: 'actual' | 'anterior'
}

type Analisis = {
  indice: number
  nombre: string
  documento: string | null
  estado: 'actual' | 'anterior' | 'nuevo' | 'ambiguo'
  candidato: Candidato | null
  candidatos: Candidato[]
}

type Resultado = { indice: number; nombre: string; ok: boolean; mensaje: string }

// Cada valor del selector: "omitir", "nuevo", o "<origen>:<id>"
type Eleccion = string

// Convierte el texto pegado (o el contenido del archivo) en una lista de
// { nombre, documento }. Acepta:
//   - un nombre por línea
//   - "Nombre, cédula"  /  "Nombre;cédula"  /  "Nombre<TAB>cédula" (copiado de Excel)
//   - "cédula Nombre", líneas numeradas ("1. Nombre"), y una fila de títulos
function parsearLista(texto: string): { nombre: string; documento: string | null }[] {
  const salida: { nombre: string; documento: string | null }[] = []
  for (let linea of texto.split(/\r?\n/)) {
    linea = linea.replace(/^﻿/, '').trim()
    if (!linea) continue
    // Fila de títulos de un CSV/Excel
    if (/^"?\s*nombre/i.test(linea) && salida.length === 0) continue

    // Cédula: un grupo de 6 a 12 dígitos (con o sin puntos)
    let documento: string | null = null
    const m = linea.match(/(?:^|[\s,;\t"])(\d{1,3}(?:\.\d{3}){1,3}|\d{6,12})(?=$|[\s,;\t"])/)
    if (m) {
      documento = m[1].replace(/\D/g, '')
      linea = linea.replace(m[1], ' ')
    }

    // Quitar numeración inicial ("1.", "2)", "3 -") y separadores
    let nombre = linea
      .replace(/^\s*\d{1,3}\s*[.)\-]\s*/, '')
      .split(/[\t,;]/).map(p => p.replace(/"/g, '').trim()).filter(Boolean)[0] || ''
    nombre = nombre.replace(/\s+/g, ' ').trim()
    if (!nombre || !/[a-záéíóúñ]/i.test(nombre)) continue
    salida.push({ nombre, documento })
  }
  return salida
}

const ESTADOS: Record<Analisis['estado'], { label: string; bg: string; color: string; Icon: React.ElementType }> = {
  actual:   { label: 'Ya está en este retiro', bg: '#eef0ff', color: '#0f1787', Icon: Check },
  anterior: { label: 'Viene de un retiro anterior', bg: '#ecfdf5', color: '#065f46', Icon: History },
  nuevo:    { label: 'Nuevo — se creará', bg: '#fffbeb', color: '#92400e', Icon: UserPlus },
  ambiguo:  { label: 'Varias coincidencias — elige', bg: '#fef2f2', color: '#b91c1c', Icon: HelpCircle },
}

function eleccionPorDefecto(a: Analisis): Eleccion {
  if (a.estado === 'ambiguo') return 'omitir'
  if (a.estado === 'nuevo') return 'nuevo'
  return `${a.estado}:${a.candidato!.id}`
}

async function llamarApi(body: object) {
  const { data: { session } } = await supabase.auth.getSession()
  const res = await fetch('/api/servidores/internos', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${session?.access_token ?? ''}` },
    body: JSON.stringify(body),
  })
  const data = await res.json()
  if (!res.ok || !data.success) throw new Error(data.error || 'Error de servidor')
  return data
}

export default function CargarInternosPage() {
  const router = useRouter()
  const retiro = useRetiroActual()
  const fileRef = useRef<HTMLInputElement>(null)

  const [texto, setTexto] = useState('')
  const [analisis, setAnalisis] = useState<Analisis[] | null>(null)
  const [elecciones, setElecciones] = useState<Record<number, Eleccion>>({})
  const [resultados, setResultados] = useState<Resultado[] | null>(null)
  const [cargando, setCargando] = useState(false)
  const [error, setError] = useState('')

  const personas = parsearLista(texto)

  async function leerArchivo(archivo: File) {
    setError('')
    if (/\.(xlsx|xls)$/i.test(archivo.name)) {
      setError('Los archivos de Excel (.xlsx) no se pueden leer directo. En Excel: Archivo → Guardar como → "CSV UTF-8 (delimitado por comas)", y sube ese archivo. O simplemente copia la columna de nombres y pégala en el cuadro.')
      return
    }
    const contenido = await archivo.text()
    setTexto(prev => (prev.trim() ? prev.trim() + '\n' : '') + contenido)
    setAnalisis(null)
    setResultados(null)
    if (fileRef.current) fileRef.current.value = ''
  }

  async function revisar() {
    setError('')
    setResultados(null)
    if (personas.length === 0) { setError('Pega al menos un nombre.'); return }
    setCargando(true)
    try {
      const data = await llamarApi({ personas, aplicar: false })
      const lista: Analisis[] = data.analisis
      setAnalisis(lista)
      const ini: Record<number, Eleccion> = {}
      for (const a of lista) ini[a.indice] = eleccionPorDefecto(a)
      setElecciones(ini)
    } catch (e: any) {
      setError(e.message)
    } finally {
      setCargando(false)
    }
  }

  async function confirmar() {
    if (!analisis) return
    setError('')
    setCargando(true)
    try {
      const decisiones: Record<string, { accion: string; id?: string }> = {}
      for (const a of analisis) {
        const el = elecciones[a.indice] ?? eleccionPorDefecto(a)
        if (el === 'omitir' || el === 'nuevo') decisiones[a.indice] = { accion: el }
        else {
          const [accion, id] = el.split(':')
          decisiones[a.indice] = { accion, id }
        }
      }
      const data = await llamarApi({ personas, aplicar: true, decisiones })
      setResultados(data.resultados)
      setAnalisis(null)
    } catch (e: any) {
      setError(e.message)
    } finally {
      setCargando(false)
    }
  }

  const conteo = (estado: Analisis['estado']) => analisis?.filter(a => a.estado === estado).length ?? 0
  const okCount = resultados?.filter(r => r.ok && r.mensaje !== 'Omitido').length ?? 0
  const errCount = resultados?.filter(r => !r.ok).length ?? 0

  return (
    <div style={{ background: '#f7f8fc', minHeight: '100vh', paddingBottom: 60 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '18px 20px 14px' }}>
        <button onClick={() => router.push('/dashboard/servidores')} style={{ width: 34, height: 34, borderRadius: '50%', background: '#fff', border: '0.5px solid #e5e7eb', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer' }}>
          <ChevronLeft size={18} color="#6b7280" />
        </button>
        <div>
          <div style={{ fontSize: 17, fontWeight: 500, color: '#0d0d14' }}>Cargar servidores internos</div>
          <div style={{ fontSize: 12, color: '#9ca3af', marginTop: 2 }}>{retiro.nombre}</div>
        </div>
      </div>

      <div style={{ padding: '0 20px 16px' }}>
        <div style={{ background: '#eff6ff', border: '0.5px solid #bfdbfe', borderRadius: 12, padding: 14, display: 'flex', gap: 10 }}>
          <Info size={18} color="#0f1787" style={{ flexShrink: 0, marginTop: 1 }} />
          <div style={{ fontSize: 13, color: '#1e3a8a', lineHeight: 1.5 }}>
            Pega <strong>un nombre por línea</strong> (puedes copiar la columna directo de Excel o Sheets). Si tienes la cédula, ponla al lado del nombre separada por coma — así la búsqueda es exacta.
            <br />Nada se guarda hasta que oprimas <strong>“Confirmar y guardar”</strong>.
          </div>
        </div>
      </div>

      {/* ── Paso 1: pegar / subir ── */}
      {!resultados && (
        <div style={{ padding: '0 20px', display: 'flex', flexDirection: 'column', gap: 12 }}>
          <textarea
            value={texto}
            onChange={e => { setTexto(e.target.value); setAnalisis(null) }}
            placeholder={'María Fernanda Gómez Ruiz\nJuan Pablo Restrepo, 1020304050\nAndrés Felipe Torres'}
            rows={10}
            style={{ width: '100%', padding: '12px 14px', borderRadius: 12, border: '1.5px solid #e2e4f0', fontSize: 14, fontFamily: 'inherit', resize: 'vertical', boxSizing: 'border-box', outline: 'none', background: '#fff' }}
          />

          <div style={{ display: 'flex', gap: 10, alignItems: 'center', flexWrap: 'wrap' }}>
            <input ref={fileRef} type="file" accept=".txt,.csv,.tsv,text/plain,text/csv" style={{ display: 'none' }}
              onChange={e => { const f = e.target.files?.[0]; if (f) leerArchivo(f) }} />
            <button onClick={() => fileRef.current?.click()}
              style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '9px 14px', borderRadius: 10, border: '0.5px solid #e5e7eb', background: '#fff', color: '#0f1787', fontSize: 13, fontWeight: 600, cursor: 'pointer' }}>
              <Upload size={15} /> Subir archivo (.csv o .txt)
            </button>
            <span style={{ fontSize: 12, color: '#6b7280' }}>
              {personas.length} {personas.length === 1 ? 'persona detectada' : 'personas detectadas'}
            </span>
          </div>

          {!analisis && (
            <button onClick={revisar} disabled={cargando || personas.length === 0}
              style={{ width: '100%', padding: 14, borderRadius: 12, border: 'none', background: cargando || personas.length === 0 ? '#9ca3af' : '#0f1787', color: '#fff', fontSize: 15, fontWeight: 600, cursor: cargando ? 'wait' : 'pointer' }}>
              {cargando ? 'Revisando…' : 'Revisar lista'}
            </button>
          )}
        </div>
      )}

      {error && (
        <div style={{ margin: '12px 20px 0', color: '#dc2626', fontSize: 13, background: '#fef2f2', padding: '10px 12px', borderRadius: 8, display: 'flex', gap: 8 }}>
          <AlertTriangle size={16} style={{ flexShrink: 0, marginTop: 1 }} /> {error}
        </div>
      )}

      {/* ── Paso 2: vista previa ── */}
      {analisis && (
        <div style={{ padding: '16px 20px 0' }}>
          <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginBottom: 12 }}>
            {(['actual', 'anterior', 'nuevo', 'ambiguo'] as const).map(k => conteo(k) > 0 && (
              <span key={k} style={{ fontSize: 11, fontWeight: 600, padding: '4px 10px', borderRadius: 20, background: ESTADOS[k].bg, color: ESTADOS[k].color }}>
                {ESTADOS[k].label} · {conteo(k)}
              </span>
            ))}
          </div>

          <div style={{ background: '#fff', border: '0.5px solid #e5e7eb', borderRadius: 14, overflow: 'hidden' }}>
            {analisis.map((a, i) => {
              const est = ESTADOS[a.estado]
              const el = elecciones[a.indice] ?? eleccionPorDefecto(a)
              const opciones = a.estado === 'ambiguo' ? a.candidatos : a.candidato ? [a.candidato] : []
              return (
                <div key={a.indice} style={{ padding: '12px 14px', borderBottom: i === analisis.length - 1 ? 'none' : '0.5px solid #f3f4f6' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                    <div style={{ width: 28, height: 28, borderRadius: 8, background: est.bg, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                      <est.Icon size={14} color={est.color} />
                    </div>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontSize: 13, fontWeight: 600, color: '#0d0d14' }}>
                        {a.nombre}{a.documento ? <span style={{ fontWeight: 400, color: '#9ca3af' }}> · {a.documento}</span> : null}
                      </div>
                      <div style={{ fontSize: 11, color: est.color, marginTop: 2 }}>{est.label}</div>
                    </div>
                  </div>

                  <select
                    value={el}
                    onChange={e => setElecciones(prev => ({ ...prev, [a.indice]: e.target.value }))}
                    style={{ marginTop: 8, width: '100%', padding: '8px 10px', borderRadius: 8, border: '0.5px solid #e5e7eb', fontSize: 12, color: '#111827', background: '#f9fafb' }}
                  >
                    {opciones.map(c => (
                      <option key={c.id} value={`${c.origen}:${c.id}`}>
                        {c.origen === 'actual' ? 'Marcar como interno: ' : 'Traer de ' + c.retiro_nombre + ': '}
                        {c.nombre}{c.numero_documento ? ` (${c.numero_documento})` : ''}
                        {c.tiene_cuenta ? ' · tiene cuenta' : ' · sin cuenta'}
                        {c.origen === 'actual' && c.es_interno ? ' · ya es interno' : ''}
                      </option>
                    ))}
                    <option value="nuevo">Crear como persona nueva</option>
                    <option value="omitir">No hacer nada con esta línea</option>
                  </select>
                </div>
              )
            })}
          </div>

          <div style={{ display: 'flex', gap: 10, marginTop: 16 }}>
            <button onClick={() => setAnalisis(null)} disabled={cargando}
              style={{ flex: 1, padding: 14, borderRadius: 12, border: '0.5px solid #e5e7eb', background: '#fff', color: '#6b7280', fontSize: 14, cursor: 'pointer' }}>
              Volver a editar
            </button>
            <button onClick={confirmar} disabled={cargando}
              style={{ flex: 2, padding: 14, borderRadius: 12, border: 'none', background: cargando ? '#9ca3af' : '#0f1787', color: '#fff', fontSize: 15, fontWeight: 600, cursor: cargando ? 'wait' : 'pointer' }}>
              {cargando ? 'Guardando…' : 'Confirmar y guardar'}
            </button>
          </div>
        </div>
      )}

      {/* ── Paso 3: resultado ── */}
      {resultados && (
        <div style={{ padding: '0 20px' }}>
          <div style={{ background: errCount ? '#fffbeb' : '#f0fdf4', border: `0.5px solid ${errCount ? '#fde68a' : '#bbf7d0'}`, borderRadius: 12, padding: 14, marginBottom: 12, fontSize: 14, color: errCount ? '#92400e' : '#166534', fontWeight: 600 }}>
            {okCount} {okCount === 1 ? 'servidor quedó' : 'servidores quedaron'} como internos{errCount ? ` · ${errCount} con error` : ''}.
          </div>
          <div style={{ background: '#fff', border: '0.5px solid #e5e7eb', borderRadius: 14, overflow: 'hidden' }}>
            {resultados.map((r, i) => (
              <div key={r.indice} style={{ padding: '10px 14px', borderBottom: i === resultados.length - 1 ? 'none' : '0.5px solid #f3f4f6', display: 'flex', gap: 10, alignItems: 'flex-start' }}>
                {r.ok ? <Check size={15} color="#16a34a" style={{ flexShrink: 0, marginTop: 2 }} /> : <AlertTriangle size={15} color="#dc2626" style={{ flexShrink: 0, marginTop: 2 }} />}
                <div>
                  <div style={{ fontSize: 13, fontWeight: 500, color: '#0d0d14' }}>{r.nombre}</div>
                  <div style={{ fontSize: 11, color: r.ok ? '#6b7280' : '#dc2626', marginTop: 2 }}>{r.mensaje}</div>
                </div>
              </div>
            ))}
          </div>
          <div style={{ display: 'flex', gap: 10, marginTop: 16 }}>
            <button onClick={() => { setResultados(null); setTexto('') }}
              style={{ flex: 1, padding: 14, borderRadius: 12, border: '0.5px solid #e5e7eb', background: '#fff', color: '#0f1787', fontSize: 14, fontWeight: 600, cursor: 'pointer' }}>
              Cargar otra lista
            </button>
            <button onClick={() => router.push('/dashboard/servidores')}
              style={{ flex: 1, padding: 14, borderRadius: 12, border: 'none', background: '#0f1787', color: '#fff', fontSize: 14, fontWeight: 600, cursor: 'pointer' }}>
              Ver servidores
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
