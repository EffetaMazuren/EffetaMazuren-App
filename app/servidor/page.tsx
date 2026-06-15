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
  completo: { color: '#16a34a', bg: '#f0fdf4', label: 'Pago completo', textColor: '#166534' },
  parcial: { color: '#d97706', bg: '#fffbeb', label: 'Pago parcial', textColor: '#92400e' },
  sin_pago: { color: '#6b7280', bg: '#f9fafb', label: 'Sin pago', textColor: '#374151' },
  sorpresa: { color: '#7c3aed', bg: '#faf5ff', label: 'Sorpresa', textColor: '#5b21b6' },
}

export default function ServidorHome() {
  const router = useRouter()
  const [datos, setDatos] = useState<DatoServidor | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const cargarDatos = async (
      srv: { id: string; nombre: string; es_interno: boolean; usuario_id: string | null },
    ) => {
      const { data: pagosData } = await supabase
        .from('pagos')
        .select('valor, estado')
        .eq('persona_id', srv.id)
        .eq('tipo_persona', 'servidor')
        .eq('retiro_id', RETIRO_ID)

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

      const pagado: number = pagosData
        ?.filter(p => p.estado === 'confirmado')
        .reduce((sum, p) => sum + (p.valor || 0), 0) ?? 0
      const pendiente: number = Math.max(0, costo - pagado)

      let estado: DatoServidor['estado_pago'] = 'sin_pago'
      if (pagado >= costo && costo > 0) estado = 'completo'
      else if (pagado > 0) estado = 'parcial'

      setDatos({
        nombre_completo: srv.nombre,
        es_interno: srv.es_interno,
        saldo_pendiente: pendiente,
        estado_pago: estado,
        total_pagado: pagado,
        costo_retiro: costo,
        racha_asistencias: asistidas,
        total_reuniones: totalReuniones,
        roles: rolesData?.map(r => r.nombre_rol) ?? [],
        mesa: (mesaData?.mesas as unknown as { nombre: string } | null)?.nombre ?? null,
        inscripcion_id: srv.id,
      })

      setLoading(false)
    }

    const cargar = async () => {
      const { data: { session } } = await supabase.auth.getSession()
      if (!session) { router.push('/'); return }

      const userId = session.user.id
      const { data: srv } = await supabase
        .from('servidores_inscripcion')
        .select('id, nombre, es_interno, usuario_id')
        .eq('usuario_id', userId)
        .eq('retiro_id', RETIRO_ID)
        .single()

      if (!srv) {
        const inscripcionId = session.user.user_metadata?.servidor_inscripcion_id
        if (inscripcionId) {
          await supabase
            .from('servidores_inscripcion')
            .update({ usuario_id: userId })
            .eq('id', inscripcionId)
            .is('usuario_id', null)

          const { data: srvNuevo } = await supabase
            .from('servidores_inscripcion')
            .select('id, nombre, es_interno, usuario_id')
            .eq('usuario_id', userId)
            .eq('retiro_id', RETIRO_ID)
            .single()

          if (!srvNuevo) { setLoading(false); return }
          await cargarDatos(srvNuevo)
          return
        }
        setLoading(false)
        return
      }

      await cargarDatos(srv)
    }

    cargar()
  }, [router])

  if (loading) return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: '60vh' }}>
      <div style={{ textAlign: 'center' }}>
        <div style={{ width: 36, height: 36, border: '3px solid #e2e4f0', borderTopColor: '#0f1787', borderRadius: '50%', animation: 'spin 0.8s linear infinite', margin: '0 auto 10px' }} />
        <style>{`@keyframes spin { to { transform: rotate(360deg) } }`}</style>
        <p style={{ fontSize: 14, color: '#6b7280' }}>Cargando tu perfil...</p>
      </div>
    </div>
  )

  if (!datos) return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: '60vh', flexDirection: 'column', gap: 12 }}>
      <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="#d97706" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
        <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/>
      </svg>
      <p style={{ color: '#6b7280', fontSize: 14, textAlign: 'center', margin: 0 }}>
        No encontramos tu perfil de servidor.<br />Contacta a un líder.
      </p>
      <button
        onClick={() => { supabase.auth.signOut(); router.push('/') }}
        style={{ background: '#0f1787', color: 'white', border: 'none', borderRadius: 10, padding: '10px 20px', cursor: 'pointer', fontSize: 14, fontWeight: 500 }}
      >
        Volver al inicio
      </button>
    </div>
  )

  const cfg = estadoConfig[datos.estado_pago]
  const porcentajePagado = datos.costo_retiro > 0
    ? Math.min(100, Math.round((datos.total_pagado / datos.costo_retiro) * 100))
    : 100
  const porcentajeAsist = datos.total_reuniones > 0
    ? Math.round((datos.racha_asistencias / datos.total_reuniones) * 100)
    : 0

  const nombreCorto = datos.nombre_completo.split(' ')[0]

  return (
    <div style={{ padding: '20px 16px', maxWidth: 480, margin: '0 auto', paddingBottom: 100 }}>

      {/* Hero navy */}
      <div style={{ background: '#0f1787', borderRadius: 20, padding: 24, marginBottom: 12, position: 'relative', overflow: 'hidden' }}>
        <div style={{ position: 'absolute', right: -20, top: -20, width: 100, height: 100, background: 'rgba(255,255,255,0.04)', borderRadius: '50%' }} />
        <div style={{ position: 'absolute', right: 20, bottom: -30, width: 80, height: 80, background: 'rgba(255,255,255,0.03)', borderRadius: '50%' }} />
        <div style={{ position: 'relative' }}>
          <p style={{ fontSize: 11, color: 'rgba(255,255,255,0.4)', margin: '0 0 2px', letterSpacing: '0.1em', textTransform: 'uppercase' }}>
            Hola, {nombreCorto}
          </p>
          <p style={{ fontSize: 20, fontWeight: 500, color: '#fff', margin: '0 0 18px' }}>
            Retiro Effetá Mazuren
          </p>
          <div style={{ display: 'flex', gap: 8 }}>
            <div style={{ flex: 1, background: 'rgba(255,255,255,0.08)', borderRadius: 12, padding: 12 }}>
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="rgba(255,255,255,0.4)" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" style={{ display: 'block', marginBottom: 4 }}>
                <rect x="3" y="4" width="18" height="18" rx="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/>
              </svg>
              <p style={{ fontSize: 13, fontWeight: 500, color: '#fff', margin: '0 0 2px' }}>3–5 jul</p>
              <p style={{ fontSize: 11, color: 'rgba(255,255,255,0.4)', margin: 0 }}>Fecha</p>
            </div>
            <div style={{ flex: 1, background: 'rgba(255,255,255,0.08)', borderRadius: 12, padding: 12 }}>
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="rgba(255,255,255,0.4)" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" style={{ display: 'block', marginBottom: 4 }}>
                <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"/><circle cx="12" cy="10" r="3"/>
              </svg>
              <p style={{ fontSize: 13, fontWeight: 500, color: '#fff', margin: '0 0 2px' }}>Bogotá</p>
              <p style={{ fontSize: 11, color: 'rgba(255,255,255,0.4)', margin: 0 }}>Sede</p>
            </div>
            <div style={{ flex: 1, background: 'rgba(255,255,255,0.08)', borderRadius: 12, padding: 12 }}>
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="rgba(255,255,255,0.4)" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" style={{ display: 'block', marginBottom: 4 }}>
                <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/>
              </svg>
              <p style={{ fontSize: 13, fontWeight: 500, color: '#fff', margin: '0 0 2px' }}>{datos.es_interno ? 'Interno' : 'Externo'}</p>
              <p style={{ fontSize: 11, color: 'rgba(255,255,255,0.4)', margin: 0 }}>Rol</p>
            </div>
          </div>
        </div>
      </div>

      {/* Card pago */}
      <div
        onClick={() => router.push('/servidor/pago')}
        style={{ background: '#fff', borderRadius: 16, border: '0.5px solid #e8eaf0', padding: 20, marginBottom: 10, cursor: 'pointer' }}
      >
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <div style={{ width: 36, height: 36, borderRadius: 10, background: cfg.bg, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke={cfg.color} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                <rect x="1" y="4" width="22" height="16" rx="2"/><line x1="1" y1="10" x2="23" y2="10"/>
              </svg>
            </div>
            <div>
              <p style={{ fontSize: 13, fontWeight: 500, color: '#111827', margin: 0 }}>Estado de pago</p>
              <p style={{ fontSize: 11, color: '#6b7280', margin: 0 }}>Inscripción retiro</p>
            </div>
          </div>
          <span style={{ fontSize: 12, fontWeight: 500, background: cfg.bg, color: cfg.textColor, padding: '4px 10px', borderRadius: 20 }}>
            {cfg.label}
          </span>
        </div>

        {datos.es_interno && (
          <>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: 8 }}>
              <p style={{ fontSize: 22, fontWeight: 500, color: '#111827', margin: 0 }}>
                ${datos.total_pagado.toLocaleString('es-CO')}
              </p>
              <p style={{ fontSize: 12, color: '#6b7280', margin: 0 }}>
                de ${datos.costo_retiro.toLocaleString('es-CO')}
              </p>
            </div>
            <div style={{ height: 5, background: '#f3f4f6', borderRadius: 4, overflow: 'hidden', marginBottom: 8 }}>
              <div style={{ height: '100%', width: `${porcentajePagado}%`, background: cfg.color, borderRadius: 4, transition: 'width 0.6s' }} />
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between' }}>
              <p style={{ fontSize: 11, color: '#6b7280', margin: 0 }}>
                {datos.saldo_pendiente > 0 ? `$${datos.saldo_pendiente.toLocaleString('es-CO')} pendiente` : 'Sin saldo pendiente'}
              </p>
              <p style={{ fontSize: 11, fontWeight: 500, color: cfg.color, margin: 0 }}>{porcentajePagado}% pagado</p>
            </div>
          </>
        )}
      </div>

      {/* Cards asistencias y facturas */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginBottom: 10 }}>
        <div
          onClick={() => router.push('/servidor/asistencias')}
          style={{ background: '#fff', borderRadius: 16, border: '0.5px solid #e8eaf0', padding: 16, cursor: 'pointer' }}
        >
          <div style={{ width: 32, height: 32, borderRadius: 8, background: '#eef2ff', display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: 10 }}>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#4338ca" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
              <rect x="3" y="4" width="18" height="18" rx="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/><polyline points="9 16 11 18 15 14"/>
            </svg>
          </div>
          <p style={{ fontSize: 22, fontWeight: 500, color: '#111827', margin: '0 0 2px' }}>
            {datos.racha_asistencias}/{datos.total_reuniones}
          </p>
          <p style={{ fontSize: 11, color: '#6b7280', margin: '0 0 8px' }}>Asistencias</p>
          <div style={{ height: 3, background: '#f3f4f6', borderRadius: 4, overflow: 'hidden' }}>
            <div style={{ height: '100%', width: `${porcentajeAsist}%`, background: '#4338ca', borderRadius: 4 }} />
          </div>
        </div>

        <div
          onClick={() => router.push('/servidor/reembolso')}
          style={{ background: '#fff', borderRadius: 16, border: '0.5px solid #e8eaf0', padding: 16, cursor: 'pointer' }}
        >
          <div style={{ width: 32, height: 32, borderRadius: 8, background: '#fffbeb', display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: 10 }}>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#92400e" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
              <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/>
            </svg>
          </div>
          <p style={{ fontSize: 22, fontWeight: 500, color: '#111827', margin: '0 0 2px' }}>0</p>
          <p style={{ fontSize: 11, color: '#6b7280', margin: '0 0 4px' }}>Facturas</p>
          <p style={{ fontSize: 11, color: '#d97706', margin: 0 }}>Subir factura</p>
        </div>
      </div>

      {/* Racha */}
      <div
        onClick={() => router.push('/servidor/asistencias')}
        style={{ background: '#fff', borderRadius: 16, border: '0.5px solid #e8eaf0', padding: 16, marginBottom: 10, display: 'flex', alignItems: 'center', gap: 12, cursor: 'pointer' }}
      >
        <div style={{ width: 36, height: 36, borderRadius: 10, background: '#fffbeb', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#d97706" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
            <path d="M8.5 14.5A2.5 2.5 0 0 0 11 12c0-1.38-.5-2-1-3-1.072-2.143-.224-4.054 2-6 .5 2.5 2 4.9 4 6.5 2 1.6 3 3.5 3 5.5a7 7 0 1 1-14 0c0-1.153.433-2.294 1-3a2.5 2.5 0 0 0 2.5 2.5z"/>
          </svg>
        </div>
        <div style={{ flex: 1 }}>
          <p style={{ fontSize: 13, fontWeight: 500, color: '#111827', margin: 0 }}>Racha de asistencia</p>
          <p style={{ fontSize: 11, color: '#6b7280', margin: 0 }}>
            {datos.racha_asistencias > 0 ? `${datos.racha_asistencias} semanas consecutivas` : 'Sin racha aún'}
          </p>
        </div>
        <p style={{ fontSize: 22, fontWeight: 500, color: '#d97706', margin: 0 }}>{datos.racha_asistencias}</p>
      </div>

      {/* Roles y mesa */}
      {(datos.roles.length > 0 || datos.mesa) && (
        <div style={{ background: '#fff', borderRadius: 16, border: '0.5px solid #e8eaf0', padding: 18, marginBottom: 10 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 14 }}>
            <div style={{ width: 32, height: 32, borderRadius: 8, background: '#f0f2ff', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#0f1787" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                <circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/>
              </svg>
            </div>
            <p style={{ fontSize: 13, fontWeight: 500, color: '#111827', margin: 0 }}>Mi servicio en el retiro</p>
          </div>
          {datos.mesa && (
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: datos.roles.length > 0 ? 12 : 0 }}>
              <p style={{ fontSize: 12, color: '#6b7280', margin: 0 }}>Mesa asignada</p>
              <span style={{ background: '#eef2ff', color: '#3730a3', padding: '3px 10px', borderRadius: 20, fontSize: 12, fontWeight: 500 }}>
                {datos.mesa}
              </span>
            </div>
          )}
          {datos.roles.length > 0 && (
            <div>
              <p style={{ fontSize: 12, color: '#6b7280', margin: '0 0 8px' }}>Roles</p>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                {datos.roles.map((rol, i) => (
                  <span key={i} style={{ background: '#eef2ff', color: '#3730a3', padding: '4px 10px', borderRadius: 20, fontSize: 12, fontWeight: 500 }}>
                    {rol}
                  </span>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

    </div>
  )
}
