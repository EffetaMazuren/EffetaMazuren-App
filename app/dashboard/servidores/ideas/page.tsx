'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'
import { useRetiroActual } from '@/lib/retiro-context'

interface Idea {
  id: string
  nombre: string
  idea_recaudo: string | null
  idea_reunion: string | null
}

export default function IdeasServidoresPage() {
  const router = useRouter()
  const { id: RETIRO_ID } = useRetiroActual()
  const [ideas, setIdeas] = useState<Idea[]>([])
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

      await cargarIdeas()
    }
    verificar()
  }, [])

  async function cargarIdeas() {
    setLoading(true)
    setError('')
    try {
      const { data, error: errorIdeas } = await supabase
        .from('servidores_inscripcion')
        .select('id, nombre, idea_recaudo, idea_reunion')
        .eq('retiro_id', RETIRO_ID)
        .or('idea_recaudo.not.is.null,idea_reunion.not.is.null')
        .order('nombre', { ascending: true })

      if (errorIdeas) throw errorIdeas

      setIdeas((data ?? []) as Idea[])
    } catch (err) {
      console.error('Error cargando ideas:', err)
      setError('No se pudieron cargar las ideas.')
    } finally {
      setLoading(false)
    }
  }

  const ideasFiltradas = ideas.filter(i => {
    const termino = busqueda.trim().toLowerCase()
    if (!termino) return true
    return i.nombre.toLowerCase().includes(termino)
  })

  if (loading) {
    return (
      <div className="min-h-screen bg-[#f7f8fc] flex items-center justify-center">
        <div className="flex flex-col items-center gap-3">
          <div className="w-8 h-8 border-2 border-[#0f1787] border-t-transparent rounded-full animate-spin" />
          <p className="text-sm text-gray-400 font-medium">Cargando ideas…</p>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-[#f7f8fc] pb-24">
      <header className="bg-white border-b border-gray-100 px-5 py-4 sticky top-0 z-10">
        <span className="text-xs font-semibold tracking-[0.15em] text-[#0f1787] uppercase">
          Ideas de servidores
        </span>
      </header>

      <main className="px-5 pt-6 max-w-2xl mx-auto">
        <h1 className="text-2xl font-semibold text-gray-900 tracking-tight mb-1">Ideas</h1>
        <p className="text-sm text-gray-400 mb-4">
          Recaudo de fondos y reuniones, del retiro activo.
        </p>

        <input
          type="text"
          value={busqueda}
          onChange={e => setBusqueda(e.target.value)}
          placeholder="Buscar por nombre…"
          className="w-full h-11 rounded-xl border border-gray-200 bg-white px-4 text-sm text-gray-900 outline-none focus:border-[#0f1787] mb-4"
        />

        {error && (
          <div className="bg-red-50 border border-red-100 rounded-xl px-4 py-3 text-sm text-red-600 mb-4">
            {error}
          </div>
        )}

        {ideasFiltradas.length === 0 ? (
          <div className="text-center text-gray-400 text-sm py-16">
            {ideas.length === 0
              ? 'Todavía no hay ideas enviadas.'
              : 'Sin resultados para esa búsqueda.'}
          </div>
        ) : (
          <div className="flex flex-col gap-2">
            {ideasFiltradas.map(i => (
              <div key={i.id} className="bg-white rounded-2xl p-4 shadow-sm border border-gray-100">
                <p className="text-sm font-semibold text-gray-900 mb-2">{i.nombre}</p>
                {i.idea_recaudo && (
                  <div className="mb-2">
                    <p className="text-[10px] font-medium uppercase tracking-wide text-emerald-700 mb-0.5">Recaudo de fondos</p>
                    <p className="text-sm text-gray-600">{i.idea_recaudo}</p>
                  </div>
                )}
                {i.idea_reunion && (
                  <div>
                    <p className="text-[10px] font-medium uppercase tracking-wide text-violet-700 mb-0.5">Reunión</p>
                    <p className="text-sm text-gray-600">{i.idea_reunion}</p>
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </main>
    </div>
  )
}
