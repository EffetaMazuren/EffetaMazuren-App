'use client'
import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'
import BottomNav from '@/components/BottomNav'
import { Bell, UserCircle, ChevronRight, Mail, EyeOff, HeartPulse } from 'lucide-react'

export default function Dashboard() {
  const router = useRouter()
  const [usuario, setUsuario] = useState<any>(null)
  const [retiro, setRetiro] = useState<any>(null)
  const [cupos, setCupos] = useState<any>(null)
  const [balance, setBalance] = useState<any>(null)
  const [stats, setStats] = useState({ total: 0, completos: 0, parciales: 0, sinPago: 0, sinCorreo: 0, sorpresas: 0, conMedicamentos: 0 })
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    async function cargar() {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) { router.push('/'); return }

      const { data: u } = await supabase.from('usuarios').select('*').eq('id', user.id).single()
      if (!u || u.rol !== 'lider') { router.push('/servidor'); return }
      setUsuario(u)

      const { data: r } = await supabase.from('retiros').select('*').eq('estado', 'activo').single()
      setRetiro(r)

      if (r) {
        const { data: c } = await supabase.from('vista_cupos').select('*').eq('retiro_id', r.id).single()
        setCupos(c)

        const { data: b } = await supabase.from('vista_balance_retiro').select('*').eq('retiro_id', r.id).single()
        setBalance(b)

        const { data: caminantes } = await supabase.from('vista_pagos_caminantes').select('*').eq('retiro_id', r.id)
        if (caminantes) {
          setStats({
            total: caminantes.length,
            completos: caminantes.filter(c => c.estado_pago === 'completo').length,
            parciales: caminantes.filter(c => c.estado_pago === 'parcial').length,
            sinPago: caminantes.filter(c => c.estado_pago === 'sin_pago').length,
            sinCorreo: caminantes.filter(c => c.estado_correo === 'sin_enviar').length,
            sorpresas: caminantes.filter(c => c.es_sorpresa).length,
            conMedicamentos: 0,
          })
        }
      }
      setLoading(false)
    }
    cargar()
  }, [])

  if (loading) return (
    <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#f7f8fc' }}>
      <div style={{ color: '#9ca3af', fontSize: 14 }}>Cargando...</div>
    </div>
  )

  const pctMeta = balance ? Math.round((balance.balance / balance.meta_financiera) * 100) : 0
  const pctCupo = cupos ? Math.round((cupos.caminantes_con_abono / cupos.capacidad_caminantes) * 100) : 0
  const nombre = usuario?.nombre?.split(' ')[0] || 'Líder'

  const hoy = new Date()
  const diasParaRetiro = retiro ? Math.ceil((new Date(retiro.fecha_inicio).getTime() - hoy.getTime()) / (1000 * 60 * 60 * 24)) : 0

  function fmt(n: number) {
    if (n >= 1000000) return `$${(n / 1000000).toFixed(1)}M`
    if (n >= 1000) return `$${(n / 1000).toFixed(0)}K`
    return `$${n.toLocaleString()}`
  }

  return (
    <div style={{ background: '#f7f8fc', minHeight: '100vh', paddingBottom: 80 }}>
      {/* Nav */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '18px 20px 10px' }}>
        <div style={{ fontSize: 11, fontWeight: 500, letterSpacing: 1.5, textTransform: 'uppercase', color: '#9ca3af' }}>
          EFFETÁ · Mazuren
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          <button style={{ width: 34, height: 34, borderRadius: '50%', background: '#fff', border: '0.5px solid #e5e7eb', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer' }}>
            <Bell size={16} color="#6b7280" />
          </button>
          <button onClick={() => supabase.auth.signOut().then(() => router.push('/'))} style={{ width: 34, height: 34, borderRadius: '50%', background: '#fff', border: '0.5px solid #e5e7eb', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer' }}>
            <UserCircle size={16} color="#6b7280" />
          </button>
        </div>
      </div>

      {/* Saludo */}
      <div style={{ padding: '4px 20px 20px' }}>
        <div style={{ fontSize: 24, fontWeight: 500, color: '#0d0d14', letterSpacing: -0.4 }}>Hola, {nombre} 👋</div>
        <div style={{ fontSize: 13, color: '#9ca3af', marginTop: 2 }}>
          {diasParaRetiro > 0 ? `Retiro en ${diasParaRetiro} días` : 'Retiro en curso'}
        </div>
      </div>

      {/* Retiro card */}
      {retiro && (
        <div style={{ margin: '0 20px 20px', background: '#0f1787', borderRadius: 20, padding: 22 }}>
          <div style={{ fontSize: 10, letterSpacing: 1.5, textTransform: 'uppercase', color: 'rgba(255,255,255,0.4)', marginBottom: 6 }}>Retiro activo</div>
          <div style={{ fontSize: 17, fontWeight: 500, color: '#fff', marginBottom: 2 }}>{retiro.nombre}</div>
          <div style={{ fontSize: 12, color: 'rgba(255,255,255,0.4)', marginBottom: 18 }}>
            {new Date(retiro.fecha_inicio).toLocaleDateString('es-CO', { day: 'numeric', month: 'long' })} — {new Date(retiro.fecha_fin).toLocaleDateString('es-CO', { day: 'numeric', month: 'long', year: 'numeric' })}
          </div>
          <div style={{ height: 4, background: 'rgba(255,255,255,0.15)', borderRadius: 2, marginBottom: 10 }}>
            <div style={{ height: 4, background: '#fff', borderRadius: 2, width: `${pctMeta}%` }} />
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-between' }}>
            <div style={{ textAlign: 'center' }}>
              <div style={{ fontSize: 18, fontWeight: 500, color: '#fff' }}>{pctMeta}%</div>
              <div style={{ fontSize: 10, color: 'rgba(255,255,255,0.4)', marginTop: 2 }}>Meta financiada</div>
            </div>
            <div style={{ width: 0.5, background: 'rgba(255,255,255,0.15)' }} />
            <div style={{ textAlign: 'center' }}>
              <div style={{ fontSize: 18, fontWeight: 500, color: '#fff' }}>{balance ? fmt(balance.balance) : '$0'}</div>
              <div style={{ fontSize: 10, color: 'rgba(255,255,255,0.4)', marginTop: 2 }}>Recaudado</div>
            </div>
            <div style={{ width: 0.5, background: 'rgba(255,255,255,0.15)' }} />
            <div style={{ textAlign: 'center' }}>
              <div style={{ fontSize: 18, fontWeight: 500, color: '#fff' }}>{balance ? fmt(balance.falta_para_meta) : '$0'}</div>
              <div style={{ fontSize: 10, color: 'rgba(255,255,255,0.4)', marginTop: 2 }}>Pendiente</div>
            </div>
          </div>
        </div>
      )}

      {/* KPIs */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, margin: '0 20px 20px' }}>
        {[
          { val: stats.total, label: 'Caminantes', chip: `${stats.completos} pagos completos`, chipColor: '#dcfce7', chipText: '#166534' },
          { val: stats.parciales, label: 'Abonos parciales', chip: `$${((stats.parciales * 500000) / 2).toLocaleString()} por cobrar`, chipColor: '#fef3c7', chipText: '#92400e' },
          { val: stats.sinCorreo, label: 'Sin correo', chip: 'Pendientes de envío', chipColor: '#fef3c7', chipText: '#92400e' },
          { val: cupos?.cupos_disponibles ?? 0, label: 'Cupos disponibles', chip: cupos?.cupo_lleno ? '🔒 Cupo lleno' : `${cupos?.caminantes_con_abono ?? 0}/50 inscritos`, chipColor: cupos?.cupo_lleno ? '#fee2e2' : '#e8eaf6', chipText: cupos?.cupo_lleno ? '#991b1b' : '#0f1787' },
        ].map((k, i) => (
          <div key={i} style={{ background: '#fff', borderRadius: 14, padding: 16, border: '0.5px solid #e5e7eb' }}>
            <div style={{ fontSize: 26, fontWeight: 500, color: '#0d0d14', letterSpacing: -0.5, lineHeight: 1 }}>{k.val}</div>
            <div style={{ fontSize: 11, color: '#9ca3af', marginTop: 6 }}>{k.label}</div>
            <div style={{ display: 'inline-flex', alignItems: 'center', marginTop: 8, fontSize: 11, fontWeight: 500, padding: '3px 8px', borderRadius: 20, background: k.chipColor, color: k.chipText }}>
              {k.chip}
            </div>
          </div>
        ))}
      </div>

      {/* Cupo bar */}
      {cupos && (
        <div style={{ margin: '0 20px 20px', background: '#fff', borderRadius: 14, padding: 16, border: '0.5px solid #e5e7eb' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 12 }}>
            <div>
              <div style={{ fontSize: 13, fontWeight: 500, color: '#0d0d14' }}>Cupos de caminantes</div>
              <div style={{ fontSize: 11, color: '#9ca3af', marginTop: 2 }}>Se bloquea al llegar a 50 con abono</div>
            </div>
            <div style={{ textAlign: 'right' }}>
              <div style={{ fontSize: 22, fontWeight: 500, color: '#0d0d14' }}>
                {cupos.caminantes_con_abono}<span style={{ fontSize: 13, color: '#9ca3af', fontWeight: 400 }}>/50</span>
              </div>
              <div style={{ fontSize: 11, fontWeight: 500, padding: '3px 10px', borderRadius: 20, background: cupos.cupo_lleno ? '#fee2e2' : '#fef3c7', color: cupos.cupo_lleno ? '#991b1b' : '#92400e', marginTop: 4 }}>
                {cupos.cupo_lleno ? '🔒 Cupo lleno' : `${cupos.cupos_disponibles} disponibles`}
              </div>
            </div>
          </div>
          <div style={{ height: 6, background: '#f3f4f6', borderRadius: 3 }}>
            <div style={{ height: 6, borderRadius: 3, background: pctCupo >= 100 ? '#dc2626' : pctCupo >= 80 ? '#d97706' : '#0f1787', width: `${Math.min(pctCupo, 100)}%`, transition: 'width 0.4s' }} />
          </div>
        </div>
      )}

      {/* Alertas */}
      <div style={{ padding: '0 20px', marginBottom: 10 }}>
        <div style={{ fontSize: 12, fontWeight: 500, color: '#0d0d14', marginBottom: 10 }}>Requieren atención</div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {stats.sinCorreo > 0 && (
            <div onClick={() => router.push('/dashboard/caminantes?filtro=sin_enviar')}
              style={{ background: '#fff', borderRadius: 12, padding: '13px 16px', display: 'flex', alignItems: 'center', gap: 12, border: '0.5px solid #e5e7eb', cursor: 'pointer' }}>
              <div style={{ width: 32, height: 32, borderRadius: 9, background: '#fef3c7', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                <Mail size={15} color="#d97706" />
              </div>
              <div style={{ flex: 1 }}>
                <div style={{ fontSize: 13, fontWeight: 500, color: '#0d0d14' }}>{stats.sinCorreo} caminante{stats.sinCorreo > 1 ? 's' : ''} sin correo</div>
                <div style={{ fontSize: 11, color: '#9ca3af', marginTop: 1 }}>Inscripción recibida, correo pendiente</div>
              </div>
              <ChevronRight size={16} color="#d1d5db" />
            </div>
          )}
          {stats.sorpresas > 0 && (
            <div onClick={() => router.push('/dashboard/caminantes?filtro=sorpresa')}
              style={{ background: '#fff', borderRadius: 12, padding: '13px 16px', display: 'flex', alignItems: 'center', gap: 12, border: '0.5px solid #e5e7eb', cursor: 'pointer' }}>
              <div style={{ width: 32, height: 32, borderRadius: 9, background: '#ede9fe', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                <EyeOff size={15} color="#7c3aed" />
              </div>
              <div style={{ flex: 1 }}>
                <div style={{ fontSize: 13, fontWeight: 500, color: '#0d0d14' }}>{stats.sorpresas} retiros sorpresa</div>
                <div style={{ fontSize: 11, color: '#9ca3af', marginTop: 1 }}>Correo va al contacto, no al caminante</div>
              </div>
              <ChevronRight size={16} color="#d1d5db" />
            </div>
          )}
        </div>
      </div>

      <BottomNav />
    </div>
  )
}
