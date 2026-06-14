'use client'
import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'
import BottomNav from '@/components/BottomNav'
import { Users, ChevronRight } from 'lucide-react'

export default function PersonasPage() {
  const router = useRouter()
  const [totalCaminantes, setTotalCaminantes] = useState(0)
  const [totalServidores, setTotalServidores] = useState(0)
  const [pagadosCaminantes, setPagadosCaminantes] = useState(0)
  const [pagadosServidores, setPagadosServidores] = useState(0)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    async function cargar() {
      const { data: r } = await supabase.from('retiros').select('id').eq('estado', 'activo').single()
      if (!r) return

      const { data: cam } = await supabase
        .from('vista_pagos_caminantes')
        .select('estado_pago')
        .eq('retiro_id', r.id)
      if (cam) {
        setTotalCaminantes(cam.length)
        setPagadosCaminantes(cam.filter(c => c.estado_pago === 'completo').length)
      }

      const { data: ser } = await supabase
        .from('vista_pagos_servidores')
        .select('estado_pago')
        .eq('retiro_id', r.id)
      if (ser) {
        setTotalServidores(ser.length)
        setPagadosServidores(ser.filter(s => s.estado_pago === 'completo').length)
      }

      setLoading(false)
    }
    cargar()
  }, [])

  const opciones = [
    {
      label: 'Caminantes',
      descripcion: 'Participantes del retiro',
      href: '/dashboard/caminantes',
      total: totalCaminantes,
      max: 50,
      pagados: pagadosCaminantes,
      color: '#0f1787',
      bgColor: '#f0f1ff',
      emoji: '🚶',
    },
    {
      label: 'Servidores',
      descripcion: 'Equipo de servicio',
      href: '/dashboard/servidores',
      total: totalServidores,
      max: 50,
      pagados: pagadosServidores,
      color: '#065f46',
      bgColor: '#ecfdf5',
      emoji: '🤝',
    },
  ]

  return (
    <div style={{ background: '#f7f8fc', minHeight: '100vh', paddingBottom: 80 }}>

      {/* Header */}
      <div style={{ padding: '18px 20px 24px' }}>
        <div style={{ fontSize: 17, fontWeight: 500, color: '#0d0d14' }}>Personas</div>
        <div style={{ fontSize: 13, color: '#9ca3af', marginTop: 2 }}>
          {loading ? '...' : `${totalCaminantes + totalServidores} personas registradas`}
        </div>
      </div>

      <div style={{ padding: '0 20px', display: 'flex', flexDirection: 'column', gap: 14 }}>
        {opciones.map(op => {
          const pct = Math.round((op.total / op.max) * 100)
          return (
            <div key={op.href} onClick={() => router.push(op.href)}
              style={{ background: '#fff', borderRadius: 16, padding: '20px', border: '0.5px solid #e5e7eb', cursor: 'pointer' }}>

              {/* Top */}
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                  <div style={{ width: 44, height: 44, borderRadius: 12, background: op.bgColor, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 22 }}>
                    {op.emoji}
                  </div>
                  <div>
                    <div style={{ fontSize: 16, fontWeight: 600, color: '#0d0d14' }}>{op.label}</div>
                    <div style={{ fontSize: 12, color: '#9ca3af', marginTop: 1 }}>{op.descripcion}</div>
                  </div>
                </div>
                <ChevronRight size={18} color="#d1d5db" />
              </div>

              {/* Stats */}
              <div style={{ display: 'flex', gap: 10, marginBottom: 14 }}>
                <div style={{ flex: 1, background: op.bgColor, borderRadius: 10, padding: '10px 12px' }}>
                  <div style={{ fontSize: 11, color: '#6b7280', marginBottom: 2 }}>Inscritos</div>
                  <div style={{ fontSize: 20, fontWeight: 600, color: op.color }}>
                    {loading ? '—' : op.total}
                    <span style={{ fontSize: 12, fontWeight: 400, color: '#9ca3af' }}>/{op.max}</span>
                  </div>
                </div>
                <div style={{ flex: 1, background: '#f0fdf4', borderRadius: 10, padding: '10px 12px' }}>
                  <div style={{ fontSize: 11, color: '#6b7280', marginBottom: 2 }}>Pago completo</div>
                  <div style={{ fontSize: 20, fontWeight: 600, color: '#16a34a' }}>
                    {loading ? '—' : op.pagados}
                    <span style={{ fontSize: 12, fontWeight: 400, color: '#9ca3af' }}>/{op.total}</span>
                  </div>
                </div>
              </div>

              {/* Barra cupo */}
              <div>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 5 }}>
                  <span style={{ fontSize: 11, color: '#9ca3af' }}>Cupo</span>
                  <span style={{ fontSize: 11, fontWeight: 600, color: pct >= 100 ? '#dc2626' : op.color }}>{pct}%</span>
                </div>
                <div style={{ height: 5, background: '#f3f4f6', borderRadius: 3 }}>
                  <div style={{ height: 5, borderRadius: 3, background: pct >= 100 ? '#dc2626' : op.color, width: `${Math.min(pct, 100)}%`, transition: 'width 0.5s' }} />
                </div>
              </div>
            </div>
          )
        })}
      </div>

      <BottomNav />
    </div>
  )
}
