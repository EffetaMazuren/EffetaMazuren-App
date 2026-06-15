'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'

const RETIRO_ID = '21da7588-f7d9-4bf8-a6f6-ae6c8258c00e'

interface Reunion {
  id: string
  nombre: string
  fecha: string
  tipo: string
  asistio: boolean | null
  asistencia_id: string | null
}

export default function AsistenciasServidor() {
  const router = useRouter()
  const [reuniones, setReuniones] = useState<Reunion[]>([])
  const [loading, setLoading] = useState(true)
  const [racha, setRacha] = useState(0)

  useEffect(() => {
    const cargar = async () => {
      const { data: { session } } = await supabase.auth.getSession()
      if (!session) { router.push('/'); return }

      const { data: srv } = await supabase
        .from('servidores_inscripcion')
        .select('id')
        .eq('usuario_id', session.user.id)
        .eq('retiro_id', RETIRO_ID)
        .single()

      if (!srv) return

      // Reuniones del retiro
      const { data: reuns } = await supabase
        .from('reuniones')
        .select('id, nombre, fecha, tipo')
        .eq('retiro_id', RETIRO_ID)
        .order('fecha', { ascending: false })

      // Asistencias del servidor
      const { data: asists } = await supabase
        .from('asistencias')
        .select('id, reunion_id, asistio')
        .eq('servidor_inscripcion_id', srv.id)

      const asistMap = new Map(asists?.map(a => [a.reunion_id, { id: a.id, asistio: a.asistio }]) || [])

      const lista: Reunion[] = (reuns || []).map(r => {
        const asist = asistMap.get(r.id)
        return {
          id: r.id,
          nombre: r.nombre,
          fecha: r.fecha,
          tipo: r.tipo || 'reunion',
          asistio: asist?.asistio ?? null,
          asistencia_id: asist?.id || null,
        }
      })

      setReuniones(lista)

      // Calcular racha (consecutivas desde la más reciente)
      const ordenadas = [...lista].sort((a, b) =>
        new Date(b.fecha).getTime() - new Date(a.fecha).getTime()
      )
      let rachaConsec = 0
      for (const r of ordenadas) {
        if (r.asistio === true) rachaConsec++
        else if (r.asistio === false) break
      }
      setRacha(rachaConsec)

      setLoading(false)
    }
    cargar()
  }, [router])

  const totalAsistidas = reuniones.filter(r => r.asistio === true).length
  const totalReuniones = reuniones.length
  const porcentaje = totalReuniones > 0 ? Math.round((totalAsistidas / totalReuniones) * 100) : 0

  const getColorPct = (pct: number) => pct >= 80 ? '#16a34a' : pct >= 50 ? '#d97706' : '#dc2626'

  if (loading) return (
    <div style={{ display: 'flex', justifyContent: 'center', padding: 60 }}>
      <div style={{
        width: 32, height: 32, border: '3px solid #e2e4f0',
        borderTopColor: '#0f1787', borderRadius: '50%',
        animation: 'spin 0.8s linear infinite'
      }} />
      <style>{`@keyframes spin{to{transform:rotate(360deg)}}`}</style>
    </div>
  )

  return (
    <div style={{ padding: '20px 16px', maxWidth: 480, margin: '0 auto' }}>
      <h1 style={{ fontSize: 20, fontWeight: 700, color: '#111827', margin: '0 0 20px' }}>
        📅 Asistencias Effetá
      </h1>

      {/* Stats header */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 10, marginBottom: 20 }}>
        {[
          { label: 'Asistidas', valor: totalAsistidas, color: '#16a34a' },
          { label: 'Total', valor: totalReuniones, color: '#374151' },
          { label: 'Racha', valor: racha + '🔥', color: '#d97706' },
        ].map(s => (
          <div key={s.label} style={{
            background: 'white', border: '1.5px solid #e8eaf0',
            borderRadius: 12, padding: '14px 10px', textAlign: 'center'
          }}>
            <div style={{ fontSize: 22, fontWeight: 700, color: s.color }}>
              {s.valor}
            </div>
            <div style={{ fontSize: 11, color: '#6b7280', marginTop: 2 }}>{s.label}</div>
          </div>
        ))}
      </div>

      {/* Barra progreso */}
      {totalReuniones > 0 && (
        <div style={{
          background: 'white', border: '1.5px solid #e8eaf0',
          borderRadius: 14, padding: '16px 20px', marginBottom: 20
        }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 8 }}>
            <span style={{ fontSize: 13, color: '#374151', fontWeight: 500 }}>Asistencia total</span>
            <span style={{ fontSize: 13, fontWeight: 700, color: getColorPct(porcentaje) }}>
              {porcentaje}%
            </span>
          </div>
          <div style={{ height: 10, background: '#f3f4f6', borderRadius: 6, overflow: 'hidden' }}>
            <div style={{
              height: '100%', width: `${porcentaje}%`,
              background: getColorPct(porcentaje),
              borderRadius: 6, transition: 'width 0.6s'
            }} />
          </div>
          <div style={{ fontSize: 12, color: '#9ca3af', marginTop: 6 }}>
            {porcentaje >= 80
              ? '🌟 ¡Excelente compromiso!'
              : porcentaje >= 50
              ? '💪 Sigue adelante'
              : '📣 Te esperamos en las reuniones'}
          </div>
        </div>
      )}

      {/* Lista reuniones */}
      {reuniones.length === 0 ? (
        <div style={{ textAlign: 'center', padding: '40px 20px', color: '#9ca3af' }}>
          <div style={{ fontSize: 40, marginBottom: 8 }}>🗓️</div>
          <p style={{ margin: 0 }}>No hay reuniones registradas aún</p>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {reuniones.map(r => (
            <div key={r.id} style={{
              background: 'white', border: '1.5px solid #e8eaf0',
              borderRadius: 12, padding: '14px 16px',
              display: 'flex', alignItems: 'center', gap: 14
            }}>
              {/* Indicador asistencia */}
              <div style={{
                width: 36, height: 36, borderRadius: '50%', flexShrink: 0,
                display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 16,
                background: r.asistio === true ? '#f0fdf4'
                  : r.asistio === false ? '#fef2f2'
                  : '#f9fafb',
              }}>
                {r.asistio === true ? '✅' : r.asistio === false ? '❌' : '⏳'}
              </div>

              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{
                  fontWeight: 600, fontSize: 14, color: '#111827',
                  whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis'
                }}>
                  {r.nombre}
                </div>
                <div style={{ fontSize: 12, color: '#6b7280', marginTop: 2 }}>
                  {r.fecha ? new Date(r.fecha + 'T12:00:00').toLocaleDateString('es-CO', {
                    weekday: 'short', day: 'numeric', month: 'short'
                  }) : '—'}
                  {' · '}{r.tipo}
                </div>
              </div>

              <div style={{
                fontSize: 12, fontWeight: 600, padding: '3px 10px', borderRadius: 20,
                background: r.asistio === true ? '#f0fdf4'
                  : r.asistio === false ? '#fef2f2'
                  : '#f9fafb',
                color: r.asistio === true ? '#16a34a'
                  : r.asistio === false ? '#dc2626'
                  : '#9ca3af',
                whiteSpace: 'nowrap'
              }}>
                {r.asistio === true ? 'Asistí' : r.asistio === false ? 'Falta' : 'Sin datos'}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
