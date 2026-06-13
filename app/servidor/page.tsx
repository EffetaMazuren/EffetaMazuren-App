'use client'
import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'
import { UserCircle, Camera, ClipboardList, Receipt, LayoutDashboard, CalendarCheck } from 'lucide-react'

export default function ServidorPage() {
  const router = useRouter()
  const [usuario, setUsuario] = useState<any>(null)
  const [inscripcion, setInscripcion] = useState<any>(null)
  const [asistencias, setAsistencias] = useState<any[]>([])
  const [roles, setRoles] = useState<any[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    async function cargar() {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) { router.push('/'); return }
      const { data: u } = await supabase.from('usuarios').select('*').eq('id', user.id).single()
      if (!u) { router.push('/'); return }
      setUsuario(u)
      const { data: r } = await supabase.from('retiros').select('id').eq('estado', 'activo').single()
      if (r) {
        const { data: ins } = await supabase.from('vista_pagos_servidores').select('*').eq('usuario_id', user.id).eq('retiro_id', r.id).single()
        setInscripcion(ins)
        const { data: rol } = await supabase.from('roles_retiro').select('*').eq('usuario_id', user.id).eq('retiro_id', r.id).order('momento')
        setRoles(rol || [])
        const { data: asist } = await supabase.from('asistencias').select('*, reuniones(fecha, tipo, nombre)').eq('usuario_id', user.id).order('fecha_hora', { ascending: false }).limit(20)
        setAsistencias(asist || [])
      }
      setLoading(false)
    }
    cargar()
  }, [])

  if (loading) return <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: '100vh' }}><div style={{ color: '#9ca3af' }}>Cargando...</div></div>

  const nombre = usuario?.nombre?.split(' ')[0] || 'Servidor'
  const totalAsist = asistencias.length
  const pctPago = inscripcion ? Math.min(Math.round((inscripcion.total_pagado / 380000) * 100), 100) : 0
  const racha = Math.min(asistencias.length, 7) // Simplificado — en prod calcular racha real

  const nav = [
    { icon: LayoutDashboard, label: 'Inicio', active: true },
    { icon: CalendarCheck, label: 'Asistencia' },
    { icon: Receipt, label: 'Gastos' },
    { icon: ClipboardList, label: 'Roles' },
  ]

  return (
    <div style={{ background: '#f7f8fc', minHeight: '100vh', paddingBottom: 80 }}>
      {/* Nav */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '18px 20px 10px' }}>
        <div style={{ fontSize: 11, fontWeight: 500, letterSpacing: 1.5, textTransform: 'uppercase', color: '#9ca3af' }}>EFFETÁ · Mazuren</div>
        <button onClick={() => supabase.auth.signOut().then(() => router.push('/'))} style={{ width: 34, height: 34, borderRadius: '50%', background: '#fff', border: '0.5px solid #e5e7eb', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer' }}>
          <UserCircle size={16} color="#6b7280" />
        </button>
      </div>

      {/* Saludo */}
      <div style={{ padding: '4px 20px 20px' }}>
        <div style={{ fontSize: 24, fontWeight: 500, color: '#0d0d14', letterSpacing: -0.4 }}>Hola, {nombre} 🙌</div>
        <div style={{ fontSize: 13, color: '#9ca3af', marginTop: 2 }}>Servidor · Retiro en 20 días</div>
      </div>

      {/* Racha card */}
      <div style={{ margin: '0 20px 14px', background: '#0f1787', borderRadius: 20, padding: 22, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <div>
          <div style={{ fontSize: 10, letterSpacing: 1.5, textTransform: 'uppercase', color: 'rgba(255,255,255,0.4)', marginBottom: 6 }}>Racha actual</div>
          <div style={{ fontSize: 52, fontWeight: 500, color: '#fff', letterSpacing: -2, lineHeight: 1 }}>{racha}</div>
          <div style={{ fontSize: 13, color: 'rgba(255,255,255,0.5)', marginTop: 4 }}>martes consecutivos</div>
        </div>
        <div style={{ textAlign: 'right' }}>
          <div style={{ display: 'inline-flex', alignItems: 'center', gap: 5, background: 'rgba(255,255,255,0.15)', color: '#fff', padding: '6px 12px', borderRadius: 20, fontSize: 12, fontWeight: 500, marginBottom: 10 }}>
            🔥 Racha activa
          </div>
          <div style={{ display: 'flex', gap: 5, marginTop: 8, justifyContent: 'flex-end' }}>
            {[...Array(8)].map((_, i) => (
              <div key={i} style={{ width: 8, height: 8, borderRadius: '50%', background: i < racha ? '#fff' : 'rgba(255,255,255,0.2)' }} />
            ))}
          </div>
        </div>
      </div>

      {/* Stats */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, margin: '0 20px 14px' }}>
        <div style={{ background: '#fff', borderRadius: 14, padding: 16, border: '0.5px solid #e5e7eb' }}>
          <div style={{ fontSize: 26, fontWeight: 500, color: '#0d0d14', letterSpacing: -0.5, lineHeight: 1 }}>{totalAsist}</div>
          <div style={{ fontSize: 11, color: '#9ca3af', marginTop: 6 }}>Reuniones asistidas</div>
          <div style={{ display: 'inline-flex', alignItems: 'center', marginTop: 8, fontSize: 11, fontWeight: 500, padding: '3px 8px', borderRadius: 20, background: '#dcfce7', color: '#166534' }}>✓ Activo</div>
        </div>
        <div style={{ background: '#fff', borderRadius: 14, padding: 16, border: '0.5px solid #e5e7eb' }}>
          <div style={{ fontSize: 26, fontWeight: 500, color: '#0d0d14', letterSpacing: -0.5, lineHeight: 1 }}>{pctPago}%</div>
          <div style={{ fontSize: 11, color: '#9ca3af', marginTop: 6 }}>Pago inscripción</div>
          <div style={{ display: 'inline-flex', alignItems: 'center', marginTop: 8, fontSize: 11, fontWeight: 500, padding: '3px 8px', borderRadius: 20, background: pctPago >= 100 ? '#dcfce7' : '#fef3c7', color: pctPago >= 100 ? '#166534' : '#92400e' }}>
            {pctPago >= 100 ? 'Completo' : 'Pendiente'}
          </div>
        </div>
      </div>

      {/* Pago inscripción */}
      {inscripcion && (
        <div style={{ margin: '0 20px 14px', background: '#fff', borderRadius: 16, padding: 18, border: '0.5px solid #e5e7eb' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 }}>
            <div style={{ fontSize: 13, fontWeight: 500, color: '#0d0d14' }}>Mi inscripción al retiro</div>
            <div style={{ fontSize: 11, fontWeight: 500, padding: '3px 10px', borderRadius: 20, background: pctPago >= 100 ? '#dcfce7' : '#fef3c7', color: pctPago >= 100 ? '#166534' : '#92400e' }}>
              {pctPago >= 100 ? 'Pago completo' : 'Abono parcial'}
            </div>
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', marginBottom: 12 }}>
            <div style={{ fontSize: 32, fontWeight: 500, color: '#0d0d14', letterSpacing: -1 }}>
              ${Number(inscripcion.total_pagado).toLocaleString('es-CO')}
            </div>
            <div style={{ fontSize: 13, color: '#9ca3af', paddingBottom: 4 }}>de $380.000</div>
          </div>
          <div style={{ height: 5, background: '#f3f4f6', borderRadius: 3, marginBottom: 6 }}>
            <div style={{ height: 5, borderRadius: 3, background: '#0f1787', width: `${pctPago}%` }} />
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 11, color: '#9ca3af' }}>
            <span>Pagado</span>
            <span>Faltan ${Math.max(Number(inscripcion.saldo_pendiente), 0).toLocaleString('es-CO')}</span>
          </div>
        </div>
      )}

      {/* Roles */}
      {roles.length > 0 && (
        <div style={{ margin: '0 20px 14px', background: '#fff', borderRadius: 16, padding: 18, border: '0.5px solid #e5e7eb' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 }}>
            <div style={{ fontSize: 13, fontWeight: 500, color: '#0d0d14' }}>Mis roles</div>
            <div style={{ fontSize: 11, color: '#9ca3af' }}>Retiro Julio 2026</div>
          </div>
          {roles.map(r => (
            <div key={r.id} style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '10px 0', borderBottom: '0.5px solid #f3f4f6' }}>
              <div style={{ width: 8, height: 8, borderRadius: '50%', background: r.momento === 'preretiro' ? '#7c3aed' : '#0f1787', flexShrink: 0 }} />
              <div style={{ flex: 1 }}>
                <div style={{ fontSize: 13, fontWeight: 500, color: '#111827' }}>{r.rol}</div>
                <div style={{ fontSize: 11, color: '#9ca3af', marginTop: 1 }}>{r.momento === 'preretiro' ? 'Preretiro' : 'Durante el retiro'}</div>
              </div>
              <div style={{ fontSize: 11, fontWeight: 500, padding: '3px 9px', borderRadius: 20, background: r.momento === 'preretiro' ? '#ede9fe' : '#e8eaf6', color: r.momento === 'preretiro' ? '#5b21b6' : '#0f1787' }}>
                {r.momento === 'preretiro' ? 'Preretiro' : 'Retiro'}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Botón asistencia */}
      <div style={{ padding: '0 20px' }}>
        <button style={{ width: '100%', background: '#fff', border: '0.5px solid #e5e7eb', borderRadius: 16, padding: 18, display: 'flex', alignItems: 'center', justifyContent: 'space-between', cursor: 'pointer' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <div style={{ width: 40, height: 40, borderRadius: 12, background: '#e8eaf6', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <Camera size={20} color="#0f1787" />
            </div>
            <div style={{ textAlign: 'left' }}>
              <div style={{ fontSize: 14, fontWeight: 500, color: '#0d0d14' }}>Registrar asistencia</div>
              <div style={{ fontSize: 11, color: '#9ca3af', marginTop: 2 }}>Toma una foto para confirmar</div>
            </div>
          </div>
          <div style={{ color: '#d1d5db', fontSize: 20 }}>›</div>
        </button>
      </div>

      {/* Bottom nav */}
      <nav style={{ position: 'fixed', bottom: 0, left: 0, right: 0, background: '#fff', borderTop: '0.5px solid #e5e7eb', display: 'flex', justifyContent: 'space-around', padding: '10px 0 20px', zIndex: 100 }}>
        {nav.map(({ icon: Icon, label, active }) => (
          <button key={label} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4, padding: '0 16px', background: 'none', border: 'none', cursor: 'pointer' }}>
            <Icon size={20} color={active ? '#0f1787' : '#d1d5db'} />
            <span style={{ fontSize: 10, fontWeight: 500, color: active ? '#0f1787' : '#d1d5db' }}>{label}</span>
          </button>
        ))}
      </nav>
    </div>
  )
}
