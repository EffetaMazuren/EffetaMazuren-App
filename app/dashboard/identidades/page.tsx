'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'

interface Persona {
  id: string
  nombre_completo: string
  numero_documento_normalizado: string | null
  created_at: string
  totalCaminante: number
  totalServidor: number
}

export default function IdentidadesPage() {
  const router = useRouter()
  const [personas, setPersonas] = useState<Persona[]>([])
  const [loading, setLoading] = useState(true)
  const [busqueda, setBusqueda] = useState('')
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

      await cargarPersonas()
    }
    verificar()
  }, [])

  async function cargarPersonas() {
    setLoading(true)
    setError('')
    try {
      const { data: personasData, error: errorPersonas } = await supabase
        .from('personas')
        .select('id, nombre_completo, numero_documento_normalizado, created_at')
        .order('nombre_completo', { ascending: true })

      if (errorPersonas) throw errorPersonas

      const ids = (personasData ?? []).map(p => p.id)

      const [{ data: caminantesData }, { data: servidoresData }] = await Promise.all([
        supabase.from('caminantes').select('id_persona').in('id_persona', ids),
        supabase.from('servidores_inscripcion').select('id_persona').in('id_persona', ids),
      ])

      const conteoCaminante: Record<string, number> = {}
      ;(caminantesData ?? []).forEach(c => {
        if (c.id_persona) conteoCaminante[c.id_persona] = (conteoCaminante[c.id_persona] ?? 0) + 1
      })

      const conteoServidor: Record<string, number> = {}
      ;(servidoresData ?? []).forEach(s => {
        if (s.id_persona) conteoServidor[s.id_persona] = (conteoServidor[s.id_persona] ?? 0) + 1
      })

      const lista: Persona[] = (personasData ?? []).map(p => ({
        id: p.id,
        nombre_completo: p.nombre_completo,
        numero_documento_normalizado: p.numero_documento_normalizado,
        created_at: p.created_at,
        totalCaminante: conteoCaminante[p.id] ?? 0,
        totalServidor: conteoServidor[p.id] ?? 0,
      }))

      setPersonas(lista)
    } catch (err) {
      console.error('Error cargando personas:', err)
      setError('No se pudieron cargar las personas.')
    } finally {
      setLoading(false)
    }
  }

  const personasFiltradas = personas.filter(p => {
    const termino = busqueda.trim().toLowerCase()
    if (!termino) return true
    return (
      p.nombre_completo.toLowerCase().includes(termino) ||
      (p.numero_documento_normalizado ?? '').toLowerCase().includes(termino)
    )
  })

  if (loading) {
    return (
      <div className="min-h-screen bg-[#f7f8fc] flex items-center justify-center">
        <div className="flex flex-col items-center gap-3">
          <div className="w-8 h-8 border-2 border-[#0f1787] border-t-transparent rounded-full animate-spin" />
          <p className="text-sm text-gray-400 font-medium">Cargando personas…</p>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-[#f7f8fc] pb-24">
      <header className="bg-white border-b border-gray-100 px-5 py-4 sticky top-0 z-10">
        <span className="text-xs font-semibold tracking-[0.15em] text-[#0f1787] uppercase">
          Identidades
        </span>
      </header>

      <main className="px-5 pt-6 max-w-2xl mx-auto">
        <h1 className="text-2xl font-semibold text-gray-900 tracking-tight mb-1">Personas</h1>
        <p className="text-sm text-gray-400 mb-4">
          Identidad única, independiente de cada edición del retiro.
        </p>

        <input
          type="text"
          value={busqueda}
          onChange={e => setBusqueda(e.target.value)}
          placeholder="Buscar por nombre o documento…"
          className="w-full h-11 rounded-xl border border-gray-200 bg-white px-4 text-sm text-gray-900 outline-none focus:border-[#0f1787] mb-4"
        />

        {error && (
          <div className="bg-red-50 border border-red-100 rounded-xl px-4 py-3 text-sm text-red-600 mb-4">
            {error}
          </div>
        )}

        {personasFiltradas.length === 0 ? (
          <div className="text-center text-gray-400 text-sm py-16">
            {personas.length === 0
              ? 'Todavía no hay personas registradas en el índice.'
              : 'Sin resultados para esa búsqueda.'}
          </div>
        ) : (
          <div className="flex flex-col gap-2">
            {personasFiltradas.map(p => (
              <button
                key={p.id}
                onClick={() => router.push(`/dashboard/identidades/${p.id}`)}
                className="w-full text-left bg-white rounded-2xl p-4 shadow-sm border border-gray-100 hover:shadow-md transition-shadow"
              >
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-semibold text-gray-900">{p.nombre_completo}</p>
                    <p className="text-xs text-gray-400 mt-0.5">
                      {p.numero_documento_normalizado || 'Sin documento registrado'}
                    </p>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-[10px] font-medium px-2 py-1 rounded-full bg-emerald-50 text-emerald-700">
                      {p.totalCaminante} caminante{p.totalCaminante === 1 ? '' : 's'}
                    </span>
                    <span className="text-[10px] font-medium px-2 py-1 rounded-full bg-violet-50 text-violet-700">
                      {p.totalServidor} servidor{p.totalServidor === 1 ? '' : 'es'}
                    </span>
                  </div>
                </div>
              </button>
            ))}
          </div>
        )}
      </main>
    </div>
  )
}
