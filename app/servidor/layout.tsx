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
      
      // Si no hay sesión y no estamos en registro, redirigir a login
      if (!session && pathname !== '/servidor/registro') {
        router.push('/')
        return
      }

      if (session) {
        // Verificar que NO sea líder (líderes van a /dashboard)
        const { data: usuario } = await supabase
          .from('usuarios')
          .select('rol_global')
          .eq('id', session.user.id)
          .single()

        if (usuario?.rol_global === 'lider') {
          router.push('/dashboard')
          return
        }

        // Obtener nombre del servidor
        const { data: servidor } = await supabase
          .from('servidores_inscripcion')
          .select('nombre_completo')
          .eq('usuario_id', session.user.id)
          .eq('retiro_id', '21da7588-f7d9-4bf8-a6f6-ae6c8258c00e')
          .single()

        if (servidor) setNombre(servidor.nombre_completo)
      }

      setLoading(false)
    }
    checkAuth()
  }, [router, pathname])

  const navItems = [
    { href: '/servidor', label: '🏠 Inicio', icon: '⌂' },
    { href: '/servidor/pago', label: '💳 Mi pago' },
    { href: '/servidor/asistencias', label: '📅 Asistencias' },
    { href: '/servidor/reembolso', label: '🧾 Reembolsos' },
  ]

  const handleLogout = async () => {
    await supabase.auth.signOut()
    router.push('/')
  }

  if (loading) {
    return (
      <div style={{
        minHeight: '100vh', background: '#f7f8fc',
        display: 'flex', alignItems: 'center', justifyContent: 'center'
      }}>
        <div style={{ textAlign: 'center' }}>
          <div style={{
            width: 40, height: 40, border: '3px solid #e2e4f0',
            borderTopColor: '#0f1787', borderRadius: '50%',
            animation: 'spin 0.8s linear infinite', margin: '0 auto 12px'
          }} />
          <style>{`@keyframes spin { to { transform: rotate(360deg) } }`}</style>
          <p style={{ color: '#6b7280', fontSize: 14 }}>Cargando...</p>
        </div>
      </div>
    )
  }

  return (
    <div style={{ minHeight: '100vh', background: '#f7f8fc' }}>
      {/* Top Nav */}
      <nav style={{
        background: '#0f1787', padding: '0 20px',
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        height: 56, position: 'sticky', top: 0, zIndex: 100,
        boxShadow: '0 2px 8px rgba(15,23,135,0.3)'
      }}>
        <span style={{
          fontFamily: 'Georgia, serif', color: 'white',
          fontSize: 20, fontWeight: 700, letterSpacing: 2
        }}>EFFETÁ</span>

        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          {nombre && (
            <span style={{
              color: 'rgba(255,255,255,0.7)', fontSize: 13,
              maxWidth: 140, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap'
            }}>{nombre.split(' ')[0]}</span>
          )}
          <button
            onClick={handleLogout}
            style={{
              background: 'rgba(255,255,255,0.15)', border: 'none',
              color: 'white', padding: '6px 14px', borderRadius: 8,
              fontSize: 13, cursor: 'pointer', fontWeight: 500
            }}
          >Salir</button>
        </div>
      </nav>

      {/* Bottom Nav — Mobile */}
      <div style={{
        position: 'fixed', bottom: 0, left: 0, right: 0,
        background: 'white', borderTop: '1px solid #e8eaf0',
        display: 'flex', zIndex: 100,
        boxShadow: '0 -2px 12px rgba(0,0,0,0.06)'
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
                alignItems: 'center', gap: 3
              }}
            >
              <span style={{ fontSize: 18 }}>{item.label.split(' ')[0]}</span>
              <span style={{
                fontSize: 10, fontWeight: active ? 700 : 400,
                color: active ? '#0f1787' : '#9ca3af',
                letterSpacing: 0.3
              }}>{item.label.split(' ').slice(1).join(' ')}</span>
              {active && (
                <div style={{
                  width: 24, height: 3, background: '#0f1787',
                  borderRadius: 2, marginTop: 2
                }} />
              )}
            </button>
          )
        })}
      </div>

      {/* Content */}
      <main style={{ paddingBottom: 80 }}>
        {children}
      </main>
    </div>
  )
}
