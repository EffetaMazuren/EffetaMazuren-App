'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'

const RETIRO_ID = '21da7588-f7d9-4bf8-a6f6-ae6c8258c00e'

interface Alerta {
  id: string
  foto_url: string | null
  fecha_registro: string
  motivo_alerta: string
  fuera_de_horario: boolean
  servidor_inscripcion: { nombre: string } | null
  reunion: { nombre: string; fecha: string } | null
}

export default function AlertasAsistenciasPage() {
  const router = useRouter()
  const [alertas, setAlertas] = useState<Alerta[]>([])
  const [todas, setTodas] = useState<any[]>([])
  const [tab, setTab] = useState<'alertas' | 'todas'>('alertas')
  const [loading, setLoading] = useState(true)
  const [imagenAmpliada, setImagenAmpliada] = useState<Alerta | null>(null)

  useEffect(() => { cargar() }, [])

  async function cargar() {
    setLoading(true)
    const [{ data: alts }, { data: tod }] = await Promise.all([
      supabase
        .from('asistencias')
        .select(`
          id, foto_url, fecha_registro, motivo_alerta, fuera_de_horario,
          servidor_inscripcion:servidor_inscripcion_id(nombre),
          reunion:reunion_id(nombre, fecha)
        `)
        .eq('fuera_de_horario', true)
        .order('fecha_registro', { ascending: false }),
      supabase
        .from('asistencias')
        .select(`
          id, foto_url, fecha_registro, motivo_alerta, fuera_de_horario, asistio,
          servidor_inscripcion:servidor_inscripcion_id(nombre),
          reunion:reunion_id(nombre, fecha)
        `)
        .order('fecha_registro', { ascending: false })
        .limit(100),
    ])
    setAlertas((alts || []) as Alerta[])
    setTodas(tod || [])
    setLoading(false)
  }

  const tabStyle = (t: string) => ({
    padding: '8px 20px', borderRadius: 8, border: 'none', cursor: 'pointer' as const,
    fontWeight: 600 as const, fontSize: 14,
    background: tab === t ? '#0f1787' : '#f1f5f9',
    color: tab === t ? '#fff' : '#64748b',
  })

  const fmtFecha = (iso: string) =>
    new Date(iso).toLocaleString('es-CO', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })

  return (
    <div style={{ minHeight: '100vh', background: '#f7f8fc', paddingBottom: 40 }}>

      {/* Header */}
      <div style={{ background: '#0f1787', padding: '28px 20px 24px' }}>
        <button
          onClick={() => router.push('/dashboard')}
          style={{ background: 'none', border: 'none', color: 'rgba(255,255,255,0.6)', fontSize: 14, cursor: 'pointer', padding: 0, marginBottom: 12 }}
        >
          ← Dashboard
        </button>
        <div style={{ fontSize: 22, fontWeight: 600, color: '#fff' }}>Asistencias</div>
        <div style={{ fontSize: 13, color: 'rgba(255,255,255,0.5)', marginTop: 4 }}>
          {alertas.length > 0
            ? `⚠️ ${alertas.length} fuera de horario`
            : '✅ Sin alertas pendientes'}
        </div>
      </div>

      <div style={{ padding: '20px' }}>

        {/* Tabs */}
        <div style={{ display: 'flex', gap: 8, marginBottom: 20 }}>
          <button onClick={() => setTab('alertas')} style={tabStyle('alertas')}>
            ⚠️ Alertas
            {alertas.length > 0 && (
              <span style={{ background: '#dc2626', color: '#fff', borderRadius: 20, fontSize: 11, padding: '1px 7px', marginLeft: 6 }}>
                {alertas.length}
              </span>
            )}
          </button>
          <button onClick={() => setTab('todas')} style={tabStyle('todas')}>
            Todas
          </button>
        </div>

        {loading ? (
          <p style={{ textAlign: 'center', color: '#94a3b8', padding: 40 }}>Cargando...</p>
        ) : tab === 'alertas' ? (
          alertas.length === 0 ? (
            <div style={{ background: '#fff', borderRadius: 16, padding: 40, textAlign: 'center', color: '#94a3b8' }}>
              ✅ No hay asistencias fuera de horario
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              {alertas.map(a => (
                <div key={a.id} style={{ background: '#fff', borderRadius: 14, padding: 20, border: '1.5px solid #fcd34d', boxShadow: '0 1px 6px rgba(0,0,0,0.06)' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 10 }}>
                    <div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
                        <span style={{ fontSize: 13, fontWeight: 700, color: '#92400e', background: '#fef3c7', padding: '2px 10px', borderRadius: 20 }}>
                          ⚠️ Fuera de horario
                        </span>
                      </div>
                      <p style={{ margin: 0, fontSize: 15, fontWeight: 600, color: '#1e293b' }}>
                        👤 {(a.servidor_inscripcion as any)?.nombre || 'Servidor'}
                      </p>
                      <p style={{ margin: '4px 0 0', fontSize: 13, color: '#64748b' }}>
                        📅 {(a.reunion as any)?.nombre || '—'} · {(a.reunion as any)?.fecha ? new Date((a.reunion as any).fecha + 'T12:00:00').toLocaleDateString('es-CO', { day: 'numeric', month: 'long' }) : '—'}
                      </p>
                      <p style={{ margin: '4px 0 0', fontSize: 12, color: '#94a3b8' }}>
                        🕐 {fmtFecha(a.fecha_registro)}
                      </p>
                    </div>
                  </div>

                  {a.motivo_alerta && (
                    <div style={{ background: '#fffbeb', borderRadius: 8, padding: '8px 12px', marginBottom: 12, fontSize: 12, color: '#92400e' }}>
                      {a.motivo_alerta}
                    </div>
                  )}

                  {a.foto_url && (
                    <img
                      src={a.foto_url}
                      alt="foto asistencia"
                      onClick={() => setImagenAmpliada(a)}
                      style={{ width: '100%', maxHeight: 200, objectFit: 'cover', borderRadius: 10, cursor: 'pointer' }}
                    />
                  )}
                </div>
              ))}
            </div>
          )
        ) : (
          todas.length === 0 ? (
            <div style={{ background: '#fff', borderRadius: 16, padding: 40, textAlign: 'center', color: '#94a3b8' }}>
              Sin asistencias registradas aún
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              {todas.map((a: any) => (
                <div key={a.id} style={{ background: '#fff', borderRadius: 14, padding: '14px 16px', border: `1.5px solid ${a.fuera_de_horario ? '#fcd34d' : '#e8eaf0'}`, display: 'flex', alignItems: 'center', gap: 12 }}>
                  {a.foto_url ? (
                    <img
                      src={a.foto_url}
                      alt="foto"
                      onClick={() => setImagenAmpliada(a)}
                      style={{ width: 48, height: 48, borderRadius: 10, objectFit: 'cover', cursor: 'pointer', flexShrink: 0 }}
                    />
                  ) : (
                    <div style={{ width: 48, height: 48, borderRadius: 10, background: '#f1f5f9', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, fontSize: 20 }}>
                      📸
                    </div>
                  )}
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: 14, fontWeight: 600, color: '#1e293b', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {a.servidor_inscripcion?.nombre || 'Servidor'}
                    </div>
                    <div style={{ fontSize: 12, color: '#64748b', marginTop: 2 }}>
                      {a.reunion?.nombre || '—'}
                    </div>
                    <div style={{ fontSize: 11, color: '#94a3b8', marginTop: 2 }}>
                      {fmtFecha(a.fecha_registro)}
                    </div>
                  </div>
                  <div style={{ flexShrink: 0, textAlign: 'right' }}>
                    {a.fuera_de_horario && (
                      <span style={{ fontSize: 11, background: '#fef3c7', color: '#92400e', padding: '2px 8px', borderRadius: 20, fontWeight: 600 }}>
                        ⚠️ Fuera
                      </span>
                    )}
                    {!a.fuera_de_horario && (
                      <span style={{ fontSize: 11, background: '#f0fdf4', color: '#16a34a', padding: '2px 8px', borderRadius: 20, fontWeight: 600 }}>
                        ✅ Normal
                      </span>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )
        )}
      </div>

      {/* Modal imagen */}
      {imagenAmpliada && (
        <div
          onClick={() => setImagenAmpliada(null)}
          style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.9)', zIndex: 100, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: 20 }}
        >
          <img
            src={imagenAmpliada.foto_url!}
            alt="foto"
            style={{ maxWidth: '100%', maxHeight: '75vh', borderRadius: 12, objectFit: 'contain' }}
            onClick={e => e.stopPropagation()}
          />
          <div style={{ marginTop: 12, textAlign: 'center' }}>
            <p style={{ color: '#fff', fontSize: 14, fontWeight: 600, margin: 0 }}>
              {(imagenAmpliada.servidor_inscripcion as any)?.nombre}
            </p>
            <p style={{ color: 'rgba(255,255,255,0.5)', fontSize: 12, margin: '4px 0 0' }}>
              {(imagenAmpliada.reunion as any)?.nombre} · {fmtFecha(imagenAmpliada.fecha_registro)}
            </p>
          </div>
          <p style={{ color: 'rgba(255,255,255,0.3)', fontSize: 12, marginTop: 16 }}>Toca fuera para cerrar</p>
        </div>
      )}
    </div>
  )
}
