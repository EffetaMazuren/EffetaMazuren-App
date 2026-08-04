'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'

interface PersonaConFoto {
  id: string
  nombre_completo: string
  foto_url: string
}

export default function FotosServidoresPage() {
  const router = useRouter()
  const [personas, setPersonas] = useState<PersonaConFoto[]>([])
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

      await cargarFotos()
    }
    verificar()
  }, [])

  async function cargarFotos() {
    setLoading(true)
    setError('')
    try {
      const { data, error: errorPersonas } = await supabase
        .from('personas')
        .select('id, nombre_completo, foto_url')
        .not('foto_url', 'is', null)
        .order('nombre_completo', { ascending: true })

      if (errorPersonas) throw errorPersonas

      setPersonas((data ?? []) as PersonaConFoto[])
    } catch (err) {
      console.error('Error cargando fotos:', err)
      setError('No se pudieron cargar las fotos.')
    } finally {
      setLoading(false)
    }
  }

  const personasFiltradas = personas.filter(p => {
    const termino = busqueda.trim().toLowerCase()
    if (!termino) return true
    return p.nombre_completo.toLowerCase().includes(termino)
  })

  if (loading) {
    return (
      <div className="min-h-screen bg-[#f7f8fc] flex items-center justify-center">
        <div className="flex flex-col items-center gap-3">
          <div className="w-8 h-8 border-2 border-[#0f1787] border-t-transparent rounded-full animate-spin" />
          <p className="text-sm text-gray-400 font-medium">Cargando fotos…</p>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-[#f7f8fc] pb-24">
      <header className="bg-white border-b border-gray-100 px-5 py-4 sticky top-0 z-10">
        <span className="text-xs font-semibold tracking-[0.15em] text-[#0f1787] uppercase">
          Fotos de servidores
        </span>
      </header>

      <main className="px-5 pt-6 max-w-2xl mx-auto">
        <h1 className="text-2xl font-semibold text-gray-900 tracking-tight mb-1">Colage</h1>
        <p className="text-sm text-gray-400 mb-4">
          Caras y nombres tomadas al registrarse en el portal de servidor.
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

        {personasFiltradas.length === 0 ? (
          <div className="text-center text-gray-400 text-sm py-16">
            {personas.length === 0
              ? 'Todavía no hay fotos registradas.'
              : 'Sin resultados para esa búsqueda.'}
          </div>
        ) : (
          <div className="grid grid-cols-3 gap-4">
            {personasFiltradas.map(p => (
              <div key={p.id} className="flex flex-col items-center gap-2">
                <img
                  src={p.foto_url}
                  alt={p.nombre_completo}
                  className="w-20 h-20 rounded-full object-cover border border-gray-100 shadow-sm"
                />
                <p className="text-xs text-center text-gray-700 leading-tight">{p.nombre_completo}</p>
              </div>
            ))}
          </div>
        )}
      </main>
    </div>
  )
}
