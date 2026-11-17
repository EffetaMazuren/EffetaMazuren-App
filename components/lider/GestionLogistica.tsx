'use client'

import { useState } from 'react'
import { supabase } from '@/lib/supabase'

// Piezas de la pestaña Mesas y Cuartos (dashboard/retiro) para crear la
// estructura del retiro: mesas y habitaciones. Todo pasa por
// /api/lider/logistica (service_role + verificación de líder).

export async function llamarLogistica(body: Record<string, unknown>): Promise<any> {
  const { data: { session } } = await supabase.auth.getSession()
  const res = await fetch('/api/lider/logistica', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${session?.access_token ?? ''}` },
    body: JSON.stringify(body),
  })
  const data = await res.json()
  if (!data.success) throw new Error(data.error || 'No se pudo guardar')
  return data
}

const inputStyle: React.CSSProperties = { width: '100%', padding: '8px 10px', border: '1.5px solid #e8eaf0', borderRadius: 8, fontSize: 13, outline: 'none', boxSizing: 'border-box', fontFamily: 'inherit', background: 'white' }
const labelStyle: React.CSSProperties = { fontSize: 11, fontWeight: 600, color: '#6b7280', display: 'block', marginBottom: 4 }

// ── MESAS ────────────────────────────────────────────────────────────────────
export function CrearMesas({ totalMesas, caminantesConfirmados, porMesa, onCambio }: { totalMesas: number; caminantesConfirmados: number; porMesa: number; onCambio: () => void }) {
  const sugeridas = Math.max(1, Math.ceil(caminantesConfirmados / porMesa))
  const [cantidad, setCantidad] = useState(String(totalMesas === 0 ? sugeridas : 1))
  const [abierto, setAbierto] = useState(totalMesas === 0)
  const [guardando, setGuardando] = useState(false)
  const [error, setError] = useState('')

  async function crear() {
    const n = parseInt(cantidad)
    if (!n || n < 1) { setError('Escribe cuántas mesas quieres crear.'); return }
    setGuardando(true); setError('')
    try {
      await llamarLogistica({ accion: 'crear_mesas', cantidad: n })
      setAbierto(false)
      onCambio()
    } catch (e: any) { setError(e.message) } finally { setGuardando(false) }
  }

  if (!abierto) {
    return (
      <button onClick={() => setAbierto(true)} style={{ width: '100%', padding: 10, background: '#f0f2ff', color: '#0f1787', border: '1.5px dashed #c7d0ff', borderRadius: 10, fontSize: 13, fontWeight: 600, cursor: 'pointer', marginBottom: 16 }}>
        + Agregar mesas
      </button>
    )
  }

  return (
    <div style={{ background: 'white', border: '1.5px solid #c7d0ff', borderRadius: 12, padding: 16, marginBottom: 16 }}>
      <p style={{ fontSize: 13, fontWeight: 700, color: '#0f1787', margin: '0 0 4px' }}>{totalMesas === 0 ? 'Crear las mesas del retiro' : 'Agregar mesas'}</p>
      <p style={{ fontSize: 12, color: '#6b7280', margin: '0 0 12px', lineHeight: 1.5 }}>
        {totalMesas === 0
          ? <>Este retiro todavía no tiene mesas. Hay <b>{caminantesConfirmados}</b> caminantes con pago confirmado; a {porMesa} por mesa, se sugieren <b>{sugeridas}</b>.</>
          : <>Ya hay {totalMesas} mesas. Las nuevas siguen la numeración (Mesa {totalMesas + 1}, …).</>}
      </p>
      <label style={labelStyle}>CANTIDAD DE MESAS</label>
      <input type="number" min={1} max={40} value={cantidad} onChange={e => setCantidad(e.target.value)} style={{ ...inputStyle, width: 120, marginBottom: 12 }} />
      {error && <p style={{ fontSize: 12, color: '#dc2626', margin: '0 0 10px' }}>{error}</p>}
      <div style={{ display: 'flex', gap: 8 }}>
        <button onClick={crear} disabled={guardando} style={{ flex: 1, padding: 9, background: guardando ? '#9ca3af' : '#0f1787', color: 'white', border: 'none', borderRadius: 8, fontSize: 13, fontWeight: 600, cursor: 'pointer' }}>
          {guardando ? 'Creando…' : 'Crear mesas'}
        </button>
        {totalMesas > 0 && <button onClick={() => setAbierto(false)} style={{ padding: '9px 14px', background: '#f3f4f6', color: '#374151', border: 'none', borderRadius: 8, fontSize: 13, cursor: 'pointer' }}>Cancelar</button>}
      </div>
    </div>
  )
}

// ── HABITACIONES ─────────────────────────────────────────────────────────────
export type HabitacionForm = { id?: string; numero: string; piso: number; bloque: string; tipo_cama: string; capacidad: number; solo_servidores: boolean }

export function FormHabitacion({ inicial, bloques, onListo, onCancelar }: { inicial?: HabitacionForm; bloques: string[]; onListo: () => void; onCancelar: () => void }) {
  const [f, setF] = useState({
    numero: inicial?.numero ?? '',
    piso: String(inicial?.piso ?? 1),
    bloque: inicial?.bloque ?? (bloques[0] ?? ''),
    tipo_cama: inicial?.tipo_cama ?? '',
    capacidad: String(inicial?.capacidad ?? 2),
    solo_servidores: inicial?.solo_servidores ?? false,
  })
  const [guardando, setGuardando] = useState(false)
  const [error, setError] = useState('')
  const editando = !!inicial?.id

  async function guardar() {
    setGuardando(true); setError('')
    try {
      await llamarLogistica({
        accion: editando ? 'editar_habitacion' : 'crear_habitacion',
        id: inicial?.id,
        numero: f.numero, piso: parseInt(f.piso), bloque: f.bloque, tipo_cama: f.tipo_cama,
        capacidad: parseInt(f.capacidad), solo_servidores: f.solo_servidores,
      })
      onListo()
    } catch (e: any) { setError(e.message) } finally { setGuardando(false) }
  }

  async function eliminar() {
    if (!inicial?.id) return
    if (!confirm(`¿Eliminar la habitación ${inicial.numero}? Las personas asignadas quedan sin cuarto.`)) return
    setGuardando(true); setError('')
    try {
      await llamarLogistica({ accion: 'eliminar_habitacion', id: inicial.id })
      onListo()
    } catch (e: any) { setError(e.message); setGuardando(false) }
  }

  return (
    <div style={{ background: 'white', border: '1.5px solid #c7d0ff', borderRadius: 12, padding: 14, marginBottom: editando ? 0 : 16 }}>
      <p style={{ fontSize: 13, fontWeight: 700, color: '#0f1787', margin: '0 0 12px' }}>{editando ? `Editar habitación ${inicial?.numero}` : 'Nueva habitación'}</p>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginBottom: 10 }}>
        <div><label style={labelStyle}>NÚMERO / NOMBRE</label><input value={f.numero} onChange={e => setF(p => ({ ...p, numero: e.target.value }))} placeholder="Ej: 201" style={inputStyle} /></div>
        <div><label style={labelStyle}>PISO</label><input type="number" min={0} max={20} value={f.piso} onChange={e => setF(p => ({ ...p, piso: e.target.value }))} style={inputStyle} /></div>
        <div>
          <label style={labelStyle}>BLOQUE</label>
          <input value={f.bloque} onChange={e => setF(p => ({ ...p, bloque: e.target.value }))} list="bloques-habitaciones" placeholder="Ej: Bloque A" style={inputStyle} />
          <datalist id="bloques-habitaciones">{bloques.map(b => <option key={b} value={b} />)}</datalist>
        </div>
        <div><label style={labelStyle}>CAPACIDAD (PERSONAS)</label><input type="number" min={1} max={50} value={f.capacidad} onChange={e => setF(p => ({ ...p, capacidad: e.target.value }))} style={inputStyle} /></div>
      </div>
      <div style={{ marginBottom: 10 }}><label style={labelStyle}>TIPO DE CAMA</label><input value={f.tipo_cama} onChange={e => setF(p => ({ ...p, tipo_cama: e.target.value }))} placeholder="Ej: 2 camarotes" style={inputStyle} /></div>
      <label style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 13, color: '#374151', marginBottom: 12, cursor: 'pointer' }}>
        <input type="checkbox" checked={f.solo_servidores} onChange={e => setF(p => ({ ...p, solo_servidores: e.target.checked }))} />
        Solo para servidores
      </label>
      {error && <p style={{ fontSize: 12, color: '#dc2626', margin: '0 0 10px' }}>{error}</p>}
      <div style={{ display: 'flex', gap: 8 }}>
        <button onClick={guardar} disabled={guardando} style={{ flex: 1, padding: 9, background: guardando ? '#9ca3af' : '#0f1787', color: 'white', border: 'none', borderRadius: 8, fontSize: 13, fontWeight: 600, cursor: 'pointer' }}>
          {guardando ? 'Guardando…' : editando ? 'Guardar' : 'Crear habitación'}
        </button>
        <button onClick={onCancelar} style={{ padding: '9px 14px', background: '#f3f4f6', color: '#374151', border: 'none', borderRadius: 8, fontSize: 13, cursor: 'pointer' }}>Cancelar</button>
        {editando && <button onClick={eliminar} disabled={guardando} style={{ padding: '9px 12px', background: '#fef2f2', color: '#dc2626', border: 'none', borderRadius: 8, fontSize: 13, fontWeight: 600, cursor: 'pointer' }}>Eliminar</button>}
      </div>
    </div>
  )
}

export function CrearHabitaciones({ totalHabitaciones, bloques, onCambio }: { totalHabitaciones: number; bloques: string[]; onCambio: () => void }) {
  const [creando, setCreando] = useState(false)
  const [copiando, setCopiando] = useState(false)
  const [error, setError] = useState('')
  const [ok, setOk] = useState('')

  async function copiar() {
    if (!confirm('Se copian todas las habitaciones del último retiro que las tenga (sin las personas). ¿Continuar?')) return
    setCopiando(true); setError(''); setOk('')
    try {
      const data = await llamarLogistica({ accion: 'copiar_habitaciones' })
      setOk(`${data.copiadas} habitaciones copiadas de "${data.desde}".`)
      onCambio()
    } catch (e: any) { setError(e.message) } finally { setCopiando(false) }
  }

  if (creando) return <FormHabitacion bloques={bloques} onListo={() => { setCreando(false); onCambio() }} onCancelar={() => setCreando(false)} />

  return (
    <div style={{ marginBottom: 16 }}>
      {totalHabitaciones === 0 && (
        <div style={{ background: 'white', border: '1.5px solid #c7d0ff', borderRadius: 12, padding: 16, marginBottom: 10 }}>
          <p style={{ fontSize: 13, fontWeight: 700, color: '#0f1787', margin: '0 0 4px' }}>Este retiro todavía no tiene habitaciones</p>
          <p style={{ fontSize: 12, color: '#6b7280', margin: '0 0 12px', lineHeight: 1.5 }}>
            Si es en la misma casa, copia las del retiro anterior y después ajusta lo que cambie. Si es otro lugar, créalas una por una.
          </p>
          <button onClick={copiar} disabled={copiando} style={{ width: '100%', padding: 10, background: copiando ? '#9ca3af' : '#0f1787', color: 'white', border: 'none', borderRadius: 10, fontSize: 13, fontWeight: 600, cursor: 'pointer' }}>
            {copiando ? 'Copiando…' : '📋 Copiar habitaciones del retiro anterior'}
          </button>
        </div>
      )}
      {error && <p style={{ fontSize: 12, color: '#dc2626', margin: '0 0 10px' }}>{error}</p>}
      {ok && <p style={{ fontSize: 12, color: '#16a34a', margin: '0 0 10px' }}>✓ {ok}</p>}
      <button onClick={() => setCreando(true)} style={{ width: '100%', padding: 10, background: '#f0f2ff', color: '#0f1787', border: '1.5px dashed #c7d0ff', borderRadius: 10, fontSize: 13, fontWeight: 600, cursor: 'pointer' }}>
        + Agregar habitación
      </button>
    </div>
  )
}
