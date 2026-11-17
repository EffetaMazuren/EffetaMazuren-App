'use client'

import { useState } from 'react'
import { X } from 'lucide-react'
import { supabase } from '@/lib/supabase'

// Formulario para que el líder edite TODOS los datos de un caminante desde su
// ficha (dashboard/caminantes/[id]). Guarda por PATCH /api/caminantes/[id].

const TALLAS = ['XS', 'S', 'M', 'L', 'XL']
const TIPOS_DOC = ['C.C.', 'TI', 'C.E.', 'Pasaporte']
const SACRAMENTOS_OPTS = ['Bautismo', 'Comunión', 'Confirmación', 'Matrimonio']

type Contacto = { nombre: string; parentesco: string; celular: string }

function calcularEdad(fecha: string): string {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(fecha)) return ''
  const n = new Date(fecha + 'T00:00:00'), hoy = new Date()
  let e = hoy.getFullYear() - n.getFullYear()
  const m = hoy.getMonth() - n.getMonth()
  if (m < 0 || (m === 0 && hoy.getDate() < n.getDate())) e--
  return e >= 0 && e < 120 ? String(e) : ''
}

const inputStyle: React.CSSProperties = { width: '100%', padding: '10px 12px', border: '0.5px solid #e5e7eb', borderRadius: 10, fontSize: 14, outline: 'none', boxSizing: 'border-box', fontFamily: 'inherit', background: '#fff' }
const labelStyle: React.CSSProperties = { fontSize: 12, color: '#6b7280', display: 'block', marginBottom: 4 }
const seccionStyle: React.CSSProperties = { fontSize: 11, fontWeight: 600, letterSpacing: 0.8, textTransform: 'uppercase', color: '#0f1787', margin: '18px 0 10px' }

