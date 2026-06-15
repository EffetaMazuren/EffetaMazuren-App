'use client'

import { useEffect, useState, useRef } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'

const RETIRO_ID = '21da7588-f7d9-4bf8-a6f6-ae6c8258c00e'
const BUCKET = 'comprobantes-pagos'

interface Reunion {
  id: string
  nombre: string
  fecha: string
  tipo: string
  cancelada: boolean
  asistio: boolean | null
  asistencia_id: string | null
  foto_url: string | null
}

export default function AsistenciasServidor() {
  const router = useRouter()
  const videoRef = useRef<HTMLVideoElement>(null)
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const streamRef = useRef<MediaStream | null>(null)

  const [reuniones, setReuniones] = useState<Reunion[]>([])
  const [inscripcionId, setInscripcionId] = useState('')
  const [loading, setLoading] = useState(true)
  const [camaraActiva, setCamaraActiva] = useState(false)
  const [reunionActiva, setReunionActiva] = useState<Reunion | null>(null)
  const [subiendo, setSubiendo] = useState(false)
  const [error, setError] = useState('')
  const [exito, setExito] = useState('')

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
      setInscripcionId(srv.id)

      await cargarReuniones(srv.id)
      setLoading(false)
    }
    cargar()

    return () => {
      detenerCamara()
    }
  }, [router])

  const cargarReuniones = async (srvId: string) => {
    const hoy = new Date().toISOString().split('T')[0]

    const { data: reuns } = await supabase
      .from('reuniones')
      .select('id, nombre, fecha, tipo, cancelada')
      .eq('retiro_id', RETIRO_ID)
      .lte('fecha', hoy)
      .order('fecha', { ascending: false })

    const { data: asists } = await supabase
      .from('asistencias')
      .select('id, reunion_id, asistio, foto_url')
      .eq('servidor_inscripcion_id', srvId)

    const asistMap = new Map(asists?.map(a => [a.reunion_id, a]) || [])

    const lista: Reunion[] = (reuns || []).map(r => {
      const asist = asistMap.get(r.id)
      return {
        id: r.id,
        nombre: r.nombre,
        fecha: r.fecha,
        tipo: r.tipo,
        cancelada: r.cancelada ?? false,
        asistio: asist?.asistio ?? null,
        asistencia_id: asist?.id || null,
        foto_url: asist?.foto_url || null,
      }
    })

    setReuniones(lista)
  }

  const esHoy = (fecha: string) => {
    const hoy = new Date()
    const fechaReunion = new Date(fecha + 'T12:00:00')
    return hoy.toDateString() === fechaReunion.toDateString()
  }

  const despuesDe6pm = () => {
    const ahora = new Date()
    // Hora Colombia (UTC-5)
    const horaCol = ahora.getUTCHours() - 5
    return horaCol >= 18
  }

  const puedeRegistrar = (r: Reunion) => {
    return esHoy(r.fecha) && despuesDe6pm() && !r.cancelada && !r.asistio
  }

  const abrirCamara = async (reunion: Reunion) => {
    setError('')
    setReunionActiva(reunion)
    setCamaraActiva(true)

    setTimeout(async () => {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({
          video: { facingMode: 'user' },
          audio: false
        })
        streamRef.current = stream
        if (videoRef.current) {
          videoRef.current.srcObject = stream
          videoRef.current.play()
        }
      } catch {
        setError('No se pudo acceder a la cámara. Verifica los permisos.')
        setCamaraActiva(false)
      }
    }, 100)
  }

  const detenerCamara = () => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(t => t.stop())
      streamRef.current = null
    }
    setCamaraActiva(false)
    setReunionActiva(null)
  }

  const tomarFoto = async () => {
    if (!videoRef.current || !canvasRef.current || !reunionActiva) return

    const video = videoRef.current
    const canvas = canvasRef.current
    canvas.width = video.videoWidth
    canvas.height = video.videoHeight
    const ctx = canvas.getContext('2d')
    if (!ctx) return

    // Espejo para selfie
    ctx.translate(canvas.width, 0)
    ctx.scale(-1, 1)
    ctx.drawImage(video, 0, 0)

    setSubiendo(true)
    detenerCamara()

    canvas.toBlob(async (blob) => {
      if (!blob) {
        setError('Error al capturar foto')
        setSubiendo(false)
        return
      }

      const nombreArchivo = `asistencias/${inscripcionId}/${reunionActiva.id}_${Date.now()}.jpg`

      const { error: upErr } = await supabase.storage
        .from(BUCKET)
        .upload(nombreArchivo, blob, { contentType: 'image/jpeg', upsert: false })

      if (upErr) {
        setError('Error al subir foto: ' + upErr.message)
        setSubiendo(false)
        return
      }

      const { data: urlData } = supabase.storage.from(BUCKET).getPublicUrl(nombreArchivo)

      const { error: asistErr } = await supabase
        .from('asistencias')
        .upsert({
          servidor_inscripcion_id: inscripcionId,
          reunion_id: reunionActiva.id,
          asistio: true,
          foto_url: urlData.publicUrl,
          fecha_registro: new Date().toISOString()
        }, { onConflict: 'servidor_inscripcion_id,reunion_id' })

      if (asistErr) {
        setError('Error al registrar asistencia: ' + asistErr.message)
      } else {
        setExito('✅ ¡Asistencia registrada!')
        await cargarReuniones(inscripcionId)
        setTimeout(() => setExito(''), 3000)
      }

      setSubiendo(false)
    }, 'image/jpeg', 0.85)
  }

  const totalAsistidas = reuniones.filter(r => r.asistio === true).length
  const totalValidas = reuniones.filter(r => !r.cancelada).length
  const porcentaje = totalValidas > 0 ? Math.round((totalAsistidas / totalValidas) * 100) : 0

  // Racha consecutiva
  const ordenadas = [...reuniones].sort((a, b) =>
    new Date(b.fecha).getTime() - new Date(a.fecha).getTime()
  )
  let racha = 0
  for (const r of ordenadas) {
    if (r.cancelada) continue
    if (r.asistio === true) racha++
    else if (r.asistio === false || r.asistio === null) break
  }

  const getColorPct = (pct: number) =>
    pct >= 80 ? '#16a34a' : pct >= 50 ? '#d97706' : '#dc2626'

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

      {/* Stats */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 10, marginBottom: 20 }}>
        {[
          { label: 'Asistidas', valor: String(totalAsistidas), color: '#16a34a' },
          { label: 'Total', valor: String(totalValidas), color: '#374151' },
          { label: 'Racha 🔥', valor: String(racha), color: '#d97706' },
        ].map(s => (
          <div key={s.label} style={{
            background: 'white', border: '1.5px solid #e8eaf0',
            borderRadius: 12, padding: '14px 10px', textAlign: 'center'
          }}>
            <div style={{ fontSize: 22, fontWeight: 700, color: s.color }}>{s.valor}</div>
            <div style={{ fontSize: 11, color: '#6b7280', marginTop: 2 }}>{s.label}</div>
          </div>
        ))}
      </div>

      {/* Barra progreso */}
      {totalValidas > 0 && (
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
            {porcentaje >= 80 ? '🌟 ¡Excelente compromiso!'
              : porcentaje >= 50 ? '💪 Sigue adelante'
              : '📣 Te esperamos en las reuniones'}
          </div>
        </div>
      )}

      {/* Mensajes */}
      {error && (
        <p style={{
          color: '#dc2626', fontSize: 13, margin: '0 0 16px',
          background: '#fef2f2', padding: '10px 14px', borderRadius: 10
        }}>{error}</p>
      )}
      {exito && (
        <p style={{
          color: '#16a34a', fontSize: 13, margin: '0 0 16px',
          background: '#f0fdf4', padding: '10px 14px', borderRadius: 10
        }}>{exito}</p>
      )}

      {/* Cámara */}
      {camaraActiva && (
        <div style={{
          position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.95)',
          zIndex: 200, display: 'flex', flexDirection: 'column',
          alignItems: 'center', justifyContent: 'center', padding: 20
        }}>
          <p style={{ color: 'white', fontSize: 15, fontWeight: 600, marginBottom: 16, textAlign: 'center' }}>
            📸 Tómate una foto para registrar tu asistencia
          </p>
          <p style={{ color: 'rgba(255,255,255,0.6)', fontSize: 12, marginBottom: 20, textAlign: 'center' }}>
            {reunionActiva?.nombre} · {reunionActiva?.fecha && new Date(reunionActiva.fecha + 'T12:00:00').toLocaleDateString('es-CO', { weekday: 'long', day: 'numeric', month: 'long' })}
          </p>

          <video
            ref={videoRef}
            autoPlay
            playsInline
            muted
            style={{
              width: '100%', maxWidth: 360, borderRadius: 16,
              transform: 'scaleX(-1)',
              marginBottom: 24
            }}
          />
          <canvas ref={canvasRef} style={{ display: 'none' }} />

          <div style={{ display: 'flex', gap: 12, width: '100%', maxWidth: 360 }}>
            <button
              onClick={detenerCamara}
              style={{
                flex: 1, padding: '14px', background: 'rgba(255,255,255,0.15)',
                color: 'white', border: 'none', borderRadius: 12,
                fontSize: 15, cursor: 'pointer', fontWeight: 500
              }}
            >Cancelar</button>
            <button
              onClick={tomarFoto}
              disabled={subiendo}
              style={{
                flex: 2, padding: '14px',
                background: subiendo ? '#9ca3af' : '#16a34a',
                color: 'white', border: 'none', borderRadius: 12,
                fontSize: 15, fontWeight: 700,
                cursor: subiendo ? 'not-allowed' : 'pointer'
              }}
            >{subiendo ? '⏳ Registrando...' : '📸 Tomar foto'}</button>
          </div>
        </div>
      )}

      {/* Lista reuniones */}
      {reuniones.length === 0 ? (
        <div style={{ textAlign: 'center', padding: '40px 20px', color: '#9ca3af' }}>
          <div style={{ fontSize: 40, marginBottom: 8 }}>🗓️</div>
          <p style={{ margin: 0 }}>No hay reuniones pasadas aún</p>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {reuniones.map(r => (
            <div key={r.id} style={{
              background: 'white', border: '1.5px solid #e8eaf0',
              borderRadius: 12, padding: '14px 16px',
              opacity: r.cancelada ? 0.6 : 1
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                {/* Ícono estado */}
                <div style={{
                  width: 36, height: 36, borderRadius: '50%', flexShrink: 0,
                  display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 16,
                  background: r.cancelada ? '#f3f4f6'
                    : r.asistio ? '#f0fdf4'
                    : r.asistio === false ? '#fef2f2'
                    : '#f9fafb'
                }}>
                  {r.cancelada ? '🚫' : r.asistio ? '✅' : r.asistio === false ? '❌' : '⏳'}
                </div>

                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{
                    fontWeight: 600, fontSize: 14, color: '#111827',
                    whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis'
                  }}>
                    {r.nombre}
                    {r.cancelada && <span style={{ color: '#9ca3af', fontWeight: 400 }}> · Cancelada</span>}
                  </div>
                  <div style={{ fontSize: 12, color: '#6b7280', marginTop: 2 }}>
                    {new Date(r.fecha + 'T12:00:00').toLocaleDateString('es-CO', {
                      weekday: 'short', day: 'numeric', month: 'short', year: 'numeric'
                    })}
                  </div>
                </div>

                {/* Botón o estado */}
                {puedeRegistrar(r) ? (
                  <button
                    onClick={() => abrirCamara(r)}
                    style={{
                      padding: '8px 12px', background: '#0f1787',
                      color: 'white', border: 'none', borderRadius: 8,
                      fontSize: 12, fontWeight: 600, cursor: 'pointer',
                      flexShrink: 0
                    }}
                  >📸 Foto</button>
                ) : (
                  <span style={{
                    fontSize: 11, fontWeight: 600, padding: '3px 8px',
                    borderRadius: 20, flexShrink: 0,
                    background: r.cancelada ? '#f3f4f6'
                      : r.asistio ? '#f0fdf4'
                      : '#f9fafb',
                    color: r.cancelada ? '#9ca3af'
                      : r.asistio ? '#16a34a'
                      : '#9ca3af'
                  }}>
                    {r.cancelada ? 'Cancelada'
                      : r.asistio ? 'Asistí'
                      : esHoy(r.fecha) && !despuesDe6pm() ? 'Desde 6pm'
                      : 'Sin registro'}
                  </span>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
