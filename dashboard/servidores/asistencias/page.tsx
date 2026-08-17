'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'
import { useRetiroActual } from '@/lib/retiro-context'

interface Servidor {
  id: string
  nombre: string
  usuario_id: string | null
}

interface Reunion {
  id: string
  nombre: string
  fecha: string
  cancelada: boolean
}

interface FilaServidor {
  id: string
  nombre: string
  total: number
  racha: number
}

interface Alerta {
  id: string
  foto_url: string | null
  fecha_registro: string
  motivo_alerta: string
  fuera_de_horario: boolean
  asistio?: boolean
  servidor_inscripcion: { nombre: string } | null
  reunion: { nombre: string; fecha: string } | null
}

type Orden = 'total' | 'racha'
type Tab = 'resumen' | 'marcar' | 'alertas' | 'fotos'

export default function AsistenciasServidoresPage() {
  const router = useRouter()
  const { id: RETIRO_ID } = useRetiroActual()
  const [tab, setTab] = useState<Tab>('resumen')
  const [servidores, setServidores] = useState<Servidor[]>([])
  const [reuniones, setReuniones] = useState<Reunion[]>([])
  const [asistenciaMap, setAsistenciaMap] = useState<Map<string, Map<string, boolean>>>(new Map())
  const [loading, setLoading] = useState(true)
  const [busqueda, setBusqueda] = useState('')
  const [orden, setOrden] = useState<Orden>('racha')
  const [error, setError] = useState('')

  const [reunionSeleccionada, setReunionSeleccionada] = useState<string>('')
  const [guardando, setGuardando] = useState<string | null>(null)

  const [alertas, setAlertas] = useState<Alerta[]>([])
  const [todas, setTodas] = useState<Alerta[]>([])
  const [imagenAmpliada, setImagenAmpliada] = useState<Alerta | null>(null)

  useEffect(() => {
    const verificar = async () => {
      const { data: { session } } = await supabase.auth.getSession()
      if (!session) { router.push('/'); return }

      const { data: usuario } = await supabase
        .from('usuarios')
        .select('rol')
        .eq('id', session.user.id)
        .maybeSingle()

      if (usuario?.rol !== 'lider') { router.push('/servidor'); return }

      await Promise.all([cargar(), cargarFotos()])
    }
    verificar()
  }, [])

  async function cargarFotos() {
    const [{ data: alts }, { data: tod }] = await Promise.all([
      supabase
        .from('asistencias')
        .select(`
          id, foto_url, fecha_registro, motivo_alerta, fuera_de_horario,
          servidor_inscripcion:servidor_inscripcion_id(nombre),
          reunion:reunion_id!inner(nombre, fecha, retiro_id)
        `)
        .eq('fuera_de_horario', true)
        .eq('reunion.retiro_id', RETIRO_ID)
        .order('fecha_registro', { ascending: false }),
      supabase
        .from('asistencias')
        .select(`
          id, foto_url, fecha_registro, motivo_alerta, fuera_de_horario, asistio,
          servidor_inscripcion:servidor_inscripcion_id(nombre),
          reunion:reunion_id!inner(nombre, fecha, retiro_id)
        `)
        .eq('reunion.retiro_id', RETIRO_ID)
        .order('fecha_registro', { ascending: false })
        .limit(100),
    ])
    setAlertas((alts || []) as unknown as Alerta[])
    setTodas((tod || []) as unknown as Alerta[])
  }

  const fmtFecha = (iso: string) =>
    new Date(iso).toLocaleString('es-CO', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })

  async function cargar() {
    setLoading(true)
    setError('')
    try {
      const hoy = new Date().toISOString().split('T')[0]
      const [{ data: servidoresData, error: errServidores }, { data: reunionesData, error: errReuniones }] = await Promise.all([
        supabase.from('servidores_inscripcion').select('id, nombre, usuario_id').eq('retiro_id', RETIRO_ID).order('nombre', { ascending: true }),
        supabase.from('reuniones').select('id, nombre, fecha, cancelada').eq('retiro_id', RETIRO_ID).lte('fecha', hoy).order('fecha', { ascending: false }),
      ])

      if (errServidores) throw errServidores
      if (errReuniones) throw errReuniones

      const reunionIds = (reunionesData ?? []).map(r => r.id)
      const { data: asistencias, error: errAsistencias } = await supabase
        .from('asistencias')
        .select('servidor_inscripcion_id, reunion_id, asistio, fuera_de_horario')
        .in('reunion_id', reunionIds.length > 0 ? reunionIds : ['00000000-0000-0000-0000-000000000000'])

      if (errAsistencias) throw errAsistencias

      const mapaConteo = new Map<string, Map<string, { asistio: boolean; fuera_de_horario: boolean }>>()
      const mapaSimple = new Map<string, Map<string, boolean>>()
      for (const a of asistencias ?? []) {
        if (!mapaConteo.has(a.servidor_inscripcion_id)) mapaConteo.set(a.servidor_inscripcion_id, new Map())
        mapaConteo.get(a.servidor_inscripcion_id)!.set(a.reunion_id, { asistio: a.asistio, fuera_de_horario: a.fuera_de_horario })

        if (!mapaSimple.has(a.servidor_inscripcion_id)) mapaSimple.set(a.servidor_inscripcion_id, new Map())
        mapaSimple.get(a.servidor_inscripcion_id)!.set(a.reunion_id, a.asistio)
      }

      setServidores((servidoresData ?? []) as Servidor[])
      setReuniones((reunionesData ?? []) as Reunion[])
      setAsistenciaMap(mapaSimple)
      if (reunionesData && reunionesData.length > 0) setReunionSeleccionada(reunionesData[0].id)

      setFilasDesde(mapaConteo, (servidoresData ?? []) as Servidor[], (reunionesData ?? []) as Reunion[])
    } catch (err) {
      console.error('Error cargando asistencias:', err)
      setError('No se pudieron cargar las asistencias.')
    } finally {
      setLoading(false)
    }
  }

  const [filas, setFilas] = useState<FilaServidor[]>([])

  function setFilasDesde(
    mapaConteo: Map<string, Map<string, { asistio: boolean; fuera_de_horario: boolean }>>,
    servidoresLista: Servidor[],
    reunionesLista: Reunion[]
  ) {
    const lista: FilaServidor[] = servidoresLista.map(s => {
      const asistMap = mapaConteo.get(s.id) ?? new Map()
      let total = 0
      let racha = 0
      let rachaActiva = true
      for (const r of reunionesLista) {
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
  }

  async function marcarAsistencia(servidor: Servidor, valor: boolean) {
    if (!reunionSeleccionada) return
    const clave = `${servidor.id}-${reunionSeleccionada}`
    setGuardando(clave)

    const { error: errMarcar } = await supabase
      .from('asistencias')
      .upsert({
        servidor_inscripcion_id: servidor.id,
        usuario_id: servidor.usuario_id,
        reunion_id: reunionSeleccionada,
        asistio: valor,
        fuera_de_horario: false,
        fecha_registro: new Date().toISOString(),
      }, { onConflict: 'servidor_inscripcion_id,reunion_id' })

    if (errMarcar) {
      console.error('Error marcando asistencia:', errMarcar)
      setError('No se pudo guardar. Intenta de nuevo.')
    } else {
      setAsistenciaMap(prev => {
        const next = new Map(prev)
        const inner = new Map(next.get(servidor.id) ?? [])
        inner.set(reunionSeleccionada, valor)
        next.set(servidor.id, inner)
        return next
      })
    }
    setGuardando(null)
  }

  const filasFiltradas = filas
    .filter(f => {
      const termino = busqueda.trim().toLowerCase()
      if (!termino) return true
      return f.nombre.toLowerCase().includes(termino)
    })
    .sort((a, b) => b[orden] - a[orden])

  const servidoresFiltrados = servidores.filter(s => {
    const termino = busqueda.trim().toLowerCase()
    if (!termino) return true
    return s.nombre.toLowerCase().includes(termino)
  })

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

        <div className="flex bg-white rounded-xl border border-gray-200 p-1 mb-4 gap-1 overflow-x-auto">
          <button
            onClick={() => setTab('resumen')}
            className={`flex-1 whitespace-nowrap text-sm font-medium py-2 px-2 rounded-lg ${tab === 'resumen' ? 'bg-[#0f1787] text-white' : 'text-gray-500'}`}
          >
            Resumen
          </button>
          <button
            onClick={() => setTab('marcar')}
            className={`flex-1 whitespace-nowrap text-sm font-medium py-2 px-2 rounded-lg ${tab === 'marcar' ? 'bg-[#0f1787] text-white' : 'text-gray-500'}`}
          >
            Marcar
          </button>
          <button
            onClick={() => setTab('alertas')}
            className={`flex-1 whitespace-nowrap text-sm font-medium py-2 px-2 rounded-lg relative ${tab === 'alertas' ? 'bg-[#0f1787] text-white' : 'text-gray-500'}`}
          >
            Alertas
            {alertas.length > 0 && (
              <span className="ml-1 bg-red-600 text-white rounded-full text-[10px] px-1.5 py-0.5">
                {alertas.length}
              </span>
            )}
          </button>
          <button
            onClick={() => setTab('fotos')}
            className={`flex-1 whitespace-nowrap text-sm font-medium py-2 px-2 rounded-lg ${tab === 'fotos' ? 'bg-[#0f1787] text-white' : 'text-gray-500'}`}
          >
            Fotos
          </button>
        </div>

        {(tab === 'resumen' || tab === 'marcar') && (
          <input
            type="text"
            value={busqueda}
            onChange={e => setBusqueda(e.target.value)}
            placeholder="Buscar por nombre…"
            className="w-full h-11 rounded-xl border border-gray-200 bg-white px-4 text-sm text-gray-900 outline-none focus:border-[#0f1787] mb-3"
          />
        )}

        {error && (
          <div className="bg-red-50 border border-red-100 rounded-xl px-4 py-3 text-sm text-red-600 mb-4">
            {error}
          </div>
        )}

        {tab === 'resumen' && (
          <>
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
          </>
        )}

        {tab === 'marcar' && (
          <>
            {reuniones.length === 0 ? (
              <div className="text-center text-gray-400 text-sm py-16">
                Todavía no hay reuniones registradas para este retiro.
              </div>
            ) : (
              <>
                <select
                  value={reunionSeleccionada}
                  onChange={e => setReunionSeleccionada(e.target.value)}
                  className="w-full h-11 rounded-xl border border-gray-200 bg-white px-4 text-sm text-gray-900 outline-none focus:border-[#0f1787] mb-4"
                >
                  {reuniones.map(r => (
                    <option key={r.id} value={r.id}>
                      {r.nombre} · {new Date(r.fecha + 'T12:00:00').toLocaleDateString('es-CO', { day: 'numeric', month: 'short', year: 'numeric' })}
                      {r.cancelada ? ' (cancelada)' : ''}
                    </option>
                  ))}
                </select>

                <div className="flex flex-col gap-2">
                  {servidoresFiltrados.map(s => {
                    const valor = asistenciaMap.get(s.id)?.get(reunionSeleccionada)
                    const clave = `${s.id}-${reunionSeleccionada}`
                    const ocupado = guardando === clave
                    return (
                      <div key={s.id} className="bg-white rounded-2xl p-4 shadow-sm border border-gray-100 flex items-center justify-between gap-3">
                        <p className="text-sm font-semibold text-gray-900 flex-1 min-w-0 truncate">{s.nombre}</p>
                        <div className="flex gap-2 flex-shrink-0">
                          <button
                            disabled={ocupado}
                            onClick={() => marcarAsistencia(s, true)}
                            className={`text-xs font-medium px-3 py-1.5 rounded-full border ${valor === true ? 'bg-emerald-600 text-white border-emerald-600' : 'bg-white text-gray-500 border-gray-200'}`}
                          >
                            Asistió
                          </button>
                          <button
                            disabled={ocupado}
                            onClick={() => marcarAsistencia(s, false)}
                            className={`text-xs font-medium px-3 py-1.5 rounded-full border ${valor === false ? 'bg-red-600 text-white border-red-600' : 'bg-white text-gray-500 border-gray-200'}`}
                          >
                            No asistió
                          </button>
                        </div>
                      </div>
                    )
                  })}
                </div>
              </>
            )}
          </>
        )}

        {tab === 'alertas' && (
          alertas.length === 0 ? (
            <div className="text-center text-gray-400 text-sm py-16">
              ✅ No hay asistencias fuera de horario
            </div>
          ) : (
            <div className="flex flex-col gap-3">
              {alertas.map(a => (
                <div key={a.id} className="bg-white rounded-2xl p-4 shadow-sm border-[1.5px] border-amber-300">
                  <div className="mb-2">
                    <span className="text-xs font-bold text-amber-800 bg-amber-100 px-2.5 py-0.5 rounded-full">
                      ⚠️ Fuera de horario
                    </span>
                    <p className="text-sm font-semibold text-gray-900 mt-1.5">
                      👤 {a.servidor_inscripcion?.nombre || 'Servidor'}
                    </p>
                    <p className="text-xs text-gray-500 mt-0.5">
                      📅 {a.reunion?.nombre || '—'} · {a.reunion?.fecha ? new Date(a.reunion.fecha + 'T12:00:00').toLocaleDateString('es-CO', { day: 'numeric', month: 'long' }) : '—'}
                    </p>
                    <p className="text-[11px] text-gray-400 mt-0.5">
                      🕐 {fmtFecha(a.fecha_registro)}
                    </p>
                  </div>
                  {a.motivo_alerta && (
                    <div className="bg-amber-50 rounded-lg px-3 py-2 mb-3 text-xs text-amber-800">
                      {a.motivo_alerta}
                    </div>
                  )}
                  {a.foto_url && (
                    <img
                      src={a.foto_url}
                      alt="foto asistencia"
                      onClick={() => setImagenAmpliada(a)}
                      className="w-full max-h-48 object-cover rounded-lg cursor-pointer"
                    />
                  )}
                </div>
              ))}
            </div>
          )
        )}

        {tab === 'fotos' && (
          todas.length === 0 ? (
            <div className="text-center text-gray-400 text-sm py-16">
              Sin asistencias registradas aún
            </div>
          ) : (
            <div className="flex flex-col gap-2">
              {todas.map(a => (
                <div key={a.id} className={`bg-white rounded-2xl px-4 py-3 border-[1.5px] flex items-center gap-3 ${a.fuera_de_horario ? 'border-amber-300' : 'border-gray-100'}`}>
                  {a.foto_url ? (
                    <img
                      src={a.foto_url}
                      alt="foto"
                      onClick={() => setImagenAmpliada(a)}
                      className="w-12 h-12 rounded-lg object-cover cursor-pointer flex-shrink-0"
                    />
                  ) : (
                    <div className="w-12 h-12 rounded-lg bg-gray-100 flex items-center justify-center flex-shrink-0 text-xl">
                      📸
                    </div>
                  )}
                  <div className="flex-1 min-w-0">
                    <div className="text-sm font-semibold text-gray-900 truncate">
                      {a.servidor_inscripcion?.nombre || 'Servidor'}
                    </div>
                    <div className="text-xs text-gray-500 mt-0.5">{a.reunion?.nombre || '—'}</div>
                    <div className="text-[11px] text-gray-400 mt-0.5">{fmtFecha(a.fecha_registro)}</div>
                  </div>
                  <div className="flex-shrink-0">
                    {a.fuera_de_horario ? (
                      <span className="text-[11px] font-semibold bg-amber-100 text-amber-800 px-2 py-0.5 rounded-full">⚠️ Fuera</span>
                    ) : (
                      <span className="text-[11px] font-semibold bg-emerald-50 text-emerald-700 px-2 py-0.5 rounded-full">✅ Normal</span>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )
        )}
      </main>

      {imagenAmpliada && (
        <div
          onClick={() => setImagenAmpliada(null)}
          className="fixed inset-0 bg-black/90 z-[100] flex flex-col items-center justify-center p-5"
        >
          <img
            src={imagenAmpliada.foto_url!}
            alt="foto"
            className="max-w-full max-h-[75vh] rounded-xl object-contain"
            onClick={e => e.stopPropagation()}
          />
          <div className="mt-3 text-center">
            <p className="text-white text-sm font-semibold">{imagenAmpliada.servidor_inscripcion?.nombre}</p>
            <p className="text-white/50 text-xs mt-1">
              {imagenAmpliada.reunion?.nombre} · {fmtFecha(imagenAmpliada.fecha_registro)}
            </p>
          </div>
          <p className="text-white/30 text-xs mt-4">Toca fuera para cerrar</p>
        </div>
      )}
    </div>
  )
}
