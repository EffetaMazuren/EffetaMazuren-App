'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'
import { useRetiroActual } from '@/lib/retiro-context'

interface FilaServidor {
  id: string
  nombre: string
  total: number
  racha: number
}

type Orden = 'total' | 'racha'

export default function AsistenciasServidoresPage() {
  const router = useRouter()
  const { id: RETIRO_ID } = useRetiroActual()
  const [filas, setFilas] = useState<FilaServidor[]>([])
  const [loading, setLoading] = useState(true)
  const [busqueda, setBusqueda] = useState('')
  const [orden, setOrden] = useState<Orden>('racha')
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

      await cargar()
    }
    verificar()
  }, [])

  async function cargar() {
    setLoading(true)
    setError('')
    try {
      const hoy = new Date().toISOString().split('T')[0]
      const [{ data: servidores, error: errServidores }, { data: reuniones, error: errReuniones }] = await Promise.all([
        supabase.from('servidores_inscripcion').select('id, nombre').eq('retiro_id', RETIRO_ID),
        supabase.from('reuniones').select('id, fecha, cancelada').eq('retiro_id', RETIRO_ID).lte('fecha', hoy).order('fecha', { ascending: false }),
      ])

      if (errServidores) throw errServidores
      if (errReuniones) throw errReuniones

      const reunionIds = (reuniones ?? []).map(r => r.id)
      const { data: asistencias, error: errAsistencias } = await supabase
        .from('asistencias')
        .select('servidor_inscripcion_id, reunion_id, asistio, fuera_de_horario')
        .in('reunion_id', reunionIds.length > 0 ? reunionIds : ['00000000-0000-0000-0000-000000000000'])

      if (errAsistencias) throw errAsistencias

      const porServidor = new Map<string, Map<string, { asistio: boolean; fuera_de_horario: boolean }>>()
      for (const a of asistencias ?? []) {
        if (!porServidor.has(a.servidor_inscripcion_id)) porServidor.set(a.servidor_inscripcion_id, new Map())
        porServidor.get(a.servidor_inscripcion_id)!.set(a.reunion_id, { asistio: a.asistio, fuera_de_horario: a.fuera_de_horario })
      }

      const reunionesOrdenadas = (reuniones ?? [])

      const lista: FilaServidor[] = (servidores ?? []).map(s => {
        const asistMap = porServidor.get(s.id) ?? new Map()
        let total = 0
        let racha = 0
        let rachaActiva = true
        for (const r of reunionesOrdenadas) {
          if (r.cancelada) continue
          const a = asistMap.get(r.id)
          const cuenta = !!a && a.asistio === true && !a.fuera_de_horario
          if (cuenta) total++
          if (rachaActiva) {
            if (cuenta) racha++
            else rachaActiva = false
          }
        }
        return { id: s.id, nombre: s.nombre, total, racha }
      })

      setFilas(lista)
    } catch (err) {
      console.error('Error cargando asistencias:', err)
      setError('No se pudieron cargar las asistencias.')
    } finally {
      setLoading(false)
    }
  }

  const filasFiltradas = filas
    .filter(f => {
      const termino = busqueda.trim().toLowerCase()
      if (!termino) return true
      return f.nombre.toLowerCase().includes(termino)
    })
    .sort((a, b) => b[orden] - a[orden])

  if (loading) {
    return (
      <div className="min-h-screen bg-[#f7f8fc] flex items-center justify-center">
        <div className="flex flex-col items-center gap-3">
          <div className="w-8 h-8 border-2 border-[#0f1787] border-t-transparent rounded-full animate-spin" />
          <p className="text-sm text-gray-400 font-medium">Cargando asistencias…</p>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-[#f7f8fc] pb-24">
      <header className="bg-white border-b border-gray-100 px-5 py-4 sticky top-0 z-10">
        <span className="text-xs font-semibold tracking-[0.15em] text-[#0f1787] uppercase">
          Asistencias de servidores
        </span>
      </header>

      <main className="px-5 pt-6 max-w-2xl mx-auto">
        <h1 className="text-2xl font-semibold text-gray-900 tracking-tight mb-1">Asistencias</h1>
        <p className="text-sm text-gray-400 mb-4">
          Solo cuentan las tomadas dentro de la ventana de horario válida.
        </p>

        <input
          type="text"
          value={busqueda}
          onChange={e => setBusqueda(e.target.value)}
          placeholder="Buscar por nombre…"
          className="w-full h-11 rounded-xl border border-gray-200 bg-white px-4 text-sm text-gray-900 outline-none focus:border-[#0f1787] mb-3"
        />

        <div className="flex gap-2 mb-4">
          <button
            onClick={() => setOrden('racha')}
            className={`text-xs font-medium px-3 py-1.5 rounded-full border ${orden === 'racha' ? 'bg-[#0f1787] text-white border-[#0f1787]' : 'bg-white text-gray-500 border-gray-200'}`}
          >
            Ordenar por racha
          </button>
          <button
            onClick={() => setOrden('total')}
            className={`text-xs font-medium px-3 py-1.5 rounded-full border ${orden === 'total' ? 'bg-[#0f1787] text-white border-[#0f1787]' : 'bg-white text-gray-500 border-gray-200'}`}
          >
            Ordenar por total
          </button>
        </div>

        {error && (
          <div className="bg-red-50 border border-red-100 rounded-xl px-4 py-3 text-sm text-red-600 mb-4">
            {error}
          </div>
        )}

        {filasFiltradas.length === 0 ? (
          <div className="text-center text-gray-400 text-sm py-16">
            {filas.length === 0
              ? 'Todavía no hay servidores inscritos en este retiro.'
              : 'Sin resultados para esa búsqueda.'}
          </div>
        ) : (
          <div className="flex flex-col gap-2">
            {filasFiltradas.map(f => (
              <div key={f.id} className="bg-white rounded-2xl p-4 shadow-sm border border-gray-100 flex items-center justify-between">
                <p className="text-sm font-semibold text-gray-900">{f.nombre}</p>
                <div className="flex items-center gap-2 flex-shrink-0">
                  <span className="text-[10px] font-medium px-2 py-1 rounded-full bg-amber-50 text-amber-700">
                    🔥 {f.racha}
                  </span>
                  <span className="text-[10px] font-medium px-2 py-1 rounded-full bg-emerald-50 text-emerald-700">
                    {f.total} en total
                  </span>
                </div>
              </div>
            ))}
          </div>
        )}
      </main>
    </div>
  )
}
