'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'

const RETIRO_ID = '21da7588-f7d9-4bf8-a6f6-ae6c8258c00e'

interface PerfilData {
  nombre: string
  correo: string
  rol: string | null
}

export default function PerfilPage() {
  const router = useRouter()
  const [perfil, setPerfil] = useState<PerfilData | null>(null)
  const [loading, setLoading] = useState(true)
  const [cerrando, setCerrando] = useState(false)

  useEffect(() => {
    cargarPerfil()
  }, [])

  async function cargarPerfil() {
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) { router.push('/'); return }

    const { data: u } = await supabase
      .from('usuarios')
      .select('nombre, correo, rol')
      .eq('id', user.id)
      .single()

    setPerfil({
      nombre: u?.nombre ?? user.email ?? 'Líder',
      correo: u?.correo ?? user.email ?? '',
      rol: u?.rol ?? 'lider',
    })
    setLoading(false)
  }

  async function cerrarSesion() {
    setCerrando(true)
    await supabase.auth.signOut()
    router.push('/')
  }

  const iniciales = perfil?.nombre
    ? perfil.nombre.split(' ').slice(0, 2).map(w => w[0]).join('').toUpperCase()
    : 'L'

  if (loading) {
    return (
      <div style={{ minHeight: '100vh', background: '#f7f8fc', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <div style={{ width: 28, height: 28, border: '3px solid #e2e4f0', borderTopColor: '#0f1787', borderRadius: '50%', animation: 'spin 0.8s linear infinite' }} />
        <style>{`@keyframes spin{to{transform:rotate(360deg)}}`}</style>
      </div>
    )
  }

  return (
    <div style={{ minHeight: '100vh', background: '#f7f8fc', fontFamily: 'system-ui, sans-serif' }}>
      {/* Header */}
      <div style={{ background: 'white', borderBottom: '1px solid #f3f4f6', padding: '16px 20px', display: 'flex', alignItems: 'center', gap: 12, position: 'sticky', top: 0, zIndex: 10 }}>
        <button onClick={() => router.back()} style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 4, display: 'flex', alignItems: 'center', color: '#6b7280' }}>
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <polyline points="15 18 9 12 15 6"/>
          </svg>
        </button>
        <h1 style={{ fontSize: 17, fontWeight: 700, color: '#111827', margin: 0 }}>Mi perfil</h1>
      </div>

      <div style={{ maxWidth: 480, margin: '0 auto', padding: '24px 16px' }}>

        {/* Avatar y nombre */}
        <div style={{ background: 'white', borderRadius: 20, padding: '32px 24px', marginBottom: 16, textAlign: 'center', border: '0.5px solid #e8eaf0' }}>
          <div style={{
            width: 80, height: 80, borderRadius: '50%', background: '#0f1787',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            margin: '0 auto 16px', fontSize: 28, fontWeight: 700, color: 'white',
            fontFamily: 'Georgia, serif', letterSpacing: 2,
          }}>
            {iniciales}
          </div>
          <h2 style={{ fontSize: 20, fontWeight: 700, color: '#111827', margin: '0 0 4px' }}>{perfil?.nombre}</h2>
          <p style={{ fontSize: 13, color: '#6b7280', margin: '0 0 12px' }}>{perfil?.correo}</p>
          <span style={{ display: 'inline-block', background: '#eef0ff', color: '#0f1787', fontSize: 12, fontWeight: 600, padding: '4px 14px', borderRadius: 20, letterSpacing: 0.5 }}>
            Líder · Effetá Mazuren
          </span>
        </div>

        {/* Info del retiro */}
        <div style={{ background: 'white', borderRadius: 16, padding: '20px', marginBottom: 16, border: '0.5px solid #e8eaf0' }}>
          <p style={{ fontSize: 11, fontWeight: 700, color: '#9ca3af', textTransform: 'uppercase', letterSpacing: 1, margin: '0 0 14px' }}>Retiro activo</p>
          {[
            { label: 'Nombre', value: 'IX Retiro Effetá Mazuren' },
            { label: 'Fecha', value: '3, 4 y 5 de julio de 2026' },
            { label: 'Lugar', value: 'Casa Santa Luisa Los Pinares' },
          ].map((item, i, arr) => (
            <div key={item.label} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', paddingBottom: i < arr.length - 1 ? 12 : 0, marginBottom: i < arr.length - 1 ? 12 : 0, borderBottom: i < arr.length - 1 ? '0.5px solid #f3f4f6' : 'none' }}>
              <span style={{ fontSize: 13, color: '#6b7280' }}>{item.label}</span>
              <span style={{ fontSize: 13, fontWeight: 500, color: '#111827', textAlign: 'right', maxWidth: '60%' }}>{item.value}</span>
            </div>
          ))}
        </div>

        {/* Accesos rápidos */}
        <div style={{ background: 'white', borderRadius: 16, marginBottom: 16, border: '0.5px solid #e8eaf0', overflow: 'hidden' }}>
          {[
            {
              label: 'Dashboard',
              desc: 'Volver al inicio',
              href: '/dashboard',
              icon: <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#0f1787" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/><polyline points="9 22 9 12 15 12 15 22"/></svg>
            },
            {
              label: 'Notificaciones',
              desc: 'Ver alertas y novedades',
              href: '/notifications',
              icon: <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#0f1787" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9"/><path d="M13.73 21a2 2 0 0 1-3.46 0"/></svg>
            },
          ].map((item, i) => (
            <button
              key={item.href}
              onClick={() => router.push(item.href)}
              style={{ width: '100%', display: 'flex', alignItems: 'center', gap: 14, padding: '16px 20px', background: 'none', border: 'none', borderBottom: i === 0 ? '0.5px solid #f3f4f6' : 'none', cursor: 'pointer', textAlign: 'left' }}
            >
              <div style={{ width: 36, height: 36, borderRadius: 10, background: '#eef0ff', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                {item.icon}
              </div>
              <div style={{ flex: 1 }}>
                <p style={{ fontSize: 14, fontWeight: 500, color: '#111827', margin: '0 0 1px' }}>{item.label}</p>
                <p style={{ fontSize: 12, color: '#9ca3af', margin: 0 }}>{item.desc}</p>
              </div>
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#d1d5db" strokeWidth="2" strokeLinecap="round">
                <polyline points="9 18 15 12 9 6"/>
              </svg>
            </button>
          ))}
        </div>

        {/* Cerrar sesión */}
        <button
          onClick={cerrarSesion}
          disabled={cerrando}
          style={{
            width: '100%', padding: '16px', background: cerrando ? '#f3f4f6' : 'white',
            border: '0.5px solid #fecaca', borderRadius: 16, cursor: cerrando ? 'not-allowed' : 'pointer',
            display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 10,
          }}
        >
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke={cerrando ? '#9ca3af' : '#dc2626'} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/><polyline points="16 17 21 12 16 7"/><line x1="21" y1="12" x2="9" y2="12"/>
          </svg>
          <span style={{ fontSize: 14, fontWeight: 600, color: cerrando ? '#9ca3af' : '#dc2626' }}>
            {cerrando ? 'Cerrando sesión…' : 'Cerrar sesión'}
          </span>
        </button>

        <p style={{ fontSize: 11, color: '#d1d5db', textAlign: 'center', marginTop: 24 }}>
          Effetá Mazuren · Parroquia Jesucristo Redentor · Bogotá
        </p>

      </div>
    </div>
  )
}
