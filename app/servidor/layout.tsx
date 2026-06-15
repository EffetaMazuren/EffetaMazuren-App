'use client'

import { useEffect, useState } from 'react'
import { useRouter, usePathname } from 'next/navigation'
import { supabase } from '@/lib/supabase'

export default function ServidorLayout({ children }: { children: React.ReactNode }) {
  const router = useRouter()
  const pathname = usePathname()
  const [nombre, setNombre] = useState('')
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const checkAuth = async () => {
      const { data: { session } } = await supabase.auth.getSession()

      if (!session && pathname !== '/servidor/registro') {
        router.push('/')
        return
      }

      if (session) {
        const userId = session.user.id
        const userMeta = session.user.user_metadata

        const { data: usuario } = await supabase
          .from('usuarios')
          .select('rol')
          .eq('id', userId)
          .single()

        if (usuario?.rol === 'lider') {
          router.push('/dashboard')
          return
        }

        const inscripcionId = userMeta?.servidor_inscripcion_id
        if (inscripcionId) {
          const { data: srv } = await supabase
            .from('servidores_inscripcion')
            .select('id, usuario_id, nombre')
            .eq('id', inscripcionId)
            .single()

          if (srv && !srv.usuario_id) {
            await supabase
              .from('servidores_inscripcion')
              .update({ usuario_id: userId })
              .eq('id', inscripcionId)
            setNombre(srv.nombre)
          } else if (srv?.nombre) {
            setNombre(srv.nombre)
          }
        } else {
          const { data: srv } = await supabase
            .from('servidores_inscripcion')
            .select('nombre')
            .eq('usuario_id', userId)
            .eq('retiro_id', '21da7588-f7d9-4bf8-a6f6-ae6c8258c00e')
            .single()

          if (srv?.nombre) setNombre(srv.nombre)
        }
      }

      setLoading(false)
    }
    checkAuth()
  }, [router, pathname])

  const handleLogout = async () => {
    await supabase.auth.signOut()
    router.push('/')
  }

  if (loading) {
    return (
      <div style={{ minHeight: '100vh', background: '#f7f8fc', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <div style={{ textAlign: 'center' }}>
          <div style={{ width: 40, height: 40, border: '3px solid #e2e4f0', borderTopColor: '#0f1787', borderRadius: '50%', animation: 'spin 0.8s linear infinite', margin: '0 auto 12px' }} />
          <style>{`@keyframes spin { to { transform: rotate(360deg) } }`}</style>
          <p style={{ color: '#6b7280', fontSize: 14, margin: 0 }}>Cargando...</p>
        </div>
      </div>
    )
  }

  const navItems = [
    {
      href: '/servidor',
      label: 'Inicio',
      icon: (active: boolean) => (
        <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke={active ? '#0f1787' : '#9ca3af'} strokeWidth={active ? 2 : 1.6} strokeLinecap="round" strokeLinejoin="round">
          <path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/>
          <polyline points="9 22 9 12 15 12 15 22"/>
        </svg>
      ),
    },
    {
      href: '/servidor/pago',
      label: 'Mi pago',
      icon: (active: boolean) => (
        <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke={active ? '#0f1787' : '#9ca3af'} strokeWidth={active ? 2 : 1.6} strokeLinecap="round" strokeLinejoin="round">
          <rect x="1" y="4" width="22" height="16" rx="2" ry="2"/>
          <line x1="1" y1="10" x2="23" y2="10"/>
        </svg>
      ),
    },
    {
      href: '/servidor/asistencias',
      label: 'Asistencias',
      icon: (active: boolean) => (
        <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke={active ? '#0f1787' : '#9ca3af'} strokeWidth={active ? 2 : 1.6} strokeLinecap="round" strokeLinejoin="round">
          <rect x="3" y="4" width="18" height="18" rx="2" ry="2"/>
          <line x1="16" y1="2" x2="16" y2="6"/>
          <line x1="8" y1="2" x2="8" y2="6"/>
          <line x1="3" y1="10" x2="21" y2="10"/>
          <polyline points="9 16 11 18 15 14"/>
        </svg>
      ),
    },
    {
      href: '/servidor/reembolso',
      label: 'Facturas',
      icon: (active: boolean) => (
        <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke={active ? '#0f1787' : '#9ca3af'} strokeWidth={active ? 2 : 1.6} strokeLinecap="round" strokeLinejoin="round">
          <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/>
          <polyline points="14 2 14 8 20 8"/>
          <line x1="16" y1="13" x2="8" y2="13"/>
          <line x1="16" y1="17" x2="8" y2="17"/>
        </svg>
      ),
    },
  ]

  return (
    <div style={{ minHeight: '100vh', background: '#f7f8fc' }}>

      {/* Top Nav */}
      <nav style={{
        background: '#0f1787', padding: '0 20px',
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        height: 56, position: 'sticky', top: 0, zIndex: 100,
        boxShadow: '0 2px 8px rgba(15,23,135,0.3)'
      }}>
        <span style={{ fontFamily: 'Georgia, serif', color: 'white', fontSize: 20, fontWeight: 700, letterSpacing: 4 }}>
          EFFETÁ
        </span>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          {nombre && (
            <span style={{ color: 'rgba(255,255,255,0.7)', fontSize: 13, maxWidth: 140, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
              {nombre.split(' ')[0]}
            </span>
          )}
          <button
            onClick={handleLogout}
            style={{ background: 'rgba(255,255,255,0.15)', border: 'none', color: 'white', padding: '6px 14px', borderRadius: 8, fontSize: 13, cursor: 'pointer', fontWeight: 500 }}
          >
            Salir
          </button>
        </div>
      </nav>

      {/* Bottom Nav */}
      <div style={{
        position: 'fixed', bottom: 0, left: 0, right: 0,
        background: 'white', borderTop: '0.5px solid #e8eaf0',
        display: 'flex', zIndex: 100,
        boxShadow: '0 -2px 12px rgba(0,0,0,0.05)'
      }}>
        {navItems.map(item => {
          const active = pathname === item.href
          return (
            <button
              key={item.href}
              onClick={() => router.push(item.href)}
              style={{
                flex: 1, padding: '10px 4px 12px',
                background: 'none', border: 'none', cursor: 'pointer',
                display: 'flex', flexDirection: 'column',
                alignItems: 'center', gap: 4
              }}
            >
              {item.icon(active)}
              <span style={{
                fontSize: 10, fontWeight: active ? 600 : 400,
                color: active ? '#0f1787' : '#9ca3af',
                letterSpacing: 0.2
              }}>
                {item.label}
              </span>
              {active && (
                <div style={{ width: 20, height: 2.5, background: '#0f1787', borderRadius: 2, marginTop: 1 }} />
              )}
            </button>
          )
        })}
      </div>

      <main style={{ paddingBottom: 80 }}>
        {children}
      </main>
    </div>
  )
}
