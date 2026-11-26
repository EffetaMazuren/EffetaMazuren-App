'use client'
import { useRef, useState } from 'react'
import { supabase } from '@/lib/supabase'
import { leerExcelHabitaciones, descargarExcelHabitaciones, nombreArchivoSeguro, HabitacionArchivo } from '@/lib/habitaciones-excel'

// Botones de la pestaña Cuartos:
//   • Subir Excel  → lee la plantilla de habitaciones, muestra qué va a
//     crear/asignar y, al confirmar, registra las habitaciones y asigna
//     automáticamente a las personas que encuentre por nombre.
//   • Descargar Excel → genera la plantilla con la asignación actual.

type Persona = { id: string; nombre: string; tipo: 'caminante' | 'servidor' }
type ResNombre = {
  clave: string
  habitacion: string
  nombreArchivo: string
  estado: 'ok' | 'ambiguo' | 'no_encontrado' | 'repetido'
  persona: Persona | null
  candidatos: Persona[]
  cuartoAnterior: string | null
}
type ResHab = { numero: string; bloque: string; tipo_cama: string; nueva: boolean; personas: number }

type HabApp = { id: string; numero: string; piso: number; bloque: string; tipo_cama: string }
type AsigApp = { habitacion_id: string; nombre: string; tipo_persona: string }

