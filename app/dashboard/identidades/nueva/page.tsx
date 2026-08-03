'use client'

import { Suspense, useEffect, useState } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { supabase } from '@/lib/supabase'

function NuevaIdentidadContenido() {
  const router = useRouter()
  const searchParams = useSearchParams()

  const [verificando, setVerificando] = useState(true)
  const [nombreCompleto, setNombreCompleto] = useState('')
  const [documento, setDocumento] = useState('')
  const [guardando, setGuardando] = useState(false)
  const [error, setError] = useState('')

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

      const nombreInicial = searchParams.get('nombre')
      if (nombreInicial) setNombreCompleto(nombreInicial)

      setVerificando(false)
    }
    verificar()
  }, [])

  async function guardar(e: React.FormEvent) {
    e.preventDefault()
    if (!nombreCompleto.trim()) {
      setError('El nombre completo es obligatorio.')
      return
    }

    setGuardando(true)
    setError('')
    try {
      const { data, error: errorInsert } = await supabase
        .from('personas')
        .insert({
          nombre_completo: nombreCompleto.trim(),
          numero_documento_normalizado: documento.trim() || null,
        })
        .select()
        .single()

      if (errorInsert) throw errorInsert

      router.push(`/dashboard/identidades/${data.id}`)
    } catch (err: any) {
      console.error('Error creando persona:', err)
      setError(err?.message || 'No se pudo crear la persona. Intenta de nuevo.')
      setGuardando(false)
    }
  }

  if (verificando) {
    return (
      <div style={{ minHeight: '100vh', background: '#f7f8fc', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <p style={{ fontSize: 14, color: '#9ca3af' }}>Cargando…</p>
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
          Nueva persona
        </span>
      </header>

      <main style={{ padding: '24px 20px 0', maxWidth: 480, margin: '0 auto' }}>
        <p style={{ fontSize: 13, color: '#9ca3af', marginBottom: 20 }}>
          Crea una identidad nueva en el índice de personas. Podrás vincularla a un caminante o
          servidor existente desde su ficha.
        </p>

        <form onSubmit={guardar} style={{ background: '#fff', borderRadius: 16, padding: 20, border: '0.5px solid #e5e7eb', display: 'flex', flexDirection: 'column', gap: 14 }}>
          <div>
            <div style={{ fontSize: 11, color: '#9ca3af', textTransform: 'uppercase', letterSpacing: 1, marginBottom: 6 }}>Nombre completo *</div>
            <input
              type="text"
              value={nombreCompleto}
              onChange={e => setNombreCompleto(e.target.value)}
              placeholder="Nombre y apellidos"
              style={{ width: '100%', height: 40, border: '0.5px solid #e5e7eb', borderRadius: 10, padding: '0 12px', fontSize: 14, color: '#0d0d14', outline: 'none', boxSizing: 'border-box', background: '#fafafa' }}
            />
          </div>

          <div>
            <div style={{ fontSize: 11, color: '#9ca3af', textTransform: 'uppercase', letterSpacing: 1, marginBottom: 6 }}>Número de documento</div>
            <input
              type="text"
              value={documento}
              onChange={e => setDocumento(e.target.value)}
              placeholder="Opcional"
              style={{ width: '100%', height: 40, border: '0.5px solid #e5e7eb', borderRadius: 10, padding: '0 12px', fontSize: 14, color: '#0d0d14', outline: 'none', boxSizing: 'border-box', background: '#fafafa' }}
            />
          </div>

          {error && (
            <div style={{ background: '#fee2e2', color: '#991b1b', borderRadius: 8, padding: '10px 14px', fontSize: 13 }}>
              {error}
            </div>
          )}

          <button
            type="submit"
            disabled={guardando}
            style={{ height: 42, background: guardando ? '#9ca3af' : '#0f1787', color: '#fff', border: 'none', borderRadius: 10, fontSize: 14, fontWeight: 500, cursor: guardando ? 'not-allowed' : 'pointer' }}
          >
            {guardando ? 'Guardando…' : 'Crear persona'}
          </button>
        </form>
      </main>
    </div>
  )
}

export default function NuevaIdentidadPage() {
  return (
    <Suspense fallback={
      <div style={{ minHeight: '100vh', background: '#f7f8fc', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <p style={{ fontSize: 14, color: '#9ca3af' }}>Cargando…</p>
      </div>
    }>
      <NuevaIdentidadContenido />
    </Suspense>
  )
}
