'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'

interface DatoServidor {
  nombre_completo: string
  es_interno: boolean
  saldo_pendiente: number
  estado_pago: 'completo' | 'parcial' | 'sin_pago' | 'sorpresa'
  total_pagado: number
  costo_retiro: number
  racha_asistencias: number
  total_reuniones: number
  roles: string[]
  mesa: string | null
  inscripcion_id: string
}

const RETIRO_ID = '21da7588-f7d9-4bf8-a6f6-ae6c8258c00e'

const estadoConfig = {
  completo: { color: '#16a34a', bg: '#f0fdf4', label: 'Pago completo', icon: '✅' },
  parcial: { color: '#d97706', bg: '#fffbeb', label: 'Pago parcial', icon: '⚠️' },
  sin_pago: { color: '#6b7280', bg: '#f9fafb', label: 'Sin pago', icon: '⏳' },
  sorpresa: { color: '#7c3aed', bg: '#faf5ff', label: 'Sorpresa', icon: '🎁' },
}

export default function ServidorHome() {
  const router = useRouter()
  const [datos, setDatos] = useState<DatoServidor | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const cargar = async () => {
      const { data: { session } } = await supabase.auth.getSession()
      if (!session) { router.push('/'); return }

      const userId = session.user.id

      const { data: srv } = await supabase
        .from('servidores_inscripcion')
        .select('id, nombre_completo, es_interno, usuario_id')
        .eq('usuario_id', userId)
        .eq('retiro_id', RETIRO_ID)
        .single()

      if (!srv) { router.push('/'); return }

      const { data: pagoData } = await supabase
        .from('vista_pagos_servidores')
        .select('*')
        .eq('servidor_id', srv.id)
        .single()

      const { data: asistencias } = await supabase
        .from('asistencias')
        .select('asistio')
        .eq('servidor_inscripcion_id', srv.id)

      const { data: rolesData } = await supabase
        .from('roles_retiro')
        .select('nombre_rol')
        .eq('servidor_inscripcion_id', srv.id)
        .eq('retiro_id', RETIRO_ID)

      const { data: mesaData } = await supabase
        .from('asignaciones_mesa')
        .select('mesas(nombre)')
        .eq('servidor_inscripcion_id', srv.id)
        .single()

      const totalReuniones = asistencias?.length ?? 0
      const asistidas = asistencias?.filter(a => a.asistio).length ?? 0
      const costo = srv.es_interno ? 380000 : 0
      const pagado: number = pagoData?.total_pagado ?? 0
      const pendiente: number = Math.max(0, costo - pagado)

      let estado: DatoServidor['estado_pago'] = 'sin_pago'
      if (pagoData?.estado_pago) {
        estado = pagoData.estado_pago as DatoServidor['estado_pago']
      } else if (pagado >= costo && costo > 0) {
        estado = 'completo'
      } else if (pagado > 0) {
        estado = 'parcial'
      }

      setDatos({
        nombre_completo: srv.nombre_completo,
        es_interno: srv.es_interno,
        saldo_pendiente: pendiente,
        estado_pago: estado,
        total_pagado: pagado,
        costo_retiro: costo,
        racha_asistencias: asistidas,
        total_reuniones: totalReuniones,
        roles: rolesData?.map(r => r.nombre_rol) ?? [],
        mesa: Array.isArray(mesaData?.mesas) ? (mesaData.mesas[0]?.nombre ?? null) : ((mesaData?.mesas as { nombre: string } | null)?.nombre ?? null),
        inscripcion_id: srv.id,
      })

      setLoading(false)
    }
    cargar()
  }, [router])

  if (loading) return (
    <div style={{
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      minHeight: '60vh', color: '#6b7280'
    }}>
      <div style={{ textAlign: 'center' }}>
        <div style={{
          width: 36, height: 36, border: '3px solid #e2e4f0',
          borderTopColor: '#0f1787', borderRadius: '50%',
          animation: 'spin 0.8s linear infinite', margin: '0 auto 10px'
        }} />
        <style>{`@keyframes spin { to { transform: rotate(360deg) } }`}</style>
        <p style={{ fontSize: 14 }}>Cargando tu perfil...</p>
      </div>
    </div>
  )

  if (!datos) return null

  const cfg = estadoConfig[datos.estado_pago]
  const porcentajePagado = datos.costo_retiro > 0
    ? Math.min(100, Math.round((datos.total_pagado / datos.costo_retiro) * 100))
    : 100
  const porcentajeAsist = datos.total_reuniones > 0
    ? Math.round((datos.racha_asistencias / datos.total_reuniones) * 100)
    : 0

  return (
    <div style={{ padding: '20px 16px', maxWidth: 480, margin: '0 auto' }}>
      {/* Bienvenida */}
      <div style={{ marginBottom: 24 }}>
        <h1 style={{ fontSize: 22, fontWeight: 700, color: '#111827', margin: '0 0 4px' }}>
          Hola, {datos.nombre_completo.split(' ')[0]} 👋
        </h1>
        <p style={{ color: '#6b7280', fontSize: 14, margin: 0 }}>
          Retiro Effetá Mazuren · 3–5 julio 2026
        </p>
      </div>

      {/* Card estado pago */}
      <div
        style={{
          background: cfg.bg, border: `1.5px solid ${cfg.color}30`,
          borderRadius: 14, padding: '18px 20px', marginBottom: 14,
          cursor: 'pointer'
        }}
        onClick={() => router.push('/servidor/pago')}
      >
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
          <div>
            <div style={{ fontSize: 12, color: '#6b7280', fontWeight: 500, marginBottom: 4 }}>
              ESTADO DE PAGO
            </div>
            <div style={{ fontWeight: 700, color: cfg.color, fontSize: 17 }}>
              {cfg.icon} {cfg.label}
            </div>
            {datos.es_interno && (
              <div style={{ marginTop: 8 }}>
                <div style={{ fontSize: 13, color: '#374151' }}>
                  Pagado: <strong>${datos.total_pagado.toLocaleString('es-CO')}</strong>
                  {' '}/ ${datos.costo_retiro.toLocaleString('es-CO')}
                </div>
                {datos.saldo_pendiente > 0 && (
                  <div style={{ fontSize: 13, color: cfg.color, marginTop: 2 }}>
                    Pendiente: <strong>${datos.saldo_pendiente.toLocaleString('es-CO')}</strong>
                  </div>
                )}
              </div>
            )}
          </div>
          <span style={{ fontSize: 22 }}>💳</span>
        </div>

        {datos.es_interno && datos.costo_retiro > 0 && (
          <div style={{ marginTop: 12 }}>
            <div style={{ height: 6, background: '#e5e7eb', borderRadius: 4, overflow: 'hidden' }}>
              <div style={{
                height: '100%', width: `${porcentajePagado}%`,
                background: cfg.color, borderRadius: 4, transition: 'width 0.6s ease'
              }} />
            </div>
            <div style={{ fontSize: 11, color: '#6b7280', marginTop: 4, textAlign: 'right' }}>
              {porcentajePagado}% pagado
            </div>
          </div>
        )}

        <div style={{ marginTop: 10, fontSize: 13, color: cfg.color, fontWeight: 500 }}>
          Ver comprobantes →
        </div>
      </div>

      {/* Card asistencias */}
      <div
        style={{
          background: 'white', border: '1.5px solid #e8eaf0',
          borderRadius: 14, padding: '18px 20px', marginBottom: 14,
          cursor: 'pointer'
        }}
        onClick={() => router.push('/servidor/asistencias')}
      >
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div>
            <div style={{ fontSize: 12, color: '#6b7280', fontWeight: 500, marginBottom: 4 }}>
              ASISTENCIAS EFFETÁ
            </div>
            <div style={{ fontSize: 22, fontWeight: 700, color: '#111827' }}>
              {datos.racha_asistencias}
              <span style={{ fontSize: 15, color: '#6b7280', fontWeight: 400 }}>
                {' '}/ {datos.total_reuniones} reuniones
              </span>
            </div>
          </div>
          <div style={{
            width: 48, height: 48, borderRadius: '50%',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            fontWeight: 700, fontSize: 14,
            background: porcentajeAsist >= 80 ? '#f0fdf4' : porcentajeAsist >= 50 ? '#fffbeb' : '#f9fafb',
            color: porcentajeAsist >= 80 ? '#16a34a' : porcentajeAsist >= 50 ? '#d97706' : '#6b7280'
          }}>
            {porcentajeAsist}%
          </div>
        </div>
        <div style={{ marginTop: 10, fontSize: 13, color: '#0f1787', fontWeight: 500 }}>
          Ver racha →
        </div>
      </div>

      {/* Card roles y mesa */}
      {(datos.roles.length > 0 || datos.mesa) && (
        <div style={{
          background: 'white', border: '1.5px solid #e8eaf0',
          borderRadius: 14, padding: '18px 20px', marginBottom: 14
        }}>
          <div style={{ fontSize: 12, color: '#6b7280', fontWeight: 500, marginBottom: 12 }}>
            MI SERVICIO EN EL RETIRO
          </div>

          {datos.mesa && (
            <div style={{ marginBottom: 10 }}>
              <span style={{ fontSize: 13, color: '#374151' }}>🪑 Mesa asignada: </span>
              <strong style={{ color: '#0f1787' }}>{datos.mesa}</strong>
            </div>
          )}

          {datos.roles.length > 0 && (
            <div>
              <div style={{ fontSize: 13, color: '#374151', marginBottom: 8 }}>🎯 Roles:</div>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                {datos.roles.map((rol, i) => (
                  <span key={i} style={{
                    background: '#f0f2ff', color: '#0f1787',
                    padding: '4px 10px', borderRadius: 20,
                    fontSize: 12, fontWeight: 600
                  }}>{rol}</span>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {/* Card reembolso */}
      <div
        style={{
          background: 'white', border: '1.5px solid #e8eaf0',
          borderRadius: 14, padding: '18px 20px', marginBottom: 14,
          cursor: 'pointer'
        }}
        onClick={() => router.push('/servidor/reembolso')}
      >
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div>
            <div style={{ fontSize: 12, color: '#6b7280', fontWeight: 500, marginBottom: 4 }}>
              REEMBOLSOS
            </div>
            <div style={{ fontSize: 15, color: '#111827' }}>
              Subir facturas de compras
            </div>
            <div style={{ fontSize: 13, color: '#6b7280', marginTop: 2 }}>
              Para solicitar reembolso al equipo
            </div>
          </div>
          <span style={{ fontSize: 24 }}>🧾</span>
        </div>
        <div style={{ marginTop: 10, fontSize: 13, color: '#0f1787', fontWeight: 500 }}>
          Gestionar →
        </div>
      </div>

      {/* Info retiro */}
      <div style={{
        background: '#0f1787', borderRadius: 14,
        padding: '18px 20px', marginBottom: 14
      }}>
        <div style={{ fontSize: 12, color: 'rgba(255,255,255,0.6)', fontWeight: 500, marginBottom: 8 }}>
          RETIRO EFFETÁ MAZUREN 2026
        </div>
        <div style={{ color: 'white', fontSize: 15, fontWeight: 600, marginBottom: 4 }}>
          📅 3 – 5 de julio, 2026
        </div>
        <div style={{ color: 'rgba(255,255,255,0.8)', fontSize: 13 }}>
          📍 Bogotá · {datos.es_interno ? 'Servidor interno' : 'Servidor externo'}
        </div>
      </div>
    </div>
  )
}
