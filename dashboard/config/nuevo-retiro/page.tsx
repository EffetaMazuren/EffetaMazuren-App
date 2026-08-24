'use client'
import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { useRetiroActual } from '@/lib/retiro-context'
import { ChevronLeft, AlertTriangle } from 'lucide-react'

const inputStyle: React.CSSProperties = {
  width: '100%', padding: '11px 14px', borderRadius: 10,
  border: '1.5px solid #e2e4f0', fontSize: 14,
  outline: 'none', boxSizing: 'border-box', fontFamily: 'inherit',
}
const labelStyle: React.CSSProperties = {
  display: 'block', fontSize: 12, fontWeight: 600, color: '#6b7280', marginBottom: 6,
}

export default function NuevoRetiroPage() {
  const router = useRouter()
  const retiro = useRetiroActual()

  const [nombre, setNombre] = useState('')
  const [fechaInicio, setFechaInicio] = useState('')
  const [fechaFin, setFechaFin] = useState('')
  const [lugar, setLugar] = useState(retiro.lugar)
  const [metaFinanciera, setMetaFinanciera] = useState(String(retiro.meta_financiera))
  const [capacidadCaminantes, setCapacidadCaminantes] = useState(String(retiro.capacidad_caminantes))
  const [capacidadServidores, setCapacidadServidores] = useState(String(retiro.capacidad_servidores))
  const [costoCaminante, setCostoCaminante] = useState(String(retiro.costo_caminante))
  const [costoServidor, setCostoServidor] = useState(String(retiro.costo_servidor))
  const [linkFormulario, setLinkFormulario] = useState(retiro.link_formulario)
  const [linkManual, setLinkManual] = useState(retiro.link_manual)

  const [guardando, setGuardando] = useState(false)
  const [error, setError] = useState('')

  async function crearRetiro() {
    setError('')
    if (!nombre.trim() || !fechaInicio || !fechaFin || !lugar.trim()) {
      setError('Completa al menos nombre, fechas y lugar.')
      return
    }
    if (!confirm(`¿Archivar "${retiro.nombre}" y activar "${nombre.trim()}" como el nuevo retiro? Los datos de "${retiro.nombre}" no se borran, solo dejan de mostrarse como el retiro activo. Esta acción no se puede deshacer desde aquí.`)) return

    setGuardando(true)
    try {
      const res = await fetch('/api/retiros/nuevo', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          nombre, fecha_inicio: fechaInicio, fecha_fin: fechaFin, lugar,
          meta_financiera: metaFinanciera, capacidad_caminantes: capacidadCaminantes, capacidad_servidores: capacidadServidores,
          costo_caminante: costoCaminante, costo_servidor: costoServidor,
          link_formulario: linkFormulario, link_manual: linkManual,
        }),
      })
      const data = await res.json()
      if (!data.success) throw new Error(data.error || 'Error creando el retiro')
      // Recarga completa para que RetiroProvider vuelva a leer cuál retiro está activo
      window.location.href = '/dashboard'
    } catch (err: any) {
      setError(err.message || 'Error creando el retiro')
      setGuardando(false)
    }
  }

  return (
    <div style={{ background: '#f7f8fc', minHeight: '100vh', paddingBottom: 60 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '18px 20px 14px' }}>
        <button onClick={() => router.push('/dashboard/config')} style={{ width: 34, height: 34, borderRadius: '50%', background: '#fff', border: '0.5px solid #e5e7eb', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer' }}>
          <ChevronLeft size={18} color="#6b7280" />
        </button>
        <div style={{ fontSize: 17, fontWeight: 500, color: '#0d0d14' }}>Nuevo retiro</div>
      </div>

      <div style={{ padding: '0 20px 16px' }}>
        <div style={{ background: '#fffbeb', border: '0.5px solid #fde68a', borderRadius: 12, padding: 14, display: 'flex', gap: 10 }}>
          <AlertTriangle size={18} color="#d97706" style={{ flexShrink: 0, marginTop: 1 }} />
          <p style={{ fontSize: 13, color: '#92400e', margin: 0, lineHeight: 1.5 }}>
            Retiro activo hoy: <strong>{retiro.nombre}</strong>. Al crear el nuevo, este se archiva automáticamente — sus caminantes, servidores, pagos y todo lo demás quedan guardados tal como están, solo dejan de mostrarse como el retiro en curso.
          </p>
        </div>
      </div>

      <div style={{ padding: '0 20px', display: 'flex', flexDirection: 'column', gap: 14 }}>
        <div>
          <label style={labelStyle}>Nombre del retiro</label>
          <input value={nombre} onChange={e => setNombre(e.target.value)} placeholder="Ej: X Retiro Effetá Mazuren" style={inputStyle} />
        </div>

        <div style={{ display: 'flex', gap: 10 }}>
          <div style={{ flex: 1 }}>
            <label style={labelStyle}>Fecha inicio</label>
            <input type="date" value={fechaInicio} onChange={e => setFechaInicio(e.target.value)} style={inputStyle} />
          </div>
          <div style={{ flex: 1 }}>
            <label style={labelStyle}>Fecha fin</label>
            <input type="date" value={fechaFin} onChange={e => setFechaFin(e.target.value)} style={inputStyle} />
          </div>
        </div>

        <div>
          <label style={labelStyle}>Lugar</label>
          <input value={lugar} onChange={e => setLugar(e.target.value)} style={inputStyle} />
        </div>

        <div>
          <label style={labelStyle}>Meta de recaudo (COP)</label>
          <input type="number" value={metaFinanciera} onChange={e => setMetaFinanciera(e.target.value)} style={inputStyle} />
        </div>

        <div style={{ display: 'flex', gap: 10 }}>
          <div style={{ flex: 1 }}>
            <label style={labelStyle}>Cupo caminantes</label>
            <input type="number" value={capacidadCaminantes} onChange={e => setCapacidadCaminantes(e.target.value)} style={inputStyle} />
          </div>
          <div style={{ flex: 1 }}>
            <label style={labelStyle}>Cupo servidores</label>
            <input type="number" value={capacidadServidores} onChange={e => setCapacidadServidores(e.target.value)} style={inputStyle} />
          </div>
        </div>

        <div style={{ display: 'flex', gap: 10 }}>
          <div style={{ flex: 1 }}>
            <label style={labelStyle}>Costo caminante (COP)</label>
            <input type="number" value={costoCaminante} onChange={e => setCostoCaminante(e.target.value)} style={inputStyle} />
          </div>
          <div style={{ flex: 1 }}>
            <label style={labelStyle}>Costo servidor (COP)</label>
            <input type="number" value={costoServidor} onChange={e => setCostoServidor(e.target.value)} style={inputStyle} />
          </div>
        </div>

        <div>
          <label style={labelStyle}>Link del formulario de inscripción</label>
          <input value={linkFormulario} onChange={e => setLinkFormulario(e.target.value)} style={inputStyle} />
        </div>

        <div>
          <label style={labelStyle}>Link del manual</label>
          <input value={linkManual} onChange={e => setLinkManual(e.target.value)} style={inputStyle} />
        </div>

        {error && (
          <p style={{ color: '#dc2626', fontSize: 13, margin: 0, background: '#fef2f2', padding: '10px 12px', borderRadius: 8 }}>{error}</p>
        )}

        <button onClick={crearRetiro} disabled={guardando}
          style={{ width: '100%', padding: 14, borderRadius: 12, border: 'none', background: guardando ? '#9ca3af' : '#0f1787', color: '#fff', fontSize: 15, fontWeight: 600, cursor: guardando ? 'not-allowed' : 'pointer', marginTop: 6 }}>
          {guardando ? 'Creando...' : 'Archivar retiro actual y activar este'}
        </button>
      </div>
    </div>
  )
}
