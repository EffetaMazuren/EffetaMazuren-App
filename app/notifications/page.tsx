'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'

const RETIRO_ID = '21da7588-f7d9-4bf8-a6f6-ae6c8258c00e'

interface Notificacion {
  id: string
  tipo: 'pago' | 'caminante' | 'asistencia' | 'reembolso' | 'mensaje' | 'palanca'
  titulo: string
  descripcion: string
  fecha: string
  href?: string
  leida: boolean
}

function tiempoRelativo(fecha: string): string {
  const diff = Date.now() - new Date(fecha).getTime()
  const min = Math.floor(diff / 60000)
  const h = Math.floor(diff / 3600000)
  const d = Math.floor(diff / 86400000)
  if (min < 1) return 'Ahora mismo'
  if (min < 60) return `Hace ${min} min`
  if (h < 24) return `Hace ${h}h`
  if (d === 1) return 'Ayer'
  return `Hace ${d} días`
}

const TIPO_CONFIG: Record<string, { color: string; bg: string; icon: JSX.Element }> = {
  pago: {
    color: '#16a34a', bg: '#f0fdf4',
    icon: <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#16a34a" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="1" y="4" width="22" height="16" rx="2"/><line x1="1" y1="10" x2="23" y2="10"/></svg>
  },
  caminante: {
    color: '#0f1787', bg: '#eef0ff',
    icon: <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#0f1787" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>
  },
  asistencia: {
    color: '#d97706', bg: '#fffbeb',
    icon: <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#d97706" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z"/><circle cx="12" cy="13" r="4"/></svg>
  },
  reembolso: {
    color: '#dc2626', bg: '#fef2f2',
    icon: <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#dc2626" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/></svg>
  },
  mensaje: {
    color: '#7c3aed', bg: '#f5f3ff',
    icon: <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#7c3aed" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/></svg>
  },
  palanca: {
    color: '#db2777', bg: '#fdf2f8',
    icon: <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#db2777" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/></svg>
  },
}

