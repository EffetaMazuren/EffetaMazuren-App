'use client'
import { useState } from 'react'
import { supabase } from '@/lib/supabase'
import { useRouter } from 'next/navigation'

export default function LoginPage() {
  const [correo, setCorreo] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
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
    // Verificar rol
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
          {/* Logo */}
          <div style={{ textAlign: 'center', marginBottom: 28 }}>
            <div style={{
              fontSize: 38,
              fontWeight: 500,
              color: '#0f1787',
              letterSpacing: 3,
              fontFamily: 'Georgia, serif',
              marginBottom: 6,
            }}>
              EFFETÁ
            </div>
            <div style={{
              fontSize: 11,
              color: '#9ca3af',
              letterSpacing: 3,
              textTransform: 'uppercase',
            }}>
              "Abrir el corazón"
            </div>
          </div>

          <div style={{ width: 40, height: 1, background: '#e5e7eb', margin: '0 auto 24px' }} />

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
                width: '100%', height: 42, background: loading ? '#9ca3af' : '#0f1787',
                color: '#fff', border: 'none', borderRadius: 8, fontSize: 14,
                fontWeight: 500, cursor: loading ? 'not-allowed' : 'pointer',
                marginTop: 8,
              }}
            >
              {loading ? 'Ingresando...' : 'Ingresar'}
            </button>
          </form>

          <div style={{ textAlign: 'center', marginTop: 16, fontSize: 12, color: '#9ca3af' }}>
            <a href="#" style={{ color: '#0f1787', textDecoration: 'none' }}>
              ¿Olvidaste tu contraseña?
            </a>
          </div>
        </div>

        <div style={{ textAlign: 'center', marginTop: 16, paddingTop: 16, borderTop: '1px solid #f0f0f4' }}>
  <p style={{ margin: '0 0 8px', fontSize: 13, color: '#6b7280' }}>
    ¿Eres servidor y no tienes cuenta?
  </p>
  <button
    onClick={() => router.push('/servidor/registro')}
    style={{
      background: 'none', border: '1.5px solid #0f1787',
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
