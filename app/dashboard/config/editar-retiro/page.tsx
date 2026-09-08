'use client'
import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { useRetiroActual } from '@/lib/retiro-context'
import { ChevronLeft, Info } from 'lucide-react'

const inputStyle: React.CSSProperties = {
  width: '100%', padding: '11px 14px', borderRadius: 10,
  border: '1.5px solid #e2e4f0', fontSize: 14,
  outline: 'none', boxSizing: 'border-box', fontFamily: 'inherit',
}
const labelStyle: React.CSSProperties = {
  display: 'block', fontSize: 12, fontWeight: 600, color: '#6b7280', marginBottom: 6,
}

export default function EditarRetiroPage() {
  const router = useRouter()
  const retiro = useRetiroActual()

  const [nombre, setNombre] = useState(retiro.nombre)
  const [fechaInicio, setFechaInicio] = useState(retiro.fecha_inicio)
  const [fechaFin, setFechaFin] = useState(retiro.fecha_fin)
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

  async function guardar() {
    setError('')
    if (!nombre.trim() || !fechaInicio || !fechaFin || !lugar.trim()) {
      setError('Completa al menos nombre, fechas y lugar.')
      return
    }

    setGuardando(true)
    try {
      const res = await fetch('/api/retiros/actual', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          nombre, fecha_inicio: fechaInicio, fecha_fin: fechaFin, lugar,
          meta_financiera: metaFinanciera, capacidad_caminantes: capacidadCaminantes, capacidad_servidores: capacidadServidores,
          costo_caminante: costoCaminante, costo_servidor: costoServidor,
          link_formulario: linkFormulario, link_manual: linkManual,
        }),
      })
      const data = await res.json()
      if (!data.success) throw new Error(data.error || 'Error guardando los cambios')
      // Recarga completa para que RetiroProvider vuelva a leer los datos actualizados
      window.location.href = '/dashboard/config'
    } catch (err: any) {
      setError(err.message || 'Error guardando los cambios')
      setGuardando(false)
    }
  }

  return (
    <div style={{ background: '#f7f8fc', minHeight: '100vh', paddingBottom: 60 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '18px 20px 14px' }}>
        <button onClick={() => router.push('/dashboard/config')} style={{ width: 34, height: 34, borderRadius: '50%', background: '#fff', border: '0.5px solid #e5e7eb', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer' }}>
          <ChevronLeft size={18} color="#6b7280" />
        </button>
        <div style={{ fontSize: 17, fontWeight: 500, color: '#0d0d14' }}>Editar retiro actual</div>
      </div>

      <div style={{ padding: '0 20px 16px' }}>
        <div style={{ background: '#eff6ff', border: '0.5px solid #bfdbfe', borderRadius: 12, padding: 14, display: 'flex', gap: 10 }}>
          <Info size={18} color="#0f1787" style={{ flexShrink: 0, marginTop: 1 }} />
          <p style={{ fontSize: 13, color: '#1e3a8a', margin: 0, lineHeight: 1.5 }}>
            Esto solo actualiza los datos de <strong>{retiro.nombre}</strong> (el link del formulario, fechas, costos, etc). No archiva nada ni crea un retiro nuevo — para eso usa "Crear nuevo retiro" en Configuración.
          </p>
        </div>
      </div>

      <div style={{ padding: '0 20px', display: 'flex', flexDirection: 'column', gap: 14 }}>
        <div>
          <label style={labelStyle}>Nombre del retiro</label>
          <input value={nombre} onChange={e => setNombre(e.target.value)} style={inputStyle} />
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

        <button onClick={guardar} disabled={guardando}
          style={{ width: '100%', padding: 14, borderRadius: 12, border: 'none', background: guardando ? '#9ca3af' : '#0f1787', color: '#fff', fontSize: 15, fontWeight: 600, cursor: guardando ? 'not-allowed' : 'pointer', marginTop: 6 }}>
          {guardando ? 'Guardando...' : 'Guardar cambios'}
        </button>
      </div>
    </div>
  )
}