export default function NotificationsPage() {
  const router = useRouter()
  const [notificaciones, setNotificaciones] = useState<Notificacion[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    cargarNotificaciones()
  }, [])

  async function cargarNotificaciones() {
    setLoading(true)
    const lista: Notificacion[] = []

    // 1. Pagos pendientes de aprobar
    const { data: pagosPendientes } = await supabase
      .from('pagos')
      .select('id, valor, created_at, tipo_persona')
      .eq('retiro_id', RETIRO_ID)
      .eq('estado', 'pendiente')
      .order('created_at', { ascending: false })
      .limit(10)

    for (const p of pagosPendientes ?? []) {
      lista.push({
        id: `pago-${p.id}`,
        tipo: 'pago',
        titulo: 'Pago pendiente de aprobar',
        descripcion: `$${Number(p.valor).toLocaleString('es-CO')} de ${p.tipo_persona === 'caminante' ? 'un caminante' : 'un servidor'}`,
        fecha: p.created_at,
        href: '/dashboard/finanzas',
        leida: false,
      })
    }

    // 2. Nuevos caminantes (últimas 48h)
    const hace48h = new Date(Date.now() - 48 * 60 * 60 * 1000).toISOString()
    const { data: nuevosCaminantes } = await supabase
      .from('caminantes')
      .select('id, nombre, created_at')
      .eq('retiro_id', RETIRO_ID)
      .gte('created_at', hace48h)
      .order('created_at', { ascending: false })
      .limit(10)

    for (const c of nuevosCaminantes ?? []) {
      lista.push({
        id: `cam-${c.id}`,
        tipo: 'caminante',
        titulo: 'Nuevo caminante registrado',
        descripcion: c.nombre,
        fecha: c.created_at,
        href: '/dashboard/caminantes',
        leida: false,
      })
    }

    // 3. Alertas de asistencia fuera de horario
    const { data: alertas } = await supabase
      .from('asistencias')
      .select('id, servidor_nombre, created_at')
      .eq('fuera_de_horario', true)
      .order('created_at', { ascending: false })
      .limit(10)

    for (const a of alertas ?? []) {
      lista.push({
        id: `asistencia-${a.id}`,
        tipo: 'asistencia',
        titulo: 'Asistencia fuera de horario',
        descripcion: a.servidor_nombre ?? 'Servidor sin nombre',
        fecha: a.created_at,
        href: '/dashboard/asistencias',
        leida: false,
      })
    }

    // 4. Reembolsos pendientes
    const { data: reembolsos } = await supabase
      .from('transacciones')
      .select('id, descripcion, created_at, valor')
      .eq('retiro_id', RETIRO_ID)
      .eq('estado', 'pendiente')
      .order('created_at', { ascending: false })
      .limit(10)

    for (const r of reembolsos ?? []) {
      lista.push({
        id: `reembolso-${r.id}`,
        tipo: 'reembolso',
        titulo: 'Factura pendiente de aprobar',
        descripcion: r.descripcion ?? `$${Number(r.valor).toLocaleString('es-CO')}`,
        fecha: r.created_at,
        href: '/dashboard/reembolsos',
        leida: false,
      })
    }

    // 5. Mensajes recientes (últimas 24h)
    const hace24h = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString()
    const { data: mensajes } = await supabase
      .from('mensajes_retiro')
      .select('id, texto, autor_nombre, created_at')
      .eq('retiro_id', RETIRO_ID)
      .gte('created_at', hace24h)
      .order('created_at', { ascending: false })
      .limit(5)

    for (const m of mensajes ?? []) {
      lista.push({
        id: `mensaje-${m.id}`,
        tipo: 'mensaje',
        titulo: `Mensaje de ${m.autor_nombre ?? 'Líder'}`,
        descripcion: m.texto?.slice(0, 80) + (m.texto?.length > 80 ? '…' : ''),
        fecha: m.created_at,
        href: '/dashboard/mensajes',
        leida: false,
      })
    }

    // 6. Cambios en palancas (últimas 24h)
    const { data: palancas } = await supabase
      .from('palancas_seguimiento')
      .select('id, caminante_nombre, updated_at')
      .eq('retiro_id', RETIRO_ID)
      .gte('updated_at', hace24h)
      .order('updated_at', { ascending: false })
      .limit(10)

    for (const p of palancas ?? []) {
      lista.push({
        id: `palanca-${p.id}`,
        tipo: 'palanca',
        titulo: 'Palanca actualizada',
        descripcion: p.caminante_nombre,
        fecha: p.updated_at,
        href: '/dashboard/palancas',
        leida: false,
      })
    }

    // Ordenar por fecha descendente
    lista.sort((a, b) => new Date(b.fecha).getTime() - new Date(a.fecha).getTime())
    setNotificaciones(lista)
    setLoading(false)
  }

  const grupos = [
    { label: 'Hoy', items: notificaciones.filter(n => new Date(n.fecha).toDateString() === new Date().toDateString()) },
    { label: 'Anteriores', items: notificaciones.filter(n => new Date(n.fecha).toDateString() !== new Date().toDateString()) },
  ].filter(g => g.items.length > 0)

  return (
    <div style={{ minHeight: '100vh', background: '#f7f8fc', fontFamily: 'system-ui, sans-serif' }}>
      {/* Header */}
      <div style={{ background: 'white', borderBottom: '1px solid #f3f4f6', padding: '16px 20px', display: 'flex', alignItems: 'center', gap: 12, position: 'sticky', top: 0, zIndex: 10 }}>
        <button onClick={() => router.back()} style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 4, display: 'flex', alignItems: 'center', color: '#6b7280' }}>
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <polyline points="15 18 9 12 15 6"/>
          </svg>
        </button>
        <div style={{ flex: 1 }}>
          <h1 style={{ fontSize: 17, fontWeight: 700, color: '#111827', margin: 0 }}>Notificaciones</h1>
          {!loading && <p style={{ fontSize: 12, color: '#9ca3af', margin: 0 }}>{notificaciones.length} sin revisar</p>}
        </div>
        <button onClick={cargarNotificaciones} style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 4, color: '#6b7280' }}>
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <polyline points="23 4 23 10 17 10"/><path d="M20.49 15a9 9 0 1 1-2.12-9.36L23 10"/>
          </svg>
        </button>
      </div>

      {loading ? (
        <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: '50vh' }}>
          <div style={{ width: 28, height: 28, border: '3px solid #e2e4f0', borderTopColor: '#0f1787', borderRadius: '50%', animation: 'spin 0.8s linear infinite' }} />
          <style>{`@keyframes spin{to{transform:rotate(360deg)}}`}</style>
        </div>
      ) : notificaciones.length === 0 ? (
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', minHeight: '50vh', padding: 24 }}>
          <div style={{ width: 56, height: 56, background: '#f3f4f6', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: 16 }}>
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#9ca3af" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
              <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9"/><path d="M13.73 21a2 2 0 0 1-3.46 0"/>
            </svg>
          </div>
          <p style={{ fontSize: 15, fontWeight: 600, color: '#374151', margin: '0 0 4px' }}>Todo al día</p>
          <p style={{ fontSize: 13, color: '#9ca3af', margin: 0, textAlign: 'center' }}>No hay notificaciones pendientes por ahora</p>
        </div>
      ) : (
        <div style={{ padding: '16px', maxWidth: 600, margin: '0 auto' }}>
          {grupos.map(grupo => (
            <div key={grupo.label} style={{ marginBottom: 24 }}>
              <p style={{ fontSize: 11, fontWeight: 700, color: '#9ca3af', textTransform: 'uppercase', letterSpacing: 1, margin: '0 0 10px' }}>{grupo.label}</p>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                {grupo.items.map(n => {
                  const cfg = TIPO_CONFIG[n.tipo]
                  return (
                    <button
                      key={n.id}
                      onClick={() => n.href && router.push(n.href)}
                      style={{
                        display: 'flex', alignItems: 'flex-start', gap: 12, padding: '14px 16px',
                        background: 'white', border: '0.5px solid #e8eaf0', borderRadius: 14,
                        cursor: n.href ? 'pointer' : 'default', textAlign: 'left', width: '100%',
                        borderLeft: `3px solid ${cfg.color}`,
                      }}
                    >
                      <div style={{ width: 34, height: 34, borderRadius: 10, background: cfg.bg, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                        {cfg.icon}
                      </div>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <p style={{ fontSize: 13, fontWeight: 600, color: '#111827', margin: '0 0 2px' }}>{n.titulo}</p>
                        <p style={{ fontSize: 12, color: '#6b7280', margin: '0 0 4px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{n.descripcion}</p>
                        <p style={{ fontSize: 11, color: '#9ca3af', margin: 0 }}>{tiempoRelativo(n.fecha)}</p>
                      </div>
                      {n.href && (
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#d1d5db" strokeWidth="2" strokeLinecap="round" style={{ flexShrink: 0, marginTop: 2 }}>
                          <polyline points="9 18 15 12 9 6"/>
                        </svg>
                      )}
                    </button>
                  )
                })}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
