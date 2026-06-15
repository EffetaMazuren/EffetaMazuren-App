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
  cancelada: boolean
  motivo_cancelacion: string | null
}

export default function ReunionesLider() {
  const router = useRouter()
  const [reuniones, setReuniones] = useState<Reunion[]>([])
  const [loading, setLoading] = useState(true)
  const [guardando, setGuardando] = useState('')
  const [exito, setExito] = useState('')
  const [error, setError] = useState('')

  // Formulario nueva reunión
  const [nuevaFecha, setNuevaFecha] = useState('')
  const [nuevaNombre, setNuevaNombre] = useState('')
  const [creando, setCreando] = useState(false)
  const [mostrarFormulario, setMostrarFormulario] = useState(false)

  useEffect(() => {
    const verificar = async () => {
      const { data: { session } } = await supabase.auth.getSession()
      if (!session) { router.push('/'); return }

      const { data: usuario } = await supabase
        .from('usuarios')
        .select('rol')
        .eq('id', session.user.id)
        .single()

      if (usuario?.rol !== 'lider') { router.push('/servidor'); return }

      await cargarReuniones()
      setLoading(false)
    }
    verificar()
  }, [router])

  const cargarReuniones = async () => {
    const { data } = await supabase
      .from('reuniones')
      .select('id, nombre, fecha, tipo, cancelada, motivo_cancelacion')
      .eq('retiro_id', RETIRO_ID)
      .order('fecha', { ascending: false })

    setReuniones(data ?? [])
  }

  const toggleCancelar = async (r: Reunion) => {
    setGuardando(r.id)
    setError('')

    const { error: err } = await supabase
      .from('reuniones')
      .update({
        cancelada: !r.cancelada,
        motivo_cancelacion: !r.cancelada ? 'Cancelada por líder' : null
      })
      .eq('id', r.id)

    if (err) {
      setError('Error: ' + err.message)
    } else {
      setExito(!r.cancelada ? '🚫 Reunión cancelada' : '✅ Reunión reactivada')
      await cargarReuniones()
      setTimeout(() => setExito(''), 2500)
    }
    setGuardando('')
  }

  const crearReunion = async () => {
    if (!nuevaFecha) { setError('Selecciona una fecha'); return }
    if (!nuevaNombre.trim()) { setError('Escribe un nombre para la reunión'); return }

    setCreando(true)
    setError('')

    const { error: err } = await supabase
      .from('reuniones')
      .insert({
        retiro_id: RETIRO_ID,
        nombre: nuevaNombre.trim(),
        fecha: nuevaFecha,
        tipo: 'especial',
        cancelada: false
      })

    if (err) {
      setError('Error al crear: ' + err.message)
    } else {
      setExito('✅ Reunión creada')
      setNuevaFecha('')
      setNuevaNombre('')
      setMostrarFormulario(false)
      await cargarReuniones()
      setTimeout(() => setExito(''), 2500)
    }
    setCreando(false)
  }

  const eliminarReunion = async (id: string) => {
    if (!confirm('¿Eliminar esta reunión especial?')) return
    setGuardando(id)

    const { error: err } = await supabase
      .from('reuniones')
      .delete()
      .eq('id', id)
      .eq('tipo', 'especial')

    if (err) {
      setError('Error: ' + err.message)
    } else {
      setExito('🗑️ Reunión eliminada')
      await cargarReuniones()
      setTimeout(() => setExito(''), 2500)
    }
    setGuardando('')
  }

  const hoy = new Date().toISOString().split('T')[0]
  const pasadas = reuniones.filter(r => r.fecha <= hoy)
  const futuras = reuniones.filter(r => r.fecha > hoy)

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
    <div style={{ padding: '24px 16px', maxWidth: 600, margin: '0 auto' }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 24 }}>
        <div>
          <h1 style={{ fontSize: 20, fontWeight: 700, color: '#111827', margin: '0 0 4px' }}>
            📅 Gestión de reuniones
          </h1>
          <p style={{ fontSize: 13, color: '#6b7280', margin: 0 }}>
            {reuniones.length} reuniones · {reuniones.filter(r => r.cancelada).length} canceladas
          </p>
        </div>
        <button
          onClick={() => router.push('/dashboard')}
          style={{
            background: '#f3f4f6', border: 'none', borderRadius: 8,
            padding: '8px 14px', fontSize: 13, cursor: 'pointer', color: '#374151'
          }}
        >← Dashboard</button>
      </div>

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

      {/* Agregar reunión especial */}
      <div style={{
        background: 'white', border: '1.5px solid #e8eaf0',
        borderRadius: 14, padding: '18px 20px', marginBottom: 24
      }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div>
            <div style={{ fontWeight: 600, fontSize: 15, color: '#111827' }}>
              ➕ Agregar día especial
            </div>
            <div style={{ fontSize: 13, color: '#6b7280', marginTop: 2 }}>
              Reunión en fecha que no es martes
            </div>
          </div>
          <button
            onClick={() => setMostrarFormulario(!mostrarFormulario)}
            style={{
              background: mostrarFormulario ? '#f3f4f6' : '#0f1787',
              color: mostrarFormulario ? '#374151' : 'white',
              border: 'none', borderRadius: 8, padding: '8px 16px',
              fontSize: 13, fontWeight: 600, cursor: 'pointer'
            }}
          >{mostrarFormulario ? 'Cancelar' : 'Agregar'}</button>
        </div>

        {mostrarFormulario && (
          <div style={{ marginTop: 16, display: 'flex', flexDirection: 'column', gap: 12 }}>
            <div>
              <label style={{ display: 'block', fontSize: 13, fontWeight: 600, color: '#374151', marginBottom: 6 }}>
                Nombre del evento
              </label>
              <input
                type="text"
                value={nuevaNombre}
                onChange={e => setNuevaNombre(e.target.value)}
                placeholder="Ej: Jornada especial, Convivencia..."
                style={{
                  width: '100%', padding: '10px 14px', borderRadius: 10,
                  border: '1.5px solid #e2e4f0', fontSize: 14,
                  outline: 'none', boxSizing: 'border-box', fontFamily: 'inherit'
                }}
              />
            </div>
            <div>
              <label style={{ display: 'block', fontSize: 13, fontWeight: 600, color: '#374151', marginBottom: 6 }}>
                Fecha
              </label>
              <input
                type="date"
                value={nuevaFecha}
                onChange={e => setNuevaFecha(e.target.value)}
                style={{
                  width: '100%', padding: '10px 14px', borderRadius: 10,
                  border: '1.5px solid #e2e4f0', fontSize: 14,
                  outline: 'none', boxSizing: 'border-box', fontFamily: 'inherit'
                }}
              />
            </div>
            <button
              onClick={crearReunion}
              disabled={creando}
              style={{
                padding: '11px', background: creando ? '#9ca3af' : '#0f1787',
                color: 'white', border: 'none', borderRadius: 10,
                fontSize: 14, fontWeight: 600, cursor: creando ? 'not-allowed' : 'pointer'
              }}
            >{creando ? 'Creando...' : 'Crear reunión'}</button>
          </div>
        )}
      </div>

      {/* Próximas */}
      {futuras.length > 0 && (
        <div style={{ marginBottom: 24 }}>
          <h3 style={{ fontSize: 13, fontWeight: 600, color: '#6b7280', margin: '0 0 10px', textTransform: 'uppercase', letterSpacing: 1 }}>
            Próximas ({futuras.length})
          </h3>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {futuras.slice(0, 8).map(r => (
              <div key={r.id} style={{
                background: 'white', border: '1.5px solid #e8eaf0',
                borderRadius: 12, padding: '12px 16px',
                display: 'flex', alignItems: 'center', gap: 12,
                opacity: r.cancelada ? 0.6 : 1
              }}>
                <div style={{ flex: 1 }}>
                  <div style={{ fontWeight: 600, fontSize: 14, color: '#111827' }}>
                    {r.nombre}
                    {r.tipo === 'especial' && (
                      <span style={{
                        marginLeft: 6, fontSize: 10, background: '#f0f2ff',
                        color: '#0f1787', padding: '2px 6px', borderRadius: 20, fontWeight: 600
                      }}>ESPECIAL</span>
                    )}
                  </div>
                  <div style={{ fontSize: 12, color: '#6b7280', marginTop: 2 }}>
                    {new Date(r.fecha + 'T12:00:00').toLocaleDateString('es-CO', {
                      weekday: 'long', day: 'numeric', month: 'long', year: 'numeric'
                    })}
                  </div>
                </div>
                <div style={{ display: 'flex', gap: 6 }}>
                  <button
                    onClick={() => toggleCancelar(r)}
                    disabled={guardando === r.id}
                    style={{
                      padding: '6px 10px', fontSize: 11, fontWeight: 600,
                      border: 'none', borderRadius: 8, cursor: 'pointer',
                      background: r.cancelada ? '#f0fdf4' : '#fef2f2',
                      color: r.cancelada ? '#16a34a' : '#dc2626'
                    }}
                  >{guardando === r.id ? '...' : r.cancelada ? '✅ Activar' : '🚫 Cancelar'}</button>
                  {r.tipo === 'especial' && (
                    <button
                      onClick={() => eliminarReunion(r.id)}
                      disabled={guardando === r.id}
                      style={{
                        padding: '6px 10px', fontSize: 11, fontWeight: 600,
                        border: 'none', borderRadius: 8, cursor: 'pointer',
                        background: '#f3f4f6', color: '#6b7280'
                      }}
                    >🗑️</button>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Pasadas */}
      <div>
        <h3 style={{ fontSize: 13, fontWeight: 600, color: '#6b7280', margin: '0 0 10px', textTransform: 'uppercase', letterSpacing: 1 }}>
          Pasadas ({pasadas.length})
        </h3>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {pasadas.map(r => (
            <div key={r.id} style={{
              background: 'white', border: '1.5px solid #e8eaf0',
              borderRadius: 12, padding: '12px 16px',
              display: 'flex', alignItems: 'center', gap: 12,
              opacity: r.cancelada ? 0.5 : 1
            }}>
              <div style={{ flex: 1 }}>
                <div style={{ fontWeight: 600, fontSize: 14, color: '#111827' }}>
                  {r.nombre}
                  {r.tipo === 'especial' && (
                    <span style={{
                      marginLeft: 6, fontSize: 10, background: '#f0f2ff',
                      color: '#0f1787', padding: '2px 6px', borderRadius: 20, fontWeight: 600
                    }}>ESPECIAL</span>
                  )}
                  {r.cancelada && (
                    <span style={{
                      marginLeft: 6, fontSize: 10, background: '#fef2f2',
                      color: '#dc2626', padding: '2px 6px', borderRadius: 20, fontWeight: 600
                    }}>CANCELADA</span>
                  )}
                </div>
                <div style={{ fontSize: 12, color: '#6b7280', marginTop: 2 }}>
                  {new Date(r.fecha + 'T12:00:00').toLocaleDateString('es-CO', {
                    weekday: 'short', day: 'numeric', month: 'short', year: 'numeric'
                  })}
                </div>
              </div>
              <button
                onClick={() => toggleCancelar(r)}
                disabled={guardando === r.id}
                style={{
                  padding: '6px 10px', fontSize: 11, fontWeight: 600,
                  border: 'none', borderRadius: 8, cursor: 'pointer',
                  background: r.cancelada ? '#f0fdf4' : '#fef2f2',
                  color: r.cancelada ? '#16a34a' : '#dc2626'
                }}
              >{guardando === r.id ? '...' : r.cancelada ? '✅ Activar' : '🚫 Cancelar'}</button>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
