'use client'

import { useEffect, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'

type Paso = 'cedula' | 'ya_tiene_cuenta' | 'formulario' | 'enviando' | 'listo' | 'error'

const cardStyle: React.CSSProperties = {
  background: 'white', borderRadius: 16,
  padding: 28, boxShadow: '0 2px 16px rgba(0,0,0,0.06)',
}
const inputStyle: React.CSSProperties = {
  width: '100%', padding: '11px 14px', borderRadius: 10,
  border: '1.5px solid #e2e4f0', fontSize: 15,
  outline: 'none', boxSizing: 'border-box', fontFamily: 'inherit',
}
const labelStyle: React.CSSProperties = {
  display: 'block', fontSize: 13, fontWeight: 600, color: '#374151', marginBottom: 6,
}
const botonPrimario = (loading: boolean): React.CSSProperties => ({
  width: '100%', padding: '13px',
  background: loading ? '#9ca3af' : '#0f1787',
  color: 'white', border: 'none', borderRadius: 10,
  fontSize: 15, fontWeight: 600, cursor: loading ? 'not-allowed' : 'pointer',
})

export default function RegistroServidor() {
  const router = useRouter()

  const [paso, setPaso] = useState<Paso>('cedula')
  const [numeroDocumento, setNumeroDocumento] = useState('')
  const [error, setError] = useState('')

  const [personaId, setPersonaId] = useState<string | null>(null)
  const [tieneFoto, setTieneFoto] = useState(false)

  const [nombre, setNombre] = useState('')
  const [correo, setCorreo] = useState('')
  const [password, setPassword] = useState('')
  const [password2, setPassword2] = useState('')
  const [ideaRecaudo, setIdeaRecaudo] = useState('')
  const [ideaReunion, setIdeaReunion] = useState('')

  const [camaraActiva, setCamaraActiva] = useState(false)
  const [fotoBlob, setFotoBlob] = useState<Blob | null>(null)
  const [fotoPreview, setFotoPreview] = useState<string | null>(null)
  const videoRef = useRef<HTMLVideoElement>(null)
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const streamRef = useRef<MediaStream | null>(null)

  useEffect(() => () => detenerCamara(), [])

  const buscarDocumento = async () => {
    if (numeroDocumento.trim().length < 3) {
      setError('Escribe tu número de documento')
      return
    }
    setError('')
    setPaso('enviando')

    try {
      const res = await fetch('/api/servidor/registro/buscar', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ numero_documento: numeroDocumento.trim() }),
      })
      const data = await res.json()

      if (!res.ok || data.error) {
        setError(data.error || 'Error al buscar tu documento')
        setPaso('cedula')
        return
      }

      if (data.estado === 'tiene_cuenta') {
        setPaso('ya_tiene_cuenta')
        return
      }

      if (data.estado === 'error') {
        setError(data.mensaje)
        setPaso('cedula')
        return
      }

      if (data.estado === 'persona_existente') {
        setPersonaId(data.personaId)
        setTieneFoto(!!data.tieneFoto)
      } else {
        setPersonaId(null)
        setTieneFoto(false)
      }

      setPaso('formulario')
    } catch {
      setError('No se pudo conectar. Intenta de nuevo.')
      setPaso('cedula')
    }
  }

  const abrirCamara = async () => {
    setError('')
    setCamaraActiva(true)
    setTimeout(async () => {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({
          video: { facingMode: 'user' },
          audio: false,
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
  }

  const tomarFoto = () => {
    if (!videoRef.current || !canvasRef.current) return
    const video = videoRef.current
    const canvas = canvasRef.current
    canvas.width = video.videoWidth
    canvas.height = video.videoHeight
    const ctx = canvas.getContext('2d')
    if (!ctx) return

    ctx.translate(canvas.width, 0)
    ctx.scale(-1, 1)
    ctx.drawImage(video, 0, 0)

    canvas.toBlob(blob => {
      if (!blob) return
      setFotoBlob(blob)
      setFotoPreview(URL.createObjectURL(blob))
      detenerCamara()
    }, 'image/jpeg', 0.85)
  }

  const enviarFormulario = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')

    if (!nombre.trim() || !correo.trim() || !password) {
      setError('Completa todos los campos obligatorios')
      return
    }
    if (password !== password2) {
      setError('Las contraseñas no coinciden')
      return
    }
    if (password.length < 6) {
      setError('La contraseña debe tener al menos 6 caracteres')
      return
    }
    if (!tieneFoto && !fotoBlob) {
      setError('Tómate una foto para continuar')
      return
    }

    setPaso('enviando')

    try {
      const form = new FormData()
      form.append('numero_documento', numeroDocumento.trim())
      form.append('nombre', nombre.trim())
      form.append('correo', correo.trim())
      form.append('password', password)
      form.append('idea_recaudo', ideaRecaudo.trim())
      form.append('idea_reunion', ideaReunion.trim())
      if (fotoBlob) form.append('foto', fotoBlob, 'foto.jpg')

      const res = await fetch('/api/servidor/registro/crear', { method: 'POST', body: form })
      const data = await res.json()

      if (!res.ok || data.error) {
        setError(data.error || 'No se pudo completar el registro')
        setPaso('formulario')
        return
      }

      const { error: signInErr } = await supabase.auth.signInWithPassword({
        email: correo.trim().toLowerCase(),
        password,
      })

      if (signInErr) {
        // La cuenta quedó creada correctamente -- solo falló el inicio de
        // sesión automático. La persona puede entrar manual desde "/".
        setPaso('listo')
        return
      }

      setPaso('listo')
    } catch {
      setError('No se pudo conectar. Intenta de nuevo.')
      setPaso('formulario')
    }
  }

  const contenedor: React.CSSProperties = {
    minHeight: '100vh', background: '#f7f8fc',
    display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20,
  }
  const logo = (
    <div style={{ textAlign: 'center', marginBottom: 32 }}>
      <div style={{ fontFamily: 'Georgia, serif', fontSize: 28, fontWeight: 700, color: '#0f1787', letterSpacing: 4, marginBottom: 6 }}>
        EFFETÁ
      </div>
    </div>
  )

  if (paso === 'cedula' || paso === 'enviando') return (
    <div style={contenedor}>
      <div style={{ width: '100%', maxWidth: 420 }}>
        {logo}
        <div style={cardStyle}>
          <h2 style={{ margin: '0 0 16px', fontSize: 18, color: '#111827', fontWeight: 600 }}>
            Regístrate como servidor
          </h2>
          <div style={{ marginBottom: 8 }}>
            <label style={labelStyle}>Número de documento</label>
            <input
              type="number"
              value={numeroDocumento}
              onChange={e => { setNumeroDocumento(e.target.value); setError('') }}
              onKeyDown={e => e.key === 'Enter' && buscarDocumento()}
              placeholder="Ej: 1000181545"
              style={inputStyle}
              autoFocus
              disabled={paso === 'enviando'}
            />
          </div>

          {error && (
            <p style={{ color: '#dc2626', fontSize: 13, margin: '8px 0 0', background: '#fef2f2', padding: '8px 12px', borderRadius: 8 }}>
              {error}
            </p>
          )}

          <button onClick={buscarDocumento} disabled={paso === 'enviando'} style={{ ...botonPrimario(paso === 'enviando'), marginTop: 16 }}>
            {paso === 'enviando' ? 'Buscando...' : 'Continuar'}
          </button>
        </div>

        <p style={{ textAlign: 'center', marginTop: 24, fontSize: 14, color: '#6b7280' }}>
          ¿Ya tienes cuenta?{' '}
          <button onClick={() => router.push('/')} style={{ background: 'none', border: 'none', color: '#0f1787', fontWeight: 600, cursor: 'pointer', fontSize: 14 }}>
            Inicia sesión
          </button>
        </p>
      </div>
    </div>
  )

  if (paso === 'ya_tiene_cuenta') return (
    <div style={contenedor}>
      <div style={{ width: '100%', maxWidth: 420, textAlign: 'center' }}>
        {logo}
        <div style={cardStyle}>
          <p style={{ margin: '0 0 20px', fontSize: 15, color: '#374151' }}>
            Este documento ya tiene una cuenta creada.
          </p>
          <button onClick={() => router.push('/')} style={botonPrimario(false)}>
            Iniciar sesión
          </button>
        </div>
      </div>
    </div>
  )

  if (paso === 'formulario') return (
    <div style={contenedor}>
      <div style={{ width: '100%', maxWidth: 420 }}>
        {logo}
        <form onSubmit={enviarFormulario} style={{ ...cardStyle, display: 'flex', flexDirection: 'column', gap: 14 }}>
          <div>
            <label style={labelStyle}>Nombre completo</label>
            <input type="text" value={nombre} onChange={e => setNombre(e.target.value)} style={inputStyle} required />
          </div>
          <div>
            <label style={labelStyle}>Correo electrónico</label>
            <input type="email" value={correo} onChange={e => setCorreo(e.target.value)} placeholder="tu@correo.com" style={inputStyle} required />
          </div>
          <div>
            <label style={labelStyle}>Contraseña</label>
            <input type="password" value={password} onChange={e => setPassword(e.target.value)} placeholder="Mínimo 6 caracteres" style={inputStyle} required />
          </div>
          <div>
            <label style={labelStyle}>Repetir contraseña</label>
            <input type="password" value={password2} onChange={e => setPassword2(e.target.value)} style={inputStyle} required />
          </div>
          <div>
            <label style={labelStyle}>¿Qué idea tienes para el recaudo de fondos?</label>
            <textarea value={ideaRecaudo} onChange={e => setIdeaRecaudo(e.target.value)} rows={3} style={{ ...inputStyle, resize: 'vertical', fontFamily: 'inherit' }} />
          </div>
          <div>
            <label style={labelStyle}>¿Qué idea tienes para una reunión?</label>
            <textarea value={ideaReunion} onChange={e => setIdeaReunion(e.target.value)} rows={3} style={{ ...inputStyle, resize: 'vertical', fontFamily: 'inherit' }} />
          </div>

          {!tieneFoto && (
            <div>
              <label style={labelStyle}>Foto de tu cara</label>
              {fotoPreview ? (
                <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                  <img src={fotoPreview} alt="Tu foto" style={{ width: 64, height: 64, borderRadius: '50%', objectFit: 'cover' }} />
                  <button type="button" onClick={() => { setFotoBlob(null); setFotoPreview(null); abrirCamara() }} style={{ background: 'none', border: '1.5px solid #e2e4f0', borderRadius: 10, padding: '8px 14px', fontSize: 13, color: '#6b7280', cursor: 'pointer' }}>
                    Repetir foto
                  </button>
                </div>
              ) : (
                <button type="button" onClick={abrirCamara} style={{ width: '100%', padding: '13px', background: '#f0f2ff', border: '1.5px dashed #c7d2fe', borderRadius: 10, color: '#0f1787', fontSize: 14, fontWeight: 600, cursor: 'pointer' }}>
                  Tomar foto
                </button>
              )}
            </div>
          )}

          {error && (
            <p style={{ color: '#dc2626', fontSize: 13, margin: 0, background: '#fef2f2', padding: '8px 12px', borderRadius: 8 }}>
              {error}
            </p>
          )}

          <button type="submit" style={botonPrimario(false)}>
            Crear mi cuenta
          </button>
        </form>
      </div>

      {camaraActiva && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.95)', zIndex: 200, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: 20 }}>
          <p style={{ color: 'white', fontSize: 15, fontWeight: 600, marginBottom: 16, textAlign: 'center' }}>
            Tómate una foto de tu cara
          </p>
          <video ref={videoRef} autoPlay playsInline muted style={{ width: '100%', maxWidth: 360, borderRadius: 16, transform: 'scaleX(-1)', marginBottom: 24 }} />
          <canvas ref={canvasRef} style={{ display: 'none' }} />
          <div style={{ display: 'flex', gap: 12, width: '100%', maxWidth: 360 }}>
            <button onClick={detenerCamara} style={{ flex: 1, padding: '14px', background: 'rgba(255,255,255,0.15)', color: 'white', border: 'none', borderRadius: 12, fontSize: 15, cursor: 'pointer', fontWeight: 500 }}>
              Cancelar
            </button>
            <button onClick={tomarFoto} style={{ flex: 2, padding: '14px', background: '#16a34a', color: 'white', border: 'none', borderRadius: 12, fontSize: 15, fontWeight: 700, cursor: 'pointer' }}>
              Tomar foto
            </button>
          </div>
        </div>
      )}
    </div>
  )

  // paso === 'listo'
  return (
    <div style={contenedor}>
      <div style={{ width: '100%', maxWidth: 420, textAlign: 'center' }}>
        <div style={{ width: 64, height: 64, background: '#dcfce7', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 20px' }}>
          <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="#16a34a" strokeWidth={2.5} strokeLinecap="round" strokeLinejoin="round">
            <polyline points="20 6 9 17 4 12" />
          </svg>
        </div>
        <h2 style={{ margin: '0 0 8px', fontSize: 22, color: '#111827', fontWeight: 700 }}>¡Cuenta creada!</h2>
        <p style={{ color: '#6b7280', fontSize: 15, lineHeight: 1.6, marginBottom: 32 }}>
          Bienvenido, <strong>{nombre.split(' ')[0]}</strong>. Ya puedes acceder a tu portal.
        </p>
        <button onClick={() => router.push('/servidor')} style={botonPrimario(false)}>
          Ir a mi portal
        </button>
      </div>
    </div>
  )
}
