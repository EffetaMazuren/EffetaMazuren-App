'use client'
import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'
import BottomNav from '@/components/BottomNav'
import { ChevronRight } from 'lucide-react'

const CUPO_MAXIMO = 60

export default function PersonasPage() {
  const router = useRouter()
  const [loading, setLoading] = useState(true)

  // Caminantes
  const [totalCaminantes, setTotalCaminantes] = useState(0)
  const [confirmadosCaminantes, setConfirmadosCaminantes] = useState(0)
  const [pagadosCaminantes, setPagadosCaminantes] = useState(0)

  // Servidores
  const [totalServidores, setTotalServidores] = useState(0)
  const [internosServidores, setInternosServidores] = useState(0)
  const [pagadosServidores, setPagadosServidores] = useState(0)

  useEffect(() => {
    async function cargar() {
      const { data: r } = await supabase.from('retiros').select('id').eq('estado', 'activo').single()
      if (!r) return

      const { data: cam } = await supabase
        .from('vista_pagos_caminantes')
        .select('estado_pago, inscrito_oficialmente')
        .eq('retiro_id', r.id)
      if (cam) {
        setTotalCaminantes(cam.length)
        setConfirmadosCaminantes(cam.filter(c => c.inscrito_oficialmente).length)
        setPagadosCaminantes(cam.filter(c => c.estado_pago === 'completo').length)
      }

      const { data: ser } = await supabase
        .from('vista_pagos_servidores')
        .select('estado_pago, es_interno')
        .eq('retiro_id', r.id)
      if (ser) {
        setTotalServidores(ser.length)
        setInternosServidores(ser.filter(s => s.es_interno).length)
        setPagadosServidores(ser.filter(s => s.es_interno && s.estado_pago === 'completo').length)
      }

      setLoading(false)
    }
    cargar()
  }, [])

  const StatBox = ({ label, value, max, color, bg }: { label: string; value: number; max?: number; color: string; bg: string }) => {
    const pct = max ? Math.min((value / max) * 100, 100) : null
    const lleno = max ? value >= max : false
    return (
      <div style={{ flex: 1, background: bg, borderRadius: 12, padding: '12px 14px' }}>
        <div style={{ fontSize: 11, color: '#6b7280', marginBottom: 4 }}>{label}</div>
        <div style={{ fontSize: 20, fontWeight: 600, color }}>
          {loading ? '—' : value}
          {max && <span style={{ fontSize: 12, fontWeight: 400, color: '#9ca3af' }}>/{max}</span>}
        </div>
        {pct !== null && (
          <div style={{ marginTop: 8 }}>
            <div style={{ height: 3, background: 'rgba(0,0,0,0.08)', borderRadius: 2 }}>
              <div style={{ height: 3, borderRadius: 2, background: lleno ? '#dc2626' : color, width: `${pct}%`, transition: 'width 0.5s' }} />
            </div>
            <div style={{ fontSize: 10, color: lleno ? '#dc2626' : '#9ca3af', marginTop: 3, textAlign: 'right', fontWeight: lleno ? 600 : 400 }}>
              {lleno ? '🔒 Lleno' : `${Math.round(pct)}%`}
            </div>
          </div>
        )}
      </div>
    )
  }

  return (
    <div style={{ background: '#f7f8fc', minHeight: '100vh', paddingBottom: 80 }}>

      <div style={{ padding: '18px 20px 24px' }}>
        <div style={{ fontSize: 17, fontWeight: 500, color: '#0d0d14' }}>Personas</div>
        <div style={{ fontSize: 13, color: '#9ca3af', marginTop: 2 }}>
          {loading ? '...' : `${totalCaminantes + totalServidores} personas registradas`}
        </div>
      </div>

      <div style={{ padding: '0 20px', display: 'flex', flexDirection: 'column', gap: 14 }}>

        {/* ── CAMINANTES ── */}
        <div onClick={() => router.push('/dashboard/caminantes')}
          style={{ background: '#fff', borderRadius: 16, padding: '20px', border: '0.5px solid #e5e7eb', cursor: 'pointer' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
              <div style={{ width: 44, height: 44, borderRadius: 12, background: '#f0f1ff', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 22 }}>🚶</div>
              <div>
                <div style={{ fontSize: 16, fontWeight: 600, color: '#0d0d14' }}>Caminantes</div>
                <div style={{ fontSize: 12, color: '#9ca3af', marginTop: 1 }}>Participantes del retiro</div>
              </div>
            </div>
            <ChevronRight size={18} color="#d1d5db" />
          </div>
          <div style={{ display: 'flex', gap: 8 }}>
            <StatBox label="Inscritos" value={totalCaminantes} color="#0f1787" bg="#f0f1ff" />
            <StatBox label="Confirmados" value={confirmadosCaminantes} max={CUPO_MAXIMO} color="#0f1787" bg="#f0f1ff" />
            <StatBox label="Pago completo" value={pagadosCaminantes} max={CUPO_MAXIMO} color="#16a34a" bg="#f0fdf4" />
          </div>
        </div>

        {/* ── SERVIDORES ── */}
        <div onClick={() => router.push('/dashboard/servidores')}
          style={{ background: '#fff', borderRadius: 16, padding: '20px', border: '0.5px solid #e5e7eb', cursor: 'pointer' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
              <div style={{ width: 44, height: 44, borderRadius: 12, background: '#ecfdf5', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 22 }}>🤝</div>
              <div>
                <div style={{ fontSize: 16, fontWeight: 600, color: '#0d0d14' }}>Servidores</div>
                <div style={{ fontSize: 12, color: '#9ca3af', marginTop: 1 }}>Equipo de servicio</div>
              </div>
            </div>
            <ChevronRight size={18} color="#d1d5db" />
          </div>
          <div style={{ display: 'flex', gap: 8 }}>
            <StatBox label="Inscritos" value={totalServidores} color="#065f46" bg="#ecfdf5" />
            <StatBox label="Internos" value={internosServidores} max={CUPO_MAXIMO} color="#065f46" bg="#ecfdf5" />
            <StatBox label="Pago completo" value={pagadosServidores} max={CUPO_MAXIMO} color="#16a34a" bg="#f0fdf4" />
          </div>
        </div>

      </div>

      <BottomNav />
    </div>
  )
}
