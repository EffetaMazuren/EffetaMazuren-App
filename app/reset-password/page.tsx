'use client'
import { useState, useEffect } from 'react'
import { supabase } from '@/lib/supabase'
import { useRouter } from 'next/navigation'

export default function ResetPasswordPage() {
  const [password, setPassword] = useState('')
  const [confirmar, setConfirmar] = useState('')
  const [error, setError] = useState('')
  const [mensaje, setMensaje] = useState('')
  const [loading, setLoading] = useState(false)
  const [sesionLista, setSesionLista] = useState(false)
  const router = useRouter()

  useEffect(() => {
    // Supabase maneja el token de recuperación automáticamente desde la URL
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event) => {
      if (event === 'PASSWORD_RECOVERY') {
        setSesionLista(true)
      }
    })
    return () => subscription.unsubscribe()
  }, [])

  async function handleReset(e: React.FormEvent) {
    e.preventDefault()
    setError('')

    if (password.length < 6) {
      setError('La contraseña debe tener al menos 6 caracteres.')
      return
    }

    if (password !== confirmar) {
      setError('Las contraseñas no coinciden.')
      return
    }

    setLoading(true)

    const { error } = await supabase.auth.updateUser({ password })

    if (error) {
      setError('No se pudo actualizar la contraseña. Intenta de nuevo.')
    } else {
      setMensaje('¡Contraseña actualizada! Redirigiendo...')
      setTimeout(() => router.push('/'), 2000)
    }

    setLoading(false)
  }

  return (
    <div style={{
      minHeight: '100vh',
      background: '#0f1787',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      padding: '32px 16px',
    }}>
      <div style={{ width: '100%', maxWidth: 380 }}>
        <div style={{
          background: '#fff',
          borderRadius: 16,
          padding: '40px 36px',
        }}>
          <div style={{ textAlign: 'center', marginBottom: 28 }}>
            <div style={{
              fontSize: 38, fontWeight: 500, color: '#0f1787',
              letterSpacing: 3, fontFamily: 'Georgia, serif', marginBottom: 6,
            }}>
              EFFETÁ
            </div>
            <div style={{
              fontSize: 11, color: '#9ca3af',
              letterSpacing: 3, textTransform: 'uppercase',
            }}>
              "Abrir el corazón"
            </div>
          </div>

          <div style={{ width: 40, height: 1, background: '#e5e7eb', margin: '0 auto 24px' }} />

          {!sesionLista ? (
            <div style={{ textAlign: 'center' }}>
              <div style={{ fontSize: 14, color: '#6b7280', marginBottom: 16 }}>
                Verificando enlace de recuperación...
              </div>
              <div style={{ fontSize: 13, color: '#9ca3af' }}>
                Si este enlace expiró, solicita uno nuevo desde la página de inicio.
              </div>
              <button
                onClick={() => router.push('/')}
                style={{
                  marginTop: 20, background: 'none', border: 'none',
                  color: '#0f1787', fontSize: 13, cursor: 'pointer', padding: 0,
                }}
              >
                ← Volver al inicio
              </button>
            </div>
          ) : (
            <>
              <div style={{ fontSize: 15, fontWeight: 600, color: '#0f1787', marginBottom: 6 }}>
                Nueva contraseña
              </div>
              <div style={{ fontSize: 13, color: '#6b7280', marginBottom: 20 }}>
                Elige una contraseña nueva para tu cuenta.
              </div>

              <form onSubmit={handleReset}>
                <div style={{ marginBottom: 16 }}>
                  <div style={{ fontSize: 12, color: '#6b7280', marginBottom: 6 }}>
                    Nueva contraseña
                  </div>
                  <input
                    type="password"
                    value={password}
                    onChange={e => setPassword(e.target.value)}
                    placeholder="Mínimo 6 caracteres"
                    required
                    style={{
                      width: '100%', height: 40, border: '0.5px solid #d0d4e8',
                      borderRadius: 8, padding: '0 12px', fontSize: 14,
                      color: '#0d0d14', background: '#f8f9fd', outline: 'none',
                      boxSizing: 'border-box'
                    }}
                  />
                </div>

                <div style={{ marginBottom: 16 }}>
                  <div style={{ fontSize: 12, color: '#6b7280', marginBottom: 6 }}>
                    Confirmar contraseña
                  </div>
                  <input
                    type="password"
                    value={confirmar}
                    onChange={e => setConfirmar(e.target.value)}
                    placeholder="Repite la contraseña"
                    required
                    style={{
                      width: '100%', height: 40, border: '0.5px solid #d0d4e8',
                      borderRadius: 8, padding: '0 12px', fontSize: 14,
                      color: '#0d0d14', background: '#f8f9fd', outline: 'none',
                      boxSizing: 'border-box'
                    }}
                  />
                </div>

                {error && (
                  <div style={{
                    background: '#fee2e2', color: '#991b1b', borderRadius: 8,
                    padding: '10px 14px', fontSize: 13, marginBottom: 12,
                  }}>
                    {error}
                  </div>
                )}

                {mensaje && (
                  <div style={{
                    background: '#dcfce7', color: '#166534', borderRadius: 8,
                    padding: '10px 14px', fontSize: 13, marginBottom: 12,
                  }}>
                    {mensaje}
                  </div>
                )}

                <button
                  type="submit"
                  disabled={loading}
                  style={{
                    width: '100%', height: 42,
                    background: loading ? '#9ca3af' : '#0f1787',
                    color: '#fff', border: 'none', borderRadius: 8,
                    fontSize: 14, fontWeight: 500,
                    cursor: loading ? 'not-allowed' : 'pointer',
                    marginTop: 8,
                  }}
                >
                  {loading ? 'Guardando...' : 'Guardar contraseña'}
                </button>
              </form>
            </>
          )}
        </div>

        <div style={{
          textAlign: 'center', marginTop: 20, fontSize: 11,
          color: 'rgba(255,255,255,0.3)', letterSpacing: 1,
        }}>
          MAZUREN · Plataforma interna
        </div>
      </div>
    </div>
  )
}
