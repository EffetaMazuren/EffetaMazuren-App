'use client'
import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'

const RETIRO_ID = '21da7588-f7d9-4bf8-a6f6-ae6c8258c00e'

interface Mensaje {
  id: string
  texto: string
  autor_nombre: string
  created_at: string
  destinatario_id: string | null
  servidores_inscripcion?: { nombre: string } | null
}

interface Servidor {
  id: string
  nombre: string
}

export default function MensajesPage() {
  const router = useRouter()
  const [mensajes, setMensajes] = useState<Mensaje[]>([])
  const [servidores, setServidores] = useState<Servidor[]>([])
  const [texto, setTexto] = useState('')
  const [autorNombre, setAutorNombre] = useState('')
  const [enviando, setEnviando] = useState(false)
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(true)

  // Modo: 'general' | 'personalizado'
  const [modo, setModo] = useState<'general' | 'personalizado'>('general')
  // Servidores seleccionados para mensaje personalizado
  const [seleccionados, setSeleccionados] = useState<string[]>([])
  const [busqueda, setBusqueda] = useState('')

  useEffect(() => { cargar() }, [])

  useEffect(() => {
    const channel = supabase
      .channel('mensajes-lideres')
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'mensajes_retiro', filter: `retiro_id=eq.${RETIRO_ID}` }, async (payload) => {
        // Enriquecer con nombre del destinatario si aplica
        const msg = payload.new as Mensaje
        if (msg.destinatario_id) {
          const { data } = await supabase.from('servidores_inscripcion').select('nombre').eq('id', msg.destinatario_id).single()
          setMensajes(prev => [{ ...msg, servidores_inscripcion: data }, ...prev])
        } else {
          setMensajes(prev => [{ ...msg, servidores_inscripcion: null }, ...prev])
        }
      })
      .on('postgres_changes', { event: 'DELETE', schema: 'public', table: 'mensajes_retiro' }, (payload) => {
        setMensajes(prev => prev.filter(m => m.id !== payload.old.id))
      })
      .subscribe()
    return () => { supabase.removeChannel(channel) }
  }, [])

  async function cargar() {
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) { router.push('/'); return }
    const { data: u } = await supabase.from('usuarios').select('nombre, rol').eq('id', user.id).single()
    if (!u || u.rol !== 'lider') { router.push('/dashboard'); return }
    setAutorNombre(u.nombre?.split(' ')[0] || 'Líder')

    const [{ data: msgs }, { data: srvs }] = await Promise.all([
      supabase
        .from('mensajes_retiro')
        .select('*, servidores_inscripcion(nombre)')
        .eq('retiro_id', RETIRO_ID)
        .order('created_at', { ascending: false }),
      supabase
        .from('servidores_inscripcion')
        .select('id, nombre')
        .eq('retiro_id', RETIRO_ID)
        .order('nombre'),
    ])
    if (msgs) setMensajes(msgs)
    if (srvs) setServidores(srvs)
    setLoading(false)
  }

  function toggleSeleccionado(id: string) {
    setSeleccionados(prev => prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id])
  }

  async function enviar() {
    if (!texto.trim()) return
    if (modo === 'personalizado' && seleccionados.length === 0) {
      setError('Selecciona al menos un servidor.')
      return
    }
    setEnviando(true)
    setError('')

    if (modo === 'general') {
      const { error: err } = await supabase.from('mensajes_retiro').insert({
        retiro_id: RETIRO_ID,
        texto: texto.trim(),
        autor_nombre: autorNombre,
        destinatario_id: null,
      })
      if (err) { setError('No se pudo enviar.'); setEnviando(false); return }
    } else {
      // Insertar uno por cada servidor seleccionado
      const inserts = seleccionados.map(did => ({
        retiro_id: RETIRO_ID,
        texto: texto.trim(),
        autor_nombre: autorNombre,
        destinatario_id: did,
      }))
      const { error: err } = await supabase.from('mensajes_retiro').insert(inserts)
      if (err) { setError('No se pudo enviar.'); setEnviando(false); return }
    }

    setTexto('')
    setSeleccionados([])
    setEnviando(false)
  }

  async function eliminar(id: string) {
    if (!confirm('¿Eliminar este mensaje?')) return
    await supabase.from('mensajes_retiro').delete().eq('id', id)
  }

  function formatHora(iso: string) {
    return new Date(iso).toLocaleString('es-CO', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })
  }

  const servidoresFiltrados = servidores.filter(s =>
    s.nombre.toLowerCase().includes(busqueda.toLowerCase())
  )

  const mensajesGenerales = mensajes.filter(m => !m.destinatario_id)
  const mensajesPersonalizados = mensajes.filter(m => m.destinatario_id)

  if (loading) return (
    <div style={{ minHeight: '100vh', background: '#f7f8fc', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      <div style={{ color: '#9ca3af', fontSize: 14 }}>Cargando...</div>
    </div>
  )

  return (
    <div style={{ minHeight: '100vh', background: '#f7f8fc', paddingBottom: 40 }}>

      {/* Header */}
      <div style={{ background: '#0f1787', padding: '28px 20px 32px' }}>
        <button onClick={() => router.push('/dashboard')} style={{ background: 'none', border: 'none', color: 'rgba(255,255,255,0.6)', cursor: 'pointer', fontSize: 13, padding: 0, marginBottom: 12, display: 'flex', alignItems: 'center', gap: 6 }}>
          <svg width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" viewBox="0 0 24 24"><polyline points="15 18 9 12 15 6"/></svg>
          Dashboard
        </button>
        <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.5)', textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: 6 }}>Comunicados</div>
        <div style={{ fontSize: 26, fontWeight: 600, color: '#fff' }}>Mensajes a servidores</div>
        <div style={{ fontSize: 13, color: 'rgba(255,255,255,0.55)', marginTop: 4 }}>
          {mensajesGenerales.length} generales · {mensajesPersonalizados.length} personalizados
        </div>
      </div>

      <div style={{ maxWidth: 600, margin: '0 auto', padding: '20px 20px' }}>

        {/* Toggle general / personalizado */}
        <div style={{ display: 'flex', background: '#fff', border: '0.5px solid #e5e7eb', borderRadius: 12, padding: 4, marginBottom: 16, gap: 4 }}>
          <button
            onClick={() => { setModo('general'); setSeleccionados([]); setError('') }}
            style={{ flex: 1, padding: '9px', borderRadius: 9, fontSize: 13, fontWeight: 600, border: 'none', cursor: 'pointer', background: modo === 'general' ? '#0f1787' : 'transparent', color: modo === 'general' ? '#fff' : '#6b7280', transition: 'all 0.15s' }}
          >
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6 }}>
              <svg width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" viewBox="0 0 24 24"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/></svg>
              Para todos
            </div>
          </button>
          <button
            onClick={() => { setModo('personalizado'); setError('') }}
            style={{ flex: 1, padding: '9px', borderRadius: 9, fontSize: 13, fontWeight: 600, border: 'none', cursor: 'pointer', background: modo === 'personalizado' ? '#0f1787' : 'transparent', color: modo === 'personalizado' ? '#fff' : '#6b7280', transition: 'all 0.15s' }}
          >
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6 }}>
              <svg width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" viewBox="0 0 24 24"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>
              Personalizado
            </div>
          </button>
        </div>

        {/* Formulario */}
        <div style={{ background: '#fff', borderRadius: 16, border: '0.5px solid #e5e7eb', padding: 20, marginBottom: 20 }}>

          {/* Selector de servidores (solo modo personalizado) */}
          {modo === 'personalizado' && (
            <div style={{ marginBottom: 14 }}>
              <div style={{ fontSize: 11, color: '#9ca3af', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 8, fontWeight: 600 }}>
                Destinatarios · {seleccionados.length} seleccionado{seleccionados.length !== 1 ? 's' : ''}
              </div>

              {/* Chips seleccionados */}
              {seleccionados.length > 0 && (
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginBottom: 10 }}>
                  {seleccionados.map(id => {
                    const srv = servidores.find(s => s.id === id)
                    return (
                      <div key={id} style={{ display: 'flex', alignItems: 'center', gap: 4, background: '#eef0ff', borderRadius: 20, padding: '4px 10px' }}>
                        <span style={{ fontSize: 12, color: '#0f1787', fontWeight: 500 }}>{srv?.nombre.split(' ')[0]}</span>
                        <button onClick={() => toggleSeleccionado(id)} style={{ background: 'none', border: 'none', color: '#0f1787', cursor: 'pointer', fontSize: 14, lineHeight: 1, padding: 0 }}>×</button>
                      </div>
                    )
                  })}
                  <button onClick={() => setSeleccionados([])} style={{ fontSize: 11, color: '#9ca3af', background: 'none', border: 'none', cursor: 'pointer', padding: '4px 6px' }}>
                    Limpiar todo
                  </button>
                </div>
              )}

              {/* Buscador */}
              <div style={{ position: 'relative', marginBottom: 8 }}>
                <svg width="14" height="14" fill="none" stroke="#9ca3af" strokeWidth="2" strokeLinecap="round" viewBox="0 0 24 24" style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)' }}>
                  <circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/>
                </svg>
                <input
                  type="text"
                  value={busqueda}
                  onChange={e => setBusqueda(e.target.value)}
                  placeholder="Buscar servidor…"
                  style={{ width: '100%', border: '0.5px solid #e5e7eb', borderRadius: 10, padding: '8px 12px 8px 32px', fontSize: 13, color: '#0d0d14', outline: 'none', boxSizing: 'border-box', background: '#fafafa' }}
                />
              </div>

              {/* Lista servidores */}
              <div style={{ maxHeight: 200, overflowY: 'auto', border: '0.5px solid #e5e7eb', borderRadius: 10, background: '#fafafa' }}>
                {servidoresFiltrados.length === 0 ? (
                  <div style={{ padding: '14px', textAlign: 'center', color: '#9ca3af', fontSize: 13 }}>Sin resultados</div>
                ) : servidoresFiltrados.map((srv, i) => {
                  const sel = seleccionados.includes(srv.id)
                  return (
                    <button
                      key={srv.id}
                      onClick={() => toggleSeleccionado(srv.id)}
                      style={{ width: '100%', display: 'flex', alignItems: 'center', gap: 10, padding: '10px 14px', background: sel ? '#eef0ff' : 'transparent', border: 'none', borderTop: i > 0 ? '0.5px solid #f3f4f6' : 'none', cursor: 'pointer', textAlign: 'left' }}
                    >
                      <div style={{ width: 18, height: 18, borderRadius: 5, border: `2px solid ${sel ? '#0f1787' : '#d1d5db'}`, background: sel ? '#0f1787' : '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                        {sel && <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="3" strokeLinecap="round"><polyline points="20 6 9 17 4 12"/></svg>}
                      </div>
                      <span style={{ fontSize: 13, color: sel ? '#0f1787' : '#0d0d14', fontWeight: sel ? 600 : 400 }}>{srv.nombre}</span>
                    </button>
                  )
                })}
              </div>

              {/* Seleccionar todos */}
              <button
                onClick={() => {
                  if (seleccionados.length === servidores.length) setSeleccionados([])
                  else setSeleccionados(servidores.map(s => s.id))
                }}
                style={{ marginTop: 8, background: 'none', border: 'none', fontSize: 12, color: '#0f1787', cursor: 'pointer', padding: 0, fontWeight: 500 }}
              >
                {seleccionados.length === servidores.length ? 'Deseleccionar todos' : `Seleccionar todos (${servidores.length})`}
              </button>
            </div>
          )}

          {/* Textarea mensaje */}
          <div>
            <div style={{ fontSize: 11, color: '#9ca3af', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 8, fontWeight: 600 }}>
              {modo === 'general' ? 'Mensaje para todos los servidores' : 'Mensaje'}
            </div>
            <textarea
              value={texto}
              onChange={e => setTexto(e.target.value)}
              placeholder={modo === 'general' ? 'Escribe un mensaje para todos…' : 'Escribe el mensaje personalizado…'}
              rows={3}
              style={{ width: '100%', border: '0.5px solid #e5e7eb', borderRadius: 10, padding: '10px 14px', fontSize: 14, color: '#0d0d14', outline: 'none', boxSizing: 'border-box', background: '#fafafa', resize: 'vertical', fontFamily: 'system-ui, sans-serif', lineHeight: 1.5 }}
            />
          </div>

          {error && (
            <div style={{ background: '#fef2f2', border: '0.5px solid #fecaca', borderRadius: 8, padding: '8px 12px', fontSize: 13, color: '#991b1b', marginTop: 10 }}>{error}</div>
          )}

          <button
            onClick={enviar}
            disabled={enviando || !texto.trim() || (modo === 'personalizado' && seleccionados.length === 0)}
            style={{ marginTop: 12, width: '100%', background: (enviando || !texto.trim() || (modo === 'personalizado' && seleccionados.length === 0)) ? '#e5e7eb' : '#0f1787', color: (enviando || !texto.trim() || (modo === 'personalizado' && seleccionados.length === 0)) ? '#9ca3af' : '#fff', border: 'none', borderRadius: 10, padding: '12px', fontSize: 14, fontWeight: 500, cursor: (enviando || !texto.trim() || (modo === 'personalizado' && seleccionados.length === 0)) ? 'not-allowed' : 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8 }}
          >
            <svg width="15" height="15" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" viewBox="0 0 24 24"><line x1="22" y1="2" x2="11" y2="13"/><polygon points="22 2 15 22 11 13 2 9 22 2"/></svg>
            {enviando ? 'Enviando…' : modo === 'general' ? `Enviar a todos los servidores` : `Enviar a ${seleccionados.length} servidor${seleccionados.length !== 1 ? 'es' : ''}`}
          </button>

          <p style={{ fontSize: 11, color: '#9ca3af', textAlign: 'center', marginTop: 8, marginBottom: 0 }}>
            {modo === 'general' ? 'Aparece al instante en el inicio de todos los servidores' : 'Solo lo verá el servidor destinatario'}
          </p>
        </div>

        {/* Mensajes enviados */}
        {mensajes.length > 0 && (
          <>
            {mensajesGenerales.length > 0 && (
              <>
                <div style={{ fontSize: 11, color: '#9ca3af', textTransform: 'uppercase', letterSpacing: '0.06em', fontWeight: 600, marginBottom: 10 }}>
                  Generales · {mensajesGenerales.length}
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginBottom: 20 }}>
                  {mensajesGenerales.map(msg => (
                    <div key={msg.id} style={{ background: '#fff', borderRadius: 14, border: '0.5px solid #e5e7eb', padding: '14px 16px', display: 'flex', alignItems: 'flex-start', gap: 12 }}>
                      <div style={{ width: 32, height: 32, borderRadius: '50%', background: '#eef0ff', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                        <svg width="14" height="14" fill="none" stroke="#0f1787" strokeWidth="2" strokeLinecap="round" viewBox="0 0 24 24"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/></svg>
                      </div>
                      <div style={{ flex: 1 }}>
                        <p style={{ margin: '0 0 6px', fontSize: 14, color: '#0d0d14', lineHeight: 1.5 }}>{msg.texto}</p>
                        <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                          <span style={{ fontSize: 11, fontWeight: 600, color: '#0f1787', background: '#eef0ff', padding: '2px 8px', borderRadius: 20 }}>{msg.autor_nombre}</span>
                          <span style={{ fontSize: 11, color: '#9ca3af' }}>{formatHora(msg.created_at)}</span>
                        </div>
                      </div>
                      <button onClick={() => eliminar(msg.id)} style={{ background: 'none', border: 'none', color: '#d1d5db', cursor: 'pointer', fontSize: 20, lineHeight: 1, padding: '0 0 0 4px', flexShrink: 0 }}>×</button>
                    </div>
                  ))}
                </div>
              </>
            )}

            {mensajesPersonalizados.length > 0 && (
              <>
                <div style={{ fontSize: 11, color: '#9ca3af', textTransform: 'uppercase', letterSpacing: '0.06em', fontWeight: 600, marginBottom: 10 }}>
                  Personalizados · {mensajesPersonalizados.length}
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                  {mensajesPersonalizados.map(msg => (
                    <div key={msg.id} style={{ background: '#fff', borderRadius: 14, border: '0.5px solid #e5e7eb', padding: '14px 16px', display: 'flex', alignItems: 'flex-start', gap: 12 }}>
                      <div style={{ width: 32, height: 32, borderRadius: '50%', background: '#fdf4ff', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                        <svg width="14" height="14" fill="none" stroke="#7c3aed" strokeWidth="2" strokeLinecap="round" viewBox="0 0 24 24"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>
                      </div>
                      <div style={{ flex: 1 }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 4 }}>
                          <span style={{ fontSize: 11, fontWeight: 600, color: '#7c3aed', background: '#fdf4ff', padding: '2px 8px', borderRadius: 20 }}>
                            Para: {msg.servidores_inscripcion?.nombre?.split(' ')[0] ?? '—'}
                          </span>
                        </div>
                        <p style={{ margin: '0 0 6px', fontSize: 14, color: '#0d0d14', lineHeight: 1.5 }}>{msg.texto}</p>
                        <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                          <span style={{ fontSize: 11, fontWeight: 600, color: '#0f1787', background: '#eef0ff', padding: '2px 8px', borderRadius: 20 }}>{msg.autor_nombre}</span>
                          <span style={{ fontSize: 11, color: '#9ca3af' }}>{formatHora(msg.created_at)}</span>
                        </div>
                      </div>
                      <button onClick={() => eliminar(msg.id)} style={{ background: 'none', border: 'none', color: '#d1d5db', cursor: 'pointer', fontSize: 20, lineHeight: 1, padding: '0 0 0 4px', flexShrink: 0 }}>×</button>
                    </div>
                  ))}
                </div>
              </>
            )}
          </>
        )}

        {mensajes.length === 0 && (
          <div style={{ background: '#fff', borderRadius: 14, border: '0.5px solid #e5e7eb', padding: '32px', textAlign: 'center', color: '#9ca3af', fontSize: 14 }}>
            Sin mensajes enviados aún
          </div>
        )}
      </div>
    </div>
  )
}