export default function EditarCaminante({ caminante, contactos, onCerrar, onGuardado }: {
  caminante: any
  contactos: any[]
  onCerrar: () => void
  onGuardado: () => void
}) {
  const s = (v: unknown) => (v === null || v === undefined ? '' : String(v))
  const [f, setF] = useState({
    nombre: s(caminante.nombre),
    tipo_documento: s(caminante.tipo_documento) || 'TI',
    numero_documento: s(caminante.numero_documento),
    celular: s(caminante.celular),
    correo: s(caminante.correo),
    direccion: s(caminante.direccion),
    barrio: s(caminante.barrio),
    telefono_fijo: s(caminante.telefono_fijo),
    fecha_nacimiento: s(caminante.fecha_nacimiento).slice(0, 10),
    edad: s(caminante.edad),
    talla_camiseta: s(caminante.talla_camiseta),
    eps: s(caminante.eps),
    alergias: s(caminante.alergias),
    restricciones_alimentarias: s(caminante.restricciones_alimentarias),
    medicamentos: s(caminante.medicamentos),
  })
  const [sacramentos, setSacramentos] = useState<string[]>(Array.isArray(caminante.sacramentos) ? caminante.sacramentos : [])
  const [cts, setCts] = useState<Contacto[]>(() => {
    const base = (contactos || []).slice(0, 2).map((c: any) => ({ nombre: s(c.nombre), parentesco: s(c.parentesco), celular: s(c.celular) }))
    while (base.length < 2) base.push({ nombre: '', parentesco: '', celular: '' })
    return base
  })
  const [guardando, setGuardando] = useState(false)
  const [error, setError] = useState('')

  const set = (k: keyof typeof f) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => {
    const v = e.target.value
    setF(p => (k === 'fecha_nacimiento' ? { ...p, fecha_nacimiento: v, edad: calcularEdad(v) || p.edad } : { ...p, [k]: v }))
  }
  const setCt = (i: number, k: keyof Contacto, v: string) => setCts(p => p.map((c, j) => (j === i ? { ...c, [k]: v } : c)))

  async function guardar() {
    setError('')
    if (!f.nombre.trim()) { setError('El nombre es obligatorio.'); return }
    setGuardando(true)
    try {
      const { data: { session } } = await supabase.auth.getSession()
      const res = await fetch(`/api/caminantes/${caminante.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${session?.access_token ?? ''}` },
        body: JSON.stringify({ datos: { ...f, sacramentos }, contactos: cts }),
      })
      const data = await res.json()
      if (!data.success) throw new Error(data.error || 'No se pudo guardar')
      onGuardado()
    } catch (err: any) {
      setError(err.message || 'Error guardando')
      setGuardando(false)
    }
  }

  const campo = (k: keyof typeof f, label: string, props: React.InputHTMLAttributes<HTMLInputElement> = {}) => (
    <div>
      <label style={labelStyle}>{label}</label>
      <input value={f[k]} onChange={set(k)} style={inputStyle} {...props} />
    </div>
  )

  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(13,13,20,0.45)', zIndex: 200, display: 'flex', alignItems: 'flex-end', justifyContent: 'center' }} onClick={onCerrar}>
      <div onClick={e => e.stopPropagation()} style={{ background: '#f7f8fc', width: '100%', maxWidth: 560, maxHeight: '92vh', borderRadius: '18px 18px 0 0', display: 'flex', flexDirection: 'column' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '16px 20px', borderBottom: '0.5px solid #e5e7eb', background: '#fff', borderRadius: '18px 18px 0 0' }}>
          <div style={{ fontSize: 16, fontWeight: 500, color: '#0d0d14' }}>Editar datos del caminante</div>
          <button onClick={onCerrar} style={{ width: 30, height: 30, borderRadius: '50%', border: 'none', background: '#f3f4f6', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer' }}><X size={16} color="#6b7280" /></button>
        </div>

        <div style={{ overflowY: 'auto', padding: '4px 20px 20px' }}>
          <p style={seccionStyle}>Identificación</p>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            {campo('nombre', 'Nombre completo')}
            <div style={{ display: 'grid', gridTemplateColumns: '120px 1fr', gap: 10 }}>
              <div>
                <label style={labelStyle}>Tipo doc.</label>
                <select value={f.tipo_documento} onChange={set('tipo_documento')} style={inputStyle}>
                  {[...new Set([...TIPOS_DOC, f.tipo_documento])].filter(Boolean).map(t => <option key={t}>{t}</option>)}
                </select>
              </div>
              {campo('numero_documento', 'Número de documento', { inputMode: 'numeric' })}
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 100px', gap: 10 }}>
              {campo('fecha_nacimiento', 'Fecha de nacimiento', { type: 'date' })}
              {campo('edad', 'Edad', { type: 'number', min: 0, max: 120 })}
            </div>
          </div>

          <p style={seccionStyle}>Contacto</p>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
              {campo('celular', 'Celular', { inputMode: 'tel' })}
              {campo('telefono_fijo', 'Teléfono fijo', { inputMode: 'tel' })}
            </div>
            {campo('correo', 'Correo', { type: 'email' })}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
              {campo('direccion', 'Dirección')}
              {campo('barrio', 'Barrio')}
            </div>
          </div>

          <p style={seccionStyle}>Retiro</p>
          <label style={labelStyle}>Talla de camiseta</label>
          <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginBottom: 12 }}>
            {TALLAS.map(t => (
              <button key={t} type="button" onClick={() => setF(p => ({ ...p, talla_camiseta: p.talla_camiseta === t ? '' : t }))}
                style={{ padding: '8px 14px', borderRadius: 10, fontSize: 13, fontWeight: 500, cursor: 'pointer', border: f.talla_camiseta === t ? '1.5px solid #0f1787' : '0.5px solid #e5e7eb', background: f.talla_camiseta === t ? '#0f1787' : '#fff', color: f.talla_camiseta === t ? '#fff' : '#374151' }}>
                {t}
              </button>
            ))}
          </div>
          <label style={labelStyle}>Sacramentos</label>
          <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
            {SACRAMENTOS_OPTS.map(sc => {
              const on = sacramentos.includes(sc)
              return (
                <button key={sc} type="button" onClick={() => setSacramentos(p => (on ? p.filter(x => x !== sc) : [...p, sc]))}
                  style={{ padding: '8px 14px', borderRadius: 10, fontSize: 13, cursor: 'pointer', border: on ? '1.5px solid #0f1787' : '0.5px solid #e5e7eb', background: on ? '#eef0ff' : '#fff', color: on ? '#0f1787' : '#374151', fontWeight: on ? 600 : 400 }}>
                  {sc}
                </button>
              )
            })}
          </div>

          <p style={seccionStyle}>Salud</p>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            {campo('eps', 'EPS')}
            {campo('alergias', 'Alergias')}
            {campo('restricciones_alimentarias', 'Restricciones alimentarias')}
            {campo('medicamentos', 'Medicamentos')}
          </div>

          <p style={seccionStyle}>Contactos de emergencia</p>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            {cts.map((c, i) => (
              <div key={i} style={{ background: '#fff', border: '0.5px solid #e5e7eb', borderRadius: 12, padding: 12, display: 'flex', flexDirection: 'column', gap: 8 }}>
                <span style={{ fontSize: 11, color: '#9ca3af' }}>Contacto {i + 1}{i === 1 ? ' (opcional)' : ''}</span>
                <input value={c.nombre} onChange={e => setCt(i, 'nombre', e.target.value)} placeholder="Nombre" style={inputStyle} />
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
                  <input value={c.parentesco} onChange={e => setCt(i, 'parentesco', e.target.value)} placeholder="Parentesco" style={inputStyle} />
                  <input value={c.celular} onChange={e => setCt(i, 'celular', e.target.value)} placeholder="Celular" inputMode="tel" style={inputStyle} />
                </div>
              </div>
            ))}
          </div>
        </div>

        <div style={{ padding: '12px 20px 20px', borderTop: '0.5px solid #e5e7eb', background: '#fff' }}>
          {error && <p style={{ fontSize: 13, color: '#dc2626', margin: '0 0 10px' }}>{error}</p>}
          <button onClick={guardar} disabled={guardando} style={{ width: '100%', height: 46, border: 'none', borderRadius: 12, background: guardando ? '#9ca3af' : '#0f1787', color: '#fff', fontSize: 15, fontWeight: 600, cursor: 'pointer' }}>
            {guardando ? 'Guardando…' : 'Guardar cambios'}
          </button>
        </div>
      </div>
    </div>
  )
}