async function llamarImportar(body: object) {
  const { data: { session } } = await supabase.auth.getSession()
  const res = await fetch('/api/lider/habitaciones/importar', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${session?.access_token ?? ''}` },
    body: JSON.stringify(body),
  })
  const data = await res.json()
  if (!res.ok || !data.success) throw new Error(data.error || 'Error de servidor')
  return data
}

const boton: React.CSSProperties = { flex: 1, padding: '9px 10px', borderRadius: 10, fontSize: 12, fontWeight: 600, cursor: 'pointer', border: '1px solid #c7d0ff', background: '#f0f2ff', color: '#0f1787' }

export default function ExcelHabitaciones({ nombreRetiro, habitaciones, asignaciones, onCambio }: {
  nombreRetiro: string
  habitaciones: HabApp[]
  asignaciones: AsigApp[]
  onCambio: () => Promise<void> | void
}) {
  const fileRef = useRef<HTMLInputElement>(null)
  const [leidas, setLeidas] = useState<HabitacionArchivo[] | null>(null)
  const [habs, setHabs] = useState<ResHab[]>([])
  const [nombres, setNombres] = useState<ResNombre[]>([])
  const [decisiones, setDecisiones] = useState<Record<string, string>>({})
  const [cargando, setCargando] = useState(false)
  const [error, setError] = useState('')
  const [exito, setExito] = useState('')

  async function alElegirArchivo(archivo: File) {
    setError(''); setExito('')
    if (/\.pdf$/i.test(archivo.name)) {
      setError('Los PDF no se pueden leer de forma confiable. Sube el Excel (.xlsx). Si lo tienes en Google Sheets: Archivo → Descargar → Microsoft Excel (.xlsx).')
      return
    }
    if (!/\.xlsx$/i.test(archivo.name)) {
      setError('Sube un archivo de Excel (.xlsx) con el formato de la plantilla de habitaciones.')
      return
    }
    setCargando(true)
    try {
      const lista = await leerExcelHabitaciones(archivo)
      const r = await llamarImportar({ habitaciones: lista, aplicar: false })
      setLeidas(lista); setHabs(r.habitaciones); setNombres(r.personas); setDecisiones({})
    } catch (e: any) {
      setError(e.message || 'No se pudo leer el archivo')
    } finally {
      setCargando(false)
      if (fileRef.current) fileRef.current.value = ''
    }
  }

  async function confirmar() {
    if (!leidas) return
    setCargando(true); setError('')
    try {
      const r = await llamarImportar({ habitaciones: leidas, aplicar: true, decisiones })
      setLeidas(null)
      setExito(`Listo: ${r.creadas} habitaciones nuevas, ${r.actualizadas} actualizadas, ${r.asignadas} personas asignadas${r.movidas ? ` (${r.movidas} cambiadas de cuarto)` : ''}.` +
        (r.errores?.length ? ` Con error: ${r.errores.join(' · ')}` : ''))
      await onCambio()
    } catch (e: any) {
      setError(e.message)
    } finally {
      setCargando(false)
    }
  }

  async function descargar() {
    setError(''); setExito('')
    try {
      const datos = habitaciones.map(h => ({
        numero: String(h.numero),
        piso: h.piso,
        bloque: h.bloque || 'General',
        tipo_cama: h.tipo_cama || '',
        personas: asignaciones
          .filter(a => a.habitacion_id === h.id)
          .sort((a, b) => (a.tipo_persona === b.tipo_persona ? 0 : a.tipo_persona === 'servidor' ? -1 : 1))
          .map(a => (a.nombre || '').trim()),
      }))
      await descargarExcelHabitaciones(datos, nombreArchivoSeguro(`${nombreRetiro} - Habitaciones`, 'xlsx'))
    } catch (e: any) {
      setError('No se pudo generar el Excel: ' + (e.message || ''))
    }
  }

  const ok = nombres.filter(n => n.estado === 'ok' || decisiones[n.clave])
  const ambiguos = nombres.filter(n => n.estado === 'ambiguo')
  const noEncontrados = nombres.filter(n => n.estado === 'no_encontrado')
  const repetidos = nombres.filter(n => n.estado === 'repetido')
  const movidos = ok.filter(n => n.cuartoAnterior && n.cuartoAnterior !== n.habitacion)

  return (
    <div style={{ marginBottom: 14 }}>
      <div style={{ display: 'flex', gap: 8 }}>
        <input ref={fileRef} type="file" accept=".xlsx,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" style={{ display: 'none' }}
          onChange={e => { const f = e.target.files?.[0]; if (f) alElegirArchivo(f) }} />
        <button onClick={() => fileRef.current?.click()} disabled={cargando} style={boton}>
          {cargando && !leidas ? 'Leyendo…' : '⬆️ Subir Excel de habitaciones'}
        </button>
        <button onClick={descargar} disabled={habitaciones.length === 0} style={{ ...boton, opacity: habitaciones.length === 0 ? 0.5 : 1 }}>
          ⬇️ Descargar Excel
        </button>
      </div>

      {error && <div style={{ marginTop: 10, background: '#fef2f2', border: '1px solid #fecaca', borderRadius: 8, padding: '8px 12px', fontSize: 12, color: '#b91c1c' }}>{error}</div>}
      {exito && <div style={{ marginTop: 10, background: '#f0fdf4', border: '1px solid #bbf7d0', borderRadius: 8, padding: '8px 12px', fontSize: 12, color: '#166534' }}>✓ {exito}</div>}

      {leidas && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', zIndex: 200, display: 'flex', alignItems: 'flex-end', justifyContent: 'center' }}>
          <div style={{ background: '#fff', borderRadius: '20px 20px 0 0', width: '100%', maxWidth: 560, maxHeight: '88vh', overflowY: 'auto', padding: 20, boxSizing: 'border-box' }}>
            <div style={{ fontSize: 16, fontWeight: 700, color: '#0d0d14', marginBottom: 4 }}>Revisar antes de guardar</div>
            <div style={{ fontSize: 13, color: '#6b7280', marginBottom: 14 }}>Todavía no se ha guardado nada.</div>

            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginBottom: 14 }}>
              <span style={{ fontSize: 11, fontWeight: 600, padding: '4px 10px', borderRadius: 20, background: '#eef0ff', color: '#0f1787' }}>Habitaciones nuevas · {habs.filter(h => h.nueva).length}</span>
              <span style={{ fontSize: 11, fontWeight: 600, padding: '4px 10px', borderRadius: 20, background: '#f3f4f6', color: '#374151' }}>Ya existían · {habs.filter(h => !h.nueva).length}</span>
              <span style={{ fontSize: 11, fontWeight: 600, padding: '4px 10px', borderRadius: 20, background: '#f0fdf4', color: '#166534' }}>Personas que se asignan · {ok.length}</span>
              {movidos.length > 0 && <span style={{ fontSize: 11, fontWeight: 600, padding: '4px 10px', borderRadius: 20, background: '#fffbeb', color: '#92400e' }}>Cambian de cuarto · {movidos.length}</span>}
              {noEncontrados.length > 0 && <span style={{ fontSize: 11, fontWeight: 600, padding: '4px 10px', borderRadius: 20, background: '#fef2f2', color: '#b91c1c' }}>No encontradas · {noEncontrados.length}</span>}
            </div>

            {ambiguos.length > 0 && (
              <div style={{ marginBottom: 14 }}>
                <p style={{ fontSize: 12, fontWeight: 700, color: '#b91c1c', margin: '0 0 6px' }}>Elige quién es (varias coincidencias)</p>
                {ambiguos.map(n => (
                  <div key={n.clave} style={{ marginBottom: 8 }}>
                    <div style={{ fontSize: 12, color: '#374151', marginBottom: 4 }}>Hab. {n.habitacion}: <strong>{n.nombreArchivo}</strong></div>
                    <select value={decisiones[n.clave] || ''} onChange={e => setDecisiones(d => ({ ...d, [n.clave]: e.target.value }))}
                      style={{ width: '100%', padding: '7px 8px', borderRadius: 8, border: '1px solid #e5e7eb', fontSize: 12 }}>
                      <option value="">No asignar</option>
                      {n.candidatos.map(c => <option key={c.id} value={c.id}>{c.nombre} ({c.tipo})</option>)}
                    </select>
                  </div>
                ))}
              </div>
            )}

            {movidos.length > 0 && (
              <div style={{ marginBottom: 14 }}>
                <p style={{ fontSize: 12, fontWeight: 700, color: '#92400e', margin: '0 0 6px' }}>Se cambian de cuarto</p>
                {movidos.map(n => <div key={n.clave} style={{ fontSize: 12, color: '#374151' }}>{n.persona?.nombre}: Hab. {n.cuartoAnterior} → Hab. {n.habitacion}</div>)}
              </div>
            )}

            {(noEncontrados.length > 0 || repetidos.length > 0) && (
              <div style={{ marginBottom: 14 }}>
                <p style={{ fontSize: 12, fontWeight: 700, color: '#b91c1c', margin: '0 0 4px' }}>No se asignan (no están en la app o están repetidos)</p>
                <p style={{ fontSize: 11, color: '#6b7280', margin: '0 0 6px' }}>Puedes asignarlos a mano después, o revisar cómo está escrito el nombre.</p>
                {[...noEncontrados, ...repetidos].map(n => (
                  <div key={n.clave} style={{ fontSize: 12, color: '#374151' }}>Hab. {n.habitacion}: {n.nombreArchivo}{n.estado === 'repetido' ? ' (aparece en dos cuartos)' : ''}</div>
                ))}
              </div>
            )}

            <details style={{ marginBottom: 16 }}>
              <summary style={{ fontSize: 12, fontWeight: 600, color: '#0f1787', cursor: 'pointer' }}>Ver todas las asignaciones ({ok.length})</summary>
              <div style={{ marginTop: 8, maxHeight: 220, overflowY: 'auto' }}>
                {ok.map(n => <div key={n.clave} style={{ fontSize: 12, color: '#374151', padding: '2px 0' }}>Hab. {n.habitacion} · {n.persona?.nombre ?? n.nombreArchivo}</div>)}
              </div>
            </details>

            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              <button onClick={confirmar} disabled={cargando}
                style={{ width: '100%', padding: 14, borderRadius: 12, border: 'none', background: cargando ? '#9ca3af' : '#0f1787', color: '#fff', fontSize: 15, fontWeight: 600, cursor: 'pointer' }}>
                {cargando ? 'Guardando…' : 'Confirmar y guardar'}
              </button>
              <button onClick={() => setLeidas(null)} disabled={cargando}
                style={{ width: '100%', padding: 14, borderRadius: 12, border: '0.5px solid #e5e7eb', background: '#fff', color: '#6b7280', fontSize: 15, cursor: 'pointer' }}>
                Cancelar
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
