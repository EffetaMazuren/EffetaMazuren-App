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
}

export default function MensajesPage() {
  const router = useRouter()
  const [mensajes, setMensajes] = useState<Mensaje[]>([])
  const [texto, setTexto] = useState('')
  const [autorNombre, setAutorNombre] = useState('')
  const [enviando, setEnviando] = useState(false)
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    cargar()
  }, [])

  // Realtime
  useEffect(() => {
    const channel = supabase
      .channel('mensajes-lideres')
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'mensajes_retiro', filter: `retiro_id=eq.${RETIRO_ID}` }, (payload) => {
        setMensajes(prev => [payload.new as Mensaje, ...prev])
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

    const { data } = await supabase
      .from('mensajes_retiro')
      .select('*')
      .eq('retiro_id', RETIRO_ID)
      .order('created_at', { ascending: false })
    if (data) setMensajes(data)
    setLoading(false)
  }

  async function enviar() {
    if (!texto.trim()) return
    setEnviando(true)
    setError('')
    const { error: err } = await supabase.from('mensajes_retiro').insert({
      retiro_id: RETIRO_ID,
      texto: texto.trim(),
      autor_nombre: autorNombre,
    })
    if (err) { setError('No se pudo enviar. Intenta de nuevo.'); setEnviando(false); return }
    setTexto('')
    setEnviando(false)
  }

  async function eliminar(id: string) {
    if (!confirm('¿Eliminar este mensaje?')) return
    await supabase.from('mensajes_retiro').delete().eq('id', id)
  }

  function formatHora(iso: string) {
    return new Date(iso).toLocaleString('es-CO', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })
  }

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
        <div style={{ fontSize: 13, color: 'rgba(255,255,255,0.55)', marginTop: 4 }}>Se muestran en tiempo real en el inicio de cada servidor</div>
      </div>

      <div style={{ maxWidth: 600, margin: '0 auto', padding: '20px 20px' }}>

        {/* Formulario envío */}
        <div style={{ background: '#fff', borderRadius: 16, border: '0.5px solid #e5e7eb', padding: 20, marginBottom: 20 }}>
          <div style={{ fontSize: 13, fontWeight: 600, color: '#0d0d14', marginBottom: 12 }}>Nuevo mensaje</div>
          <textarea
            value={texto}
            onChange={e => setTexto(e.target.value)}
            placeholder="Escribe un mensaje para todos los servidores…"
            rows={3}
            style={{ width: '100%', border: '0.5px solid #e5e7eb', borderRadius: 10, padding: '10px 14px', fontSize: 14, color: '#0d0d14', outline: 'none', boxSizing: 'border-box', background: '#fafafa', resize: 'vertical', fontFamily: 'system-ui, sans-serif', lineHeight: 1.5 }}
          />
          {error && (
            <div style={{ background: '#fef2f2', border: '0.5px solid #fecaca', borderRadius: 8, padding: '8px 12px', fontSize: 13, color: '#991b1b', marginTop: 8 }}>{error}</div>
          )}
          <button
            onClick={enviar}
            disabled={enviando || !texto.trim()}
            style={{ marginTop: 12, width: '100%', background: enviando || !texto.trim() ? '#e5e7eb' : '#0f1787', color: enviando || !texto.trim() ? '#9ca3af' : '#fff', border: 'none', borderRadius: 10, padding: '12px', fontSize: 14, fontWeight: 500, cursor: enviando || !texto.trim() ? 'not-allowed' : 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8 }}
          >
            <svg width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" viewBox="0 0 24 24"><line x1="22" y1="2" x2="11" y2="13"/><polygon points="22 2 15 22 11 13 2 9 22 2"/></svg>
            {enviando ? 'Enviando…' : 'Enviar a todos los servidores'}
          </button>
          <p style={{ fontSize: 11, color: '#9ca3af', textAlign: 'center', marginTop: 8, marginBottom: 0 }}>
            El mensaje aparece al instante en el celular de cada servidor
          </p>
        </div>

        {/* Lista mensajes */}
        <div style={{ fontSize: 11, color: '#9ca3af', textTransform: 'uppercase', letterSpacing: '0.06em', fontWeight: 600, marginBottom: 10 }}>
          {mensajes.length} mensaje{mensajes.length !== 1 ? 's' : ''} enviado{mensajes.length !== 1 ? 's' : ''}
        </div>

        {mensajes.length === 0 ? (
          <div style={{ background: '#fff', borderRadius: 14, border: '0.5px solid #e5e7eb', padding: '32px', textAlign: 'center', color: '#9ca3af', fontSize: 14 }}>
            Sin mensajes enviados aún
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            {mensajes.map(msg => (
              <div key={msg.id} style={{ background: '#fff', borderRadius: 14, border: '0.5px solid #e5e7eb', padding: '14px 16px', display: 'flex', alignItems: 'flex-start', gap: 12 }}>
                <div style={{ flex: 1 }}>
                  <p style={{ margin: '0 0 8px', fontSize: 14, color: '#0d0d14', lineHeight: 1.5 }}>{msg.texto}</p>
                  <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
                    <span style={{ fontSize: 11, fontWeight: 600, color: '#0f1787', background: '#eef0ff', padding: '2px 8px', borderRadius: 20 }}>{msg.autor_nombre}</span>
                    <span style={{ fontSize: 11, color: '#9ca3af' }}>{formatHora(msg.created_at)}</span>
                  </div>
                </div>
                <button
                  onClick={() => eliminar(msg.id)}
                  style={{ background: 'none', border: 'none', color: '#d1d5db', cursor: 'pointer', fontSize: 20, lineHeight: 1, padding: '0 0 0 4px', flexShrink: 0 }}
                >
                  ×
                </button>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
