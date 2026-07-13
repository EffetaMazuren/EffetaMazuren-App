'use client'

import { useEffect, useState } from 'react'
import { useRouter, useParams } from 'next/navigation'
import { supabase } from '@/lib/supabase'

const RETIRO_ID = '21da7588-f7d9-4bf8-a6f6-ae6c8258c00e'

interface Persona {
  id: string
  nombre_completo: string
  numero_documento_normalizado: string | null
  created_at: string
}

interface ParticipacionCaminante {
  id: string
  retiro_id: string
  retiro_nombre: string
  retiro_fecha_inicio: string
  inscrito_oficialmente: boolean
  fecha_inscripcion: string | null
}

interface ParticipacionServidor {
  id: string
  retiro_id: string
  retiro_nombre: string
  retiro_fecha_inicio: string
  es_interno: boolean
  inscrito_oficialmente: boolean
}

interface CaminanteSinVincular {
  id: string
  nombre: string
  celular: string | null
}

interface ServidorSinVincular {
  id: string
  nombre: string
  es_interno: boolean
}

export default function FichaIdentidadPage() {
  const router = useRouter()
  const { id } = useParams()

  const [persona, setPersona] = useState<Persona | null>(null)
  const [caminante, setCaminante] = useState<ParticipacionCaminante[]>([])
  const [servidor, setServidor] = useState<ParticipacionServidor[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  // Vinculación
  const [mostrarVinculacion, setMostrarVinculacion] = useState(false)
  const [tabVinculacion, setTabVinculacion] = useState<'caminante' | 'servidor'>('caminante')
  const [busquedaVinculacion, setBusquedaVinculacion] = useState('')
  const [poolCargado, setPoolCargado] = useState(false)
  const [cargandoPool, setCargandoPool] = useState(false)
  const [caminantesSinVincular, setCaminantesSinVincular] = useState<CaminanteSinVincular[]>([])
  const [servidoresSinVincular, setServidoresSinVincular] = useState<ServidorSinVincular[]>([])
  const [vinculando, setVinculando] = useState('')
  const [errorVinculacion, setErrorVinculacion] = useState('')

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

      await cargarFicha()
    }
    verificar()
  }, [id])

  async function cargarFicha() {
    setLoading(true)
    setError('')
    try {
      const { data: personaData, error: errorPersona } = await supabase
        .from('personas')
        .select('id, nombre_completo, numero_documento_normalizado, created_at')
        .eq('id', id)
        .single()

      if (errorPersona) throw errorPersona
      setPersona(personaData)

      const { data: caminantesData } = await supabase
        .from('caminantes')
        .select('id, retiro_id, inscrito_oficialmente, fecha_inscripcion, retiros:retiro_id(nombre, fecha_inicio)')
        .eq('id_persona', id)

      const listaCaminante: ParticipacionCaminante[] = (caminantesData ?? []).map((c: any) => ({
        id: c.id,
        retiro_id: c.retiro_id,
        retiro_nombre: c.retiros?.nombre ?? 'Retiro sin nombre',
        retiro_fecha_inicio: c.retiros?.fecha_inicio ?? '',
        inscrito_oficialmente: c.inscrito_oficialmente,
        fecha_inscripcion: c.fecha_inscripcion,
      }))
      setCaminante(listaCaminante)

      const { data: servidoresData } = await supabase
        .from('servidores_inscripcion')
        .select('id, retiro_id, es_interno, inscrito_oficialmente, retiros:retiro_id(nombre, fecha_inicio)')
        .eq('id_persona', id)

      const listaServidor: ParticipacionServidor[] = (servidoresData ?? []).map((s: any) => ({
        id: s.id,
        retiro_id: s.retiro_id,
        retiro_nombre: s.retiros?.nombre ?? 'Retiro sin nombre',
        retiro_fecha_inicio: s.retiros?.fecha_inicio ?? '',
        es_interno: s.es_interno,
        inscrito_oficialmente: s.inscrito_oficialmente,
      }))
      setServidor(listaServidor)
    } catch (err) {
      console.error('Error cargando ficha de persona:', err)
      setError('No se pudo cargar esta persona.')
    } finally {
      setLoading(false)
    }
  }

  async function cargarPoolSinVincular() {
    setCargandoPool(true)
    setErrorVinculacion('')
    try {
      const [{ data: caminantesPool, error: errC }, { data: servidoresPool, error: errS }] = await Promise.all([
        supabase.from('caminantes').select('id, nombre, celular').eq('retiro_id', RETIRO_ID).is('id_persona', null),
        supabase.from('servidores_inscripcion').select('id, nombre, es_interno').eq('retiro_id', RETIRO_ID).is('id_persona', null),
      ])
      if (errC) throw errC
      if (errS) throw errS
      setCaminantesSinVincular(caminantesPool ?? [])
      setServidoresSinVincular(servidoresPool ?? [])
      setPoolCargado(true)
    } catch (err) {
      console.error('Error cargando personas sin vincular:', err)
      setErrorVinculacion('No se pudo cargar la lista de caminantes/servidores sin vincular.')
    } finally {
      setCargandoPool(false)
    }
  }

  function abrirVinculacion() {
    setMostrarVinculacion(true)
    if (!poolCargado) cargarPoolSinVincular()
  }

  // Protección real de este UPDATE (auditado manualmente en Supabase el 2026-07-12):
  // servidores_inscripcion ya tenía una política UPDATE existente para el rol
  // `authenticated` antes de este cambio — no depende de nada agregado en la
  // migración 20260713000000. caminantes tiene RLS deshabilitado en toda la
  // tabla, así que hoy este UPDATE no tiene ninguna protección de base de datos
  // real para esa tabla — pendiente como tarea aparte (auditar y habilitar RLS
  // en caminantes), no resuelta por esta función ni por ninguna migración actual.
  async function vincular(tipo: 'caminante' | 'servidor', item: { id: string; nombre: string }) {
    if (!persona) return
    if (!confirm(`¿Vincular a "${item.nombre}" con la persona "${persona.nombre_completo}"?`)) return

    setVinculando(item.id)
    setErrorVinculacion('')
    try {
      const tabla = tipo === 'caminante' ? 'caminantes' : 'servidores_inscripcion'
      const { error: errorUpdate } = await supabase
        .from(tabla)
        .update({ id_persona: id })
        .eq('id', item.id)

      if (errorUpdate) throw errorUpdate

      if (tipo === 'caminante') {
        setCaminantesSinVincular(prev => prev.filter(c => c.id !== item.id))
      } else {
        setServidoresSinVincular(prev => prev.filter(s => s.id !== item.id))
      }

      await cargarFicha()
    } catch (err: any) {
      console.error('Error vinculando:', err)
      setErrorVinculacion(err?.message || 'No se pudo vincular. Intenta de nuevo.')
    } finally {
      setVinculando('')
    }
  }

  function anio(fecha: string) {
    return fecha ? new Date(fecha).getFullYear() : '—'
  }

  const terminoVinculacion = busquedaVinculacion.trim().toLowerCase()
  const caminantesFiltrados = caminantesSinVincular
    .filter(c => !terminoVinculacion || c.nombre.toLowerCase().includes(terminoVinculacion))
    .slice(0, 10)
  const servidoresFiltrados = servidoresSinVincular
    .filter(s => !terminoVinculacion || s.nombre.toLowerCase().includes(terminoVinculacion))
    .slice(0, 10)

  if (loading) {
    return (
      <div style={{ minHeight: '100vh', background: '#f7f8fc', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <p style={{ fontSize: 14, color: '#9ca3af' }}>Cargando…</p>
      </div>
    )
  }

  if (error || !persona) {
    return (
      <div style={{ minHeight: '100vh', background: '#f7f8fc', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '0 20px' }}>
        <div style={{ textAlign: 'center' }}>
          <p style={{ fontSize: 14, color: '#dc2626', marginBottom: 12 }}>{error || 'Persona no encontrada.'}</p>
          <button onClick={() => router.push('/dashboard/identidades')} style={{ fontSize: 14, color: '#0f1787', fontWeight: 500, background: 'none', border: 'none', cursor: 'pointer' }}>
            ← Volver a Identidades
          </button>
        </div>
      </div>
    )
  }

  return (
    <div style={{ minHeight: '100vh', background: '#f7f8fc', paddingBottom: 96 }}>
      <header style={{ background: '#fff', borderBottom: '0.5px solid #e5e7eb', padding: '16px 20px', position: 'sticky', top: 0, zIndex: 10, display: 'flex', alignItems: 'center', gap: 12 }}>
        <button onClick={() => router.push('/dashboard/identidades')} style={{ background: 'none', border: 'none', color: '#9ca3af', cursor: 'pointer', display: 'flex' }}>
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <polyline points="15 18 9 12 15 6" />
          </svg>
        </button>
        <span style={{ fontSize: 12, fontWeight: 600, letterSpacing: 2, color: '#0f1787', textTransform: 'uppercase' }}>
          Ficha de persona
        </span>
      </header>

      <main style={{ padding: '24px 20px 0', maxWidth: 640, margin: '0 auto' }}>
        <div style={{ background: '#fff', borderRadius: 16, padding: 20, border: '0.5px solid #e5e7eb', marginBottom: 16 }}>
          <h1 style={{ fontSize: 20, fontWeight: 600, color: '#0d0d14', margin: 0 }}>{persona.nombre_completo}</h1>
          <p style={{ fontSize: 14, color: '#9ca3af', margin: '4px 0 0' }}>
            {persona.numero_documento_normalizado || 'Sin documento registrado'}
          </p>
          <p style={{ fontSize: 12, color: '#d1d5db', margin: '8px 0 0' }}>
            En el índice desde {new Date(persona.created_at).toLocaleDateString('es-CO', { day: 'numeric', month: 'long', year: 'numeric' })}
          </p>
        </div>

        {/* Panel de vinculación */}
        <div style={{ background: '#fff', borderRadius: 16, border: '0.5px solid #e5e7eb', marginBottom: 16, overflow: 'hidden' }}>
          <button
            onClick={() => (mostrarVinculacion ? setMostrarVinculacion(false) : abrirVinculacion())}
            style={{ width: '100%', textAlign: 'left', padding: '14px 20px', background: 'none', border: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}
          >
            <span style={{ fontSize: 14, fontWeight: 500, color: '#0f1787' }}>+ Vincular caminante o servidor</span>
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#9ca3af" strokeWidth="2" strokeLinecap="round" style={{ transform: mostrarVinculacion ? 'rotate(180deg)' : 'none', transition: 'transform 0.2s' }}>
              <polyline points="6 9 12 15 18 9" />
            </svg>
          </button>

          {mostrarVinculacion && (
            <div style={{ borderTop: '0.5px solid #f3f4f6', padding: '16px 20px' }}>
              <div style={{ display: 'flex', gap: 8, marginBottom: 12 }}>
                <button
                  onClick={() => setTabVinculacion('caminante')}
                  style={{
                    flex: 1, padding: '8px 0', borderRadius: 10, fontSize: 13, fontWeight: 500, cursor: 'pointer',
                    border: '0.5px solid #e5e7eb',
                    background: tabVinculacion === 'caminante' ? '#0f1787' : '#fff',
                    color: tabVinculacion === 'caminante' ? '#fff' : '#6b7280',
                  }}
                >
                  Caminante
                </button>
                <button
                  onClick={() => setTabVinculacion('servidor')}
                  style={{
                    flex: 1, padding: '8px 0', borderRadius: 10, fontSize: 13, fontWeight: 500, cursor: 'pointer',
                    border: '0.5px solid #e5e7eb',
                    background: tabVinculacion === 'servidor' ? '#0f1787' : '#fff',
                    color: tabVinculacion === 'servidor' ? '#fff' : '#6b7280',
                  }}
                >
                  Servidor
                </button>
              </div>

              <input
                type="text"
                value={busquedaVinculacion}
                onChange={e => setBusquedaVinculacion(e.target.value)}
                placeholder={`Buscar ${tabVinculacion} por nombre…`}
                style={{ width: '100%', height: 40, border: '0.5px solid #e5e7eb', borderRadius: 10, padding: '0 12px', fontSize: 14, color: '#0d0d14', outline: 'none', boxSizing: 'border-box', background: '#fafafa', marginBottom: 12 }}
              />

              {errorVinculacion && (
                <div style={{ background: '#fee2e2', color: '#991b1b', borderRadius: 8, padding: '10px 14px', fontSize: 13, marginBottom: 12 }}>
                  {errorVinculacion}
                </div>
              )}

              {cargandoPool ? (
                <p style={{ fontSize: 13, color: '#9ca3af', textAlign: 'center', padding: '16px 0' }}>Cargando…</p>
              ) : tabVinculacion === 'caminante' ? (
                caminantesFiltrados.length === 0 ? (
                  <div style={{ textAlign: 'center', padding: '16px 0' }}>
                    <p style={{ fontSize: 13, color: '#9ca3af', marginBottom: 8 }}>
                      {caminantesSinVincular.length === 0 ? 'No hay caminantes sin vincular en este retiro.' : 'Sin resultados para esa búsqueda.'}
                    </p>
                    <button
                      onClick={() => router.push(`/dashboard/identidades/nueva${busquedaVinculacion.trim() ? `?nombre=${encodeURIComponent(busquedaVinculacion.trim())}` : ''}`)}
                      style={{ fontSize: 13, color: '#0f1787', fontWeight: 500, background: 'none', border: 'none', cursor: 'pointer' }}
                    >
                      ¿No la encuentras? Crear una persona nueva
                    </button>
                  </div>
                ) : (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                    {caminantesFiltrados.map(c => (
                      <div key={c.id} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '10px 12px', borderRadius: 10, background: '#fafafa' }}>
                        <div>
                          <p style={{ fontSize: 13, fontWeight: 500, color: '#0d0d14', margin: 0 }}>{c.nombre}</p>
                          <p style={{ fontSize: 12, color: '#9ca3af', margin: '2px 0 0' }}>{c.celular || 'Sin celular'}</p>
                        </div>
                        <button
                          onClick={() => vincular('caminante', c)}
                          disabled={vinculando === c.id}
                          style={{ fontSize: 12, fontWeight: 600, color: '#fff', background: vinculando === c.id ? '#9ca3af' : '#0f1787', border: 'none', borderRadius: 8, padding: '6px 12px', cursor: vinculando === c.id ? 'not-allowed' : 'pointer' }}
                        >
                          {vinculando === c.id ? 'Vinculando…' : 'Vincular'}
                        </button>
                      </div>
                    ))}
                  </div>
                )
              ) : servidoresFiltrados.length === 0 ? (
                <div style={{ textAlign: 'center', padding: '16px 0' }}>
                  <p style={{ fontSize: 13, color: '#9ca3af', marginBottom: 8 }}>
                    {servidoresSinVincular.length === 0 ? 'No hay servidores sin vincular en este retiro.' : 'Sin resultados para esa búsqueda.'}
                  </p>
                  <button
                    onClick={() => router.push(`/dashboard/identidades/nueva${busquedaVinculacion.trim() ? `?nombre=${encodeURIComponent(busquedaVinculacion.trim())}` : ''}`)}
                    style={{ fontSize: 13, color: '#0f1787', fontWeight: 500, background: 'none', border: 'none', cursor: 'pointer' }}
                  >
                    ¿No lo encuentras? Crear una persona nueva
                  </button>
                </div>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                  {servidoresFiltrados.map(s => (
                    <div key={s.id} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '10px 12px', borderRadius: 10, background: '#fafafa' }}>
                      <div>
                        <p style={{ fontSize: 13, fontWeight: 500, color: '#0d0d14', margin: 0 }}>{s.nombre}</p>
                        <p style={{ fontSize: 12, color: '#9ca3af', margin: '2px 0 0' }}>{s.es_interno ? 'Interno' : 'Externo'}</p>
                      </div>
                      <button
                        onClick={() => vincular('servidor', s)}
                        disabled={vinculando === s.id}
                        style={{ fontSize: 12, fontWeight: 600, color: '#fff', background: vinculando === s.id ? '#9ca3af' : '#0f1787', border: 'none', borderRadius: 8, padding: '6px 12px', cursor: vinculando === s.id ? 'not-allowed' : 'pointer' }}
                      >
                        {vinculando === s.id ? 'Vinculando…' : 'Vincular'}
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
          <div style={{ width: 6, height: 6, borderRadius: '50%', background: '#10b981' }} />
          <p style={{ fontSize: 11, fontWeight: 600, color: '#9ca3af', textTransform: 'uppercase', letterSpacing: 1, margin: 0 }}>
            Participaciones como caminante ({caminante.length})
          </p>
        </div>
        {caminante.length === 0 ? (
          <div style={{ background: '#fff', borderRadius: 16, padding: 16, border: '0.5px solid #e5e7eb', fontSize: 14, color: '#9ca3af', marginBottom: 16 }}>
            Sin participaciones vinculadas todavía.
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginBottom: 16 }}>
            {caminante.map(c => (
              <div key={c.id} style={{ background: '#fff', borderRadius: 16, padding: 16, border: '0.5px solid #e5e7eb' }}>
                <p style={{ fontSize: 14, fontWeight: 500, color: '#0d0d14', margin: 0 }}>{c.retiro_nombre} · {anio(c.retiro_fecha_inicio)}</p>
                <p style={{ fontSize: 12, color: '#9ca3af', margin: '4px 0 0' }}>
                  {c.inscrito_oficialmente ? 'Inscrito oficialmente' : 'Inscripción no completada'}
                  {c.fecha_inscripcion ? ` · ${new Date(c.fecha_inscripcion).toLocaleDateString('es-CO')}` : ''}
                </p>
              </div>
            ))}
          </div>
        )}

        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
          <div style={{ width: 6, height: 6, borderRadius: '50%', background: '#8b5cf6' }} />
          <p style={{ fontSize: 11, fontWeight: 600, color: '#9ca3af', textTransform: 'uppercase', letterSpacing: 1, margin: 0 }}>
            Participaciones como servidor ({servidor.length})
          </p>
        </div>
        {servidor.length === 0 ? (
          <div style={{ background: '#fff', borderRadius: 16, padding: 16, border: '0.5px solid #e5e7eb', fontSize: 14, color: '#9ca3af' }}>
            Sin participaciones vinculadas todavía.
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {servidor.map(s => (
              <div key={s.id} style={{ background: '#fff', borderRadius: 16, padding: 16, border: '0.5px solid #e5e7eb' }}>
                <p style={{ fontSize: 14, fontWeight: 500, color: '#0d0d14', margin: 0 }}>{s.retiro_nombre} · {anio(s.retiro_fecha_inicio)}</p>
                <p style={{ fontSize: 12, color: '#9ca3af', margin: '4px 0 0' }}>
                  {s.es_interno ? 'Interno' : 'Externo'} · {s.inscrito_oficialmente ? 'Inscrito oficialmente' : 'Inscripción no completada'}
                </p>
              </div>
            ))}
          </div>
        )}
      </main>
    </div>
  )
}
