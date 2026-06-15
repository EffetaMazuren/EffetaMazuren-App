'use client'
import { useState } from 'react'
import { supabase } from '@/lib/supabase'
import { useRouter } from 'next/navigation'

export default function LoginPage() {
  const [correo, setCorreo] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const [modoRecuperar, setModoRecuperar] = useState(false)
  const [correoRecuperar, setCorreoRecuperar] = useState('')
  const [mensajeRecuperar, setMensajeRecuperar] = useState('')
  const [loadingRecuperar, setLoadingRecuperar] = useState(false)
  const router = useRouter()

  async function handleLogin(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)
    setError('')

    const { data, error } = await supabase.auth.signInWithPassword({
      email: correo,
      password,
    })

    if (error) {
      setError('Correo o contraseña incorrectos')
      setLoading(false)
      return
    }

    const { data: usuario } = await supabase
      .from('usuarios')
      .select('rol')
      .eq('id', data.user.id)
      .single()

    if (usuario?.rol === 'lider') {
      router.push('/dashboard')
    } else {
      router.push('/servidor')
    }
  }

  async function handleRecuperar(e: React.FormEvent) {
    e.preventDefault()
    setLoadingRecuperar(true)
    setMensajeRecuperar('')
    setError('')

    const { error } = await supabase.auth.resetPasswordForEmail(correoRecuperar, {
      redirectTo: 'https://effeta-mazuren-app.vercel.app/reset-password',
    })

    if (error) {
      setError('No se pudo enviar el correo. Verifica la dirección.')
    } else {
      setMensajeRecuperar('Te enviamos un enlace de recuperación. Revisa tu correo.')
    }

    setLoadingRecuperar(false)
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

          {!modoRecuperar ? (
            <>
              <form onSubmit={handleLogin}>
                <div style={{ marginBottom: 16 }}>
                  <div style={{ fontSize: 12, color: '#6b7280', marginBottom: 6 }}>
                    Correo electrónico
                  </div>
                  <input
                    type="email"
                    value={correo}
                    onChange={e => setCorreo(e.target.value)}
                    placeholder="tucorreo@email.com"
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
                    Contraseña
                  </div>
                  <input
                    type="password"
                    value={password}
                    onChange={e => setPassword(e.target.value)}
                    placeholder="••••••••"
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
                  {loading ? 'Ingresando...' : 'Ingresar'}
                </button>
              </form>

              <div style={{ textAlign: 'center', marginTop: 16, fontSize: 12, color: '#9ca3af' }}>
                <button
                  onClick={() => { setModoRecuperar(true); setError(''); }}
                  style={{
                    background: 'none', border: 'none', color: '#0f1787',
                    fontSize: 12, cursor: 'pointer', padding: 0,
                  }}
                >
                  ¿Olvidaste tu contraseña?
                </button>
              </div>
            </>
          ) : (
            <>
              <div style={{ fontSize: 15, fontWeight: 600, color: '#0f1787', marginBottom: 6 }}>
                Recuperar contraseña
              </div>
              <div style={{ fontSize: 13, color: '#6b7280', marginBottom: 20 }}>
                Ingresa tu correo y te enviaremos un enlace para restablecerla.
              </div>

              <form onSubmit={handleRecuperar}>
                <div style={{ marginBottom: 16 }}>
                  <div style={{ fontSize: 12, color: '#6b7280', marginBottom: 6 }}>
                    Correo electrónico
                  </div>
                  <input
                    type="email"
                    value={correoRecuperar}
                    onChange={e => setCorreoRecuperar(e.target.value)}
                    placeholder="tucorreo@email.com"
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

                {mensajeRecuperar && (
                  <div style={{
                    background: '#dcfce7', color: '#166534', borderRadius: 8,
                    padding: '10px 14px', fontSize: 13, marginBottom: 12,
                  }}>
                    {mensajeRecuperar}
                  </div>
                )}

                <button
                  type="submit"
                  disabled={loadingRecuperar}
                  style={{
                    width: '100%', height: 42,
                    background: loadingRecuperar ? '#9ca3af' : '#0f1787',
                    color: '#fff', border: 'none', borderRadius: 8,
                    fontSize: 14, fontWeight: 500,
                    cursor: loadingRecuperar ? 'not-allowed' : 'pointer',
                    marginTop: 8,
                  }}
                >
                  {loadingRecuperar ? 'Enviando...' : 'Enviar enlace'}
                </button>
              </form>

              <div style={{ textAlign: 'center', marginTop: 16 }}>
                <button
                  onClick={() => { setModoRecuperar(false); setMensajeRecuperar(''); setError(''); }}
                  style={{
                    background: 'none', border: 'none', color: '#6b7280',
                    fontSize: 12, cursor: 'pointer', padding: 0,
                  }}
                >
                  ← Volver al inicio de sesión
                </button>
              </div>
            </>
          )}
        </div>

        <div style={{
          textAlign: 'center', marginTop: 16, paddingTop: 16,
          borderTop: '1px solid rgba(255,255,255,0.1)'
        }}>
          <p style={{ margin: '0 0 8px', fontSize: 13, color: 'rgba(255,255,255,0.6)' }}>
            ¿Eres servidor y no tienes cuenta?
          </p>
          <button
            onClick={() => router.push('/servidor/registro')}
            style={{
              background: 'white', border: '1.5px solid white',
              color: '#0f1787', padding: '8px 20px', borderRadius: 8,
              fontSize: 13, fontWeight: 600, cursor: 'pointer', width: '100%'
            }}
          >
            Crear cuenta de servidor
          </button>
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
