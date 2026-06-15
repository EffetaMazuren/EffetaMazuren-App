'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'

type Paso = 'buscar' | 'confirmar' | 'crear' | 'listo'

interface ServidorEncontrado {
  id: string
  nombre_completo: string
  es_interno: boolean
  usuario_id: string | null
}

export default function RegistroServidor() {
  const router = useRouter()
  const [paso, setPaso] = useState<Paso>('buscar')
  const [busqueda, setBusqueda] = useState('')
  const [resultados, setResultados] = useState<ServidorEncontrado[]>([])
  const [seleccionado, setSeleccionado] = useState<ServidorEncontrado | null>(null)
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [password2, setPassword2] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  const buscarServidor = async () => {
    if (busqueda.trim().length < 3) {
      setError('Escribe al menos 3 letras de tu nombre')
      return
    }
    setLoading(true)
    setError('')

    const { data, error: err } = await supabase
      .from('servidores_inscripcion')
      .select('id, nombre_completo, es_interno, usuario_id')
      .eq('retiro_id', '21da7588-f7d9-4bf8-a6f6-ae6c8258c00e')
      .ilike('nombre_completo', `%${busqueda.trim()}%`)

    setLoading(false)

    if (err || !data?.length) {
      setError('No encontramos ese nombre. Verifica con tu líder que estés inscrito.')
      setResultados([])
      return
    }

    setResultados(data)
    setPaso('confirmar')
  }

  const seleccionarServidor = (s: ServidorEncontrado) => {
    if (s.usuario_id) {
      setError('Este perfil ya tiene cuenta creada. Inicia sesión en la pantalla principal.')
      return
    }
    setSeleccionado(s)
    setPaso('crear')
    setError('')
  }

  const crearCuenta = async () => {
    if (!email.trim() || !password) {
      setError('Completa todos los campos')
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
    if (!seleccionado) return

    setLoading(true)
    setError('')

    // 1. Crear usuario en Supabase Auth
    const { data: authData, error: authErr } = await supabase.auth.signUp({
      email: email.trim().toLowerCase(),
      password,
      options: {
        data: { nombre_completo: seleccionado.nombre_completo }
      }
    })

    if (authErr || !authData.user) {
      setError(authErr?.message === 'User already registered'
        ? 'Este correo ya tiene cuenta. Inicia sesión normal.'
        : (authErr?.message || 'Error al crear cuenta'))
      setLoading(false)
      return
    }

    const userId = authData.user.id

    // 2. Crear registro en usuarios
    const { error: usuErr } = await supabase
      .from('usuarios')
      .upsert({
        id: userId,
        email: email.trim().toLowerCase(),
        nombre_completo: seleccionado.nombre_completo,
        rol_global: 'servidor'
      })

    if (usuErr) {
      setError('Error al guardar perfil: ' + usuErr.message)
      setLoading(false)
      return
    }

    // 3. Vincular servidores_inscripcion con usuario_id
    const { error: vinErr } = await supabase
      .from('servidores_inscripcion')
      .update({ usuario_id: userId })
      .eq('id', seleccionado.id)

    if (vinErr) {
      setError('Error al vincular perfil: ' + vinErr.message)
      setLoading(false)
      return
    }

    setLoading(false)
    setPaso('listo')
  }

  // Pantalla: buscar nombre
  if (paso === 'buscar') return (
    <div style={{
      minHeight: '100vh', background: '#f7f8fc',
      display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20
    }}>
      <div style={{ width: '100%', maxWidth: 420 }}>
        {/* Logo */}
        <div style={{ textAlign: 'center', marginBottom: 40 }}>
          <div style={{
            fontFamily: 'Georgia, serif', fontSize: 32, fontWeight: 700,
            color: '#0f1787', letterSpacing: 4, marginBottom: 8
          }}>EFFETÁ</div>
          <p style={{ color: '#6b7280', fontSize: 15 }}>Crear cuenta de servidor</p>
        </div>

        <div style={{
          background: 'white', borderRadius: 16,
          padding: 28, boxShadow: '0 2px 16px rgba(0,0,0,0.06)'
        }}>
          <h2 style={{ margin: '0 0 8px', fontSize: 18, color: '#111827', fontWeight: 600 }}>
            ¿Cuál es tu nombre?
          </h2>
          <p style={{ margin: '0 0 24px', fontSize: 14, color: '#6b7280', lineHeight: 1.5 }}>
            Escribe tu nombre como aparece en la lista de servidores del retiro.
          </p>

          <input
            type="text"
            value={busqueda}
            onChange={e => { setBusqueda(e.target.value); setError('') }}
            onKeyDown={e => e.key === 'Enter' && buscarServidor()}
            placeholder="Ej: María González"
            style={{
              width: '100%', padding: '12px 14px', borderRadius: 10,
              border: '1.5px solid #e2e4f0', fontSize: 16,
              outline: 'none', marginBottom: 8, boxSizing: 'border-box',
              fontFamily: 'inherit', color: '#111827'
            }}
            autoFocus
          />

          {error && (
            <p style={{
              color: '#dc2626', fontSize: 13, margin: '0 0 12px',
              background: '#fef2f2', padding: '8px 12px', borderRadius: 8
            }}>{error}</p>
          )}

          <button
            onClick={buscarServidor}
            disabled={loading}
            style={{
              width: '100%', padding: '13px', background: loading ? '#9ca3af' : '#0f1787',
              color: 'white', border: 'none', borderRadius: 10,
              fontSize: 15, fontWeight: 600, cursor: loading ? 'not-allowed' : 'pointer',
              transition: 'background 0.2s'
            }}
          >{loading ? 'Buscando...' : 'Buscar mi nombre'}</button>
        </div>

        <p style={{ textAlign: 'center', marginTop: 24, fontSize: 14, color: '#6b7280' }}>
          ¿Ya tienes cuenta?{' '}
          <button
            onClick={() => router.push('/')}
            style={{
              background: 'none', border: 'none', color: '#0f1787',
              fontWeight: 600, cursor: 'pointer', fontSize: 14
            }}
          >Inicia sesión</button>
        </p>
      </div>
    </div>
  )

  // Pantalla: confirmar quién eres
  if (paso === 'confirmar') return (
    <div style={{
      minHeight: '100vh', background: '#f7f8fc',
      display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20
    }}>
      <div style={{ width: '100%', maxWidth: 420 }}>
        <div style={{ textAlign: 'center', marginBottom: 32 }}>
          <div style={{
            fontFamily: 'Georgia, serif', fontSize: 28, fontWeight: 700,
            color: '#0f1787', letterSpacing: 4, marginBottom: 6
          }}>EFFETÁ</div>
          <p style={{ color: '#6b7280', fontSize: 14 }}>Selecciona tu nombre</p>
        </div>

        <div style={{
          background: 'white', borderRadius: 16,
          padding: 24, boxShadow: '0 2px 16px rgba(0,0,0,0.06)'
        }}>
          <p style={{ margin: '0 0 16px', fontSize: 14, color: '#374151', fontWeight: 500 }}>
            Encontramos {resultados.length} resultado{resultados.length > 1 ? 's' : ''}:
          </p>

          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            {resultados.map(s => (
              <button
                key={s.id}
                onClick={() => seleccionarServidor(s)}
                style={{
                  padding: '14px 16px', border: '1.5px solid #e2e4f0',
                  borderRadius: 12, background: 'white', cursor: 'pointer',
                  textAlign: 'left', transition: 'all 0.15s'
                }}
                onMouseEnter={e => (e.currentTarget.style.borderColor = '#0f1787')}
                onMouseLeave={e => (e.currentTarget.style.borderColor = '#e2e4f0')}
              >
                <div style={{ fontWeight: 600, color: '#111827', fontSize: 15 }}>
                  {s.nombre_completo}
                </div>
                <div style={{ fontSize: 12, color: '#6b7280', marginTop: 3 }}>
                  {s.es_interno ? 'Servidor interno' : 'Servidor externo'}
                  {s.usuario_id && ' · Cuenta ya creada'}
                </div>
              </button>
            ))}
          </div>

          {error && (
            <p style={{
              color: '#dc2626', fontSize: 13, margin: '16px 0 0',
              background: '#fef2f2', padding: '8px 12px', borderRadius: 8
            }}>{error}</p>
          )}

          <button
            onClick={() => { setPaso('buscar'); setResultados([]); setError('') }}
            style={{
              marginTop: 16, width: '100%', padding: '11px',
              background: 'none', border: '1.5px solid #e2e4f0',
              borderRadius: 10, color: '#6b7280', fontSize: 14,
              cursor: 'pointer', fontWeight: 500
            }}
          >← Volver a buscar</button>
        </div>
      </div>
    </div>
  )

  // Pantalla: crear credenciales
  if (paso === 'crear') return (
    <div style={{
      minHeight: '100vh', background: '#f7f8fc',
      display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20
    }}>
      <div style={{ width: '100%', maxWidth: 420 }}>
        <div style={{ textAlign: 'center', marginBottom: 32 }}>
          <div style={{
            fontFamily: 'Georgia, serif', fontSize: 28, fontWeight: 700,
            color: '#0f1787', letterSpacing: 4, marginBottom: 6
          }}>EFFETÁ</div>
        </div>

        <div style={{
          background: 'white', borderRadius: 16,
          padding: 28, boxShadow: '0 2px 16px rgba(0,0,0,0.06)'
        }}>
          {/* Bienvenida */}
          <div style={{
            background: '#f0f2ff', borderRadius: 10, padding: '12px 16px', marginBottom: 24
          }}>
            <p style={{ margin: 0, fontSize: 13, color: '#4b5563' }}>Creando cuenta para</p>
            <p style={{ margin: '2px 0 0', fontWeight: 700, color: '#0f1787', fontSize: 16 }}>
              {seleccionado?.nombre_completo}
            </p>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
            <div>
              <label style={{ display: 'block', fontSize: 13, fontWeight: 600, color: '#374151', marginBottom: 6 }}>
                Correo electrónico
              </label>
              <input
                type="email"
                value={email}
                onChange={e => { setEmail(e.target.value); setError('') }}
                placeholder="tu@correo.com"
                style={{
                  width: '100%', padding: '11px 14px', borderRadius: 10,
                  border: '1.5px solid #e2e4f0', fontSize: 15,
                  outline: 'none', boxSizing: 'border-box', fontFamily: 'inherit'
                }}
              />
            </div>

            <div>
              <label style={{ display: 'block', fontSize: 13, fontWeight: 600, color: '#374151', marginBottom: 6 }}>
                Contraseña
              </label>
              <input
                type="password"
                value={password}
                onChange={e => { setPassword(e.target.value); setError('') }}
                placeholder="Mínimo 6 caracteres"
                style={{
                  width: '100%', padding: '11px 14px', borderRadius: 10,
                  border: '1.5px solid #e2e4f0', fontSize: 15,
                  outline: 'none', boxSizing: 'border-box', fontFamily: 'inherit'
                }}
              />
            </div>

            <div>
              <label style={{ display: 'block', fontSize: 13, fontWeight: 600, color: '#374151', marginBottom: 6 }}>
                Repetir contraseña
              </label>
              <input
                type="password"
                value={password2}
                onChange={e => { setPassword2(e.target.value); setError('') }}
                placeholder="Repite la contraseña"
                style={{
                  width: '100%', padding: '11px 14px', borderRadius: 10,
                  border: '1.5px solid #e2e4f0', fontSize: 15,
                  outline: 'none', boxSizing: 'border-box', fontFamily: 'inherit'
                }}
              />
            </div>
          </div>

          {error && (
            <p style={{
              color: '#dc2626', fontSize: 13, margin: '12px 0 0',
              background: '#fef2f2', padding: '8px 12px', borderRadius: 8
            }}>{error}</p>
          )}

          <button
            onClick={crearCuenta}
            disabled={loading}
            style={{
              marginTop: 20, width: '100%', padding: '13px',
              background: loading ? '#9ca3af' : '#0f1787',
              color: 'white', border: 'none', borderRadius: 10,
              fontSize: 15, fontWeight: 600,
              cursor: loading ? 'not-allowed' : 'pointer'
            }}
          >{loading ? 'Creando cuenta...' : 'Crear mi cuenta'}</button>

          <button
            onClick={() => { setPaso('confirmar'); setError('') }}
            style={{
              marginTop: 10, width: '100%', padding: '11px',
              background: 'none', border: '1.5px solid #e2e4f0',
              borderRadius: 10, color: '#6b7280', fontSize: 14,
              cursor: 'pointer'
            }}
          >← Elegir otro nombre</button>
        </div>
      </div>
    </div>
  )

  // Pantalla: listo
  return (
    <div style={{
      minHeight: '100vh', background: '#f7f8fc',
      display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20
    }}>
      <div style={{ width: '100%', maxWidth: 420, textAlign: 'center' }}>
        <div style={{ fontSize: 64, marginBottom: 20 }}>🎉</div>
        <h2 style={{ margin: '0 0 8px', fontSize: 22, color: '#111827', fontWeight: 700 }}>
          ¡Cuenta creada!
        </h2>
        <p style={{ color: '#6b7280', fontSize: 15, lineHeight: 1.6, marginBottom: 32 }}>
          Bienvenido, <strong>{seleccionado?.nombre_completo.split(' ')[0]}</strong>.
          Ya puedes acceder a tu portal de servidor.
        </p>
        <p style={{
          background: '#fef9c3', borderRadius: 10, padding: '12px 16px',
          fontSize: 13, color: '#92400e', marginBottom: 28, lineHeight: 1.5
        }}>
          📧 Revisa tu correo y confirma tu cuenta antes de iniciar sesión.
        </p>
        <button
          onClick={() => router.push('/')}
          style={{
            width: '100%', padding: '13px',
            background: '#0f1787', color: 'white',
            border: 'none', borderRadius: 10, fontSize: 15,
            fontWeight: 600, cursor: 'pointer'
          }}
        >Ir al inicio de sesión</button>
      </div>
    </div>
  )
}
