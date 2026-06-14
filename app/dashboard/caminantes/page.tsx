'use client'
import { useEffect, useState, Suspense } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { supabase } from '@/lib/supabase'
import BottomNav from '@/components/BottomNav'
import { Search, SlidersHorizontal, Download, Plus, ArrowUpDown } from 'lucide-react'

type Caminante = {
  id: string; nombre: string; numero_documento: string
  celular: string; edad: number; talla_camiseta: string
  es_sorpresa: boolean; estado_correo: string
  total_pagado: number; saldo_pendiente: number
  estado_pago: 'completo' | 'parcial' | 'sin_pago'
  inscrito_oficialmente: boolean
  fecha_inscripcion?: string
  fecha_ultimo_pago?: string | null
}

type CaminanteSalud = {
  id: string; nombre: string; edad: number
  alergias: string | null
  restricciones_alimentarias: string | null
  medicamentos: string | null
  eps: string | null
}

type Orden = 'inscrito_reciente' | 'inscrito_primero' | 'pago_reciente' | 'pago_primero'

const FILTROS = [
  { key: 'todos', label: 'Todos' },
  { key: 'completo', label: 'Pago completo' },
  { key: 'parcial', label: 'Abono parcial' },
  { key: 'sin_pago', label: 'Sin pago' },
  { key: 'sorpresa', label: 'Sorpresa' },
  { key: 'sin_enviar', label: 'Sin correo' },
  { key: 'salud', label: '🏥 Salud' },
]

const ORDENES: { key: Orden; label: string; icono: string }[] = [
  { key: 'inscrito_reciente', label: 'Recién inscrito', icono: '🆕' },
  { key: 'inscrito_primero',  label: 'Primer inscrito',  icono: '🕐' },
  { key: 'pago_reciente',    label: 'Pago reciente',    icono: '💰' },
  { key: 'pago_primero',     label: 'Primer pago',      icono: '💸' },
]

function iniciales(nombre: string) {
  return nombre.split(' ').slice(0, 2).map(n => n[0]).join('').toUpperCase()
}

function fmt(n: number) { return `$${Number(n).toLocaleString('es-CO')}` }

function aplicarOrden(lista: Caminante[], orden: Orden): Caminante[] {
  return [...lista].sort((a, b) => {
    if (orden === 'inscrito_reciente') {
      return new Date(b.fecha_inscripcion ?? 0).getTime() - new Date(a.fecha_inscripcion ?? 0).getTime()
    }
    if (orden === 'inscrito_primero') {
      return new Date(a.fecha_inscripcion ?? 0).getTime() - new Date(b.fecha_inscripcion ?? 0).getTime()
    }
    if (orden === 'pago_reciente') {
      const fa = a.fecha_ultimo_pago ? new Date(a.fecha_ultimo_pago).getTime() : 0
      const fb = b.fecha_ultimo_pago ? new Date(b.fecha_ultimo_pago).getTime() : 0
      if (fa === 0 && fb === 0) return a.nombre.localeCompare(b.nombre)
      if (fa === 0) return 1
      if (fb === 0) return -1
      return fb - fa
    }
    if (orden === 'pago_primero') {
      const fa = a.fecha_ultimo_pago ? new Date(a.fecha_ultimo_pago).getTime() : 0
      const fb = b.fecha_ultimo_pago ? new Date(b.fecha_ultimo_pago).getTime() : 0
      if (fa === 0 && fb === 0) return a.nombre.localeCompare(b.nombre)
      if (fa === 0) return 1
      if (fb === 0) return -1
      return fa - fb
    }
    return 0
  })
}

function CaminantesContent() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const [caminantes, setCaminantes] = useState<Caminante[]>([])
  const [caminantesSalud, setCaminantesSalud] = useState<CaminanteSalud[]>([])
  const [filtro, setFiltro] = useState(searchParams.get('filtro') || 'todos')
  const [busqueda, setBusqueda] = useState('')
  const [orden, setOrden] = useState<Orden>('inscrito_reciente')
  const [mostrarOrden, setMostrarOrden] = useState(false)
  const [cupos, setCupos] = useState<any>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    async function cargar() {
      const { data: r } = await supabase.from('retiros').select('id').eq('estado', 'activo').single()
      if (!r) return

      const { data } = await supabase
        .from('vista_pagos_caminantes')
        .select('*')
        .eq('retiro_id', r.id)
        .order('fecha_inscripcion', { ascending: false })

      if (data) setCaminantes(data as Caminante[])

      const { data: c } = await supabase.from('vista_cupos').select('*').eq('retiro_id', r.id).single()
      setCupos(c)

      const { data: salud } = await supabase
        .from('caminantes')
        .select('id, nombre, edad, alergias, restricciones_alimentarias, medicamentos, eps')
        .eq('retiro_id', r.id)
        .or('alergias.not.is.null,restricciones_alimentarias.not.is.null,medicamentos.not.is.null')
        .order('nombre')
      if (salud) setCaminantesSalud(salud as CaminanteSalud[])

      setLoading(false)
    }
    cargar()
  }, [])

  useEffect(() => {
    if (!mostrarOrden) return
    const cerrar = () => setMostrarOrden(false)
    window.addEventListener('click', cerrar)
    return () => window.removeEventListener('click', cerrar)
  }, [mostrarOrden])

  const esSalud = filtro === 'salud'

  const filtrados = caminantes.filter(c => {
    const matchBusqueda = c.nombre.toLowerCase().includes(busqueda.toLowerCase()) || c.numero_documento.includes(busqueda)
    const matchFiltro = filtro === 'todos' ? true
      : filtro === 'sorpresa' ? c.es_sorpresa
      : filtro === 'sin_enviar' ? c.estado_correo === 'sin_enviar'
      : filtro === 'salud' ? true
      : c.estado_pago === filtro
    return matchBusqueda && matchFiltro
  })

  const ordenados = aplicarOrden(filtrados, orden)

  const saludFiltrados = caminantesSalud.filter(c =>
    c.nombre.toLowerCase().includes(busqueda.toLowerCase())
  )

  const pctCupo = cupos ? Math.round((cupos.caminantes_con_abono / 50) * 100) : 0

  const colorAvatar = (estado: string) =>
    estado === 'completo' ? { bg: '#dcfce7', color: '#166534' }
    : estado === 'parcial' ? { bg: '#fef3c7', color: '#92400e' }
    : { bg: '#f3f4f6', color: '#6b7280' }

  const ordenActual = ORDENES.find(o => o.key === orden)!

  return (
    <div style={{ background: '#f7f8fc', minHeight: '100vh', paddingBottom: 80 }}>

      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '18px 20px 14px' }}>
        <div style={{ fontSize: 17, fontWeight: 500, color: '#0d0d14' }}>Caminantes</div>
        <div style={{ display: 'flex', gap: 8 }}>
          <button style={{ width: 34, height: 34, borderRadius: '50%', background: '#fff', border: '0.5px solid #e5e7eb', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer' }}><SlidersHorizontal size={16} color="#6b7280" /></button>
          <button style={{ width: 34, height: 34, borderRadius: '50%', background: '#fff', border: '0.5px solid #e5e7eb', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer' }}><Download size={16} color="#6b7280" /></button>
        </div>
      </div>

      {/* Buscador + Ordenar */}
      <div style={{ padding: '0 20px 14px', display: 'flex', gap: 8, alignItems: 'center' }}>
        <div style={{ flex: 1, display: 'flex', alignItems: 'center', gap: 10, background: '#fff', border: '0.5px solid #e5e7eb', borderRadius: 12, padding: '10px 14px' }}>
          <Search size={16} color="#9ca3af" />
          <input
            value={busqueda}
            onChange={e => setBusqueda(e.target.value)}
            placeholder="Buscar por nombre o documento…"
            style={{ border: 'none', outline: 'none', fontSize: 14, color: '#0d0d14', background: 'transparent', flex: 1 }}
          />
        </div>

        {/* Botón ordenar */}
        <div style={{ position: 'relative' }}>
          <button
            onClick={e => { e.stopPropagation(); setMostrarOrden(v => !v) }}
            style={{
              height: 42,
              padding: '0 12px',
              borderRadius: 12,
              background: mostrarOrden || orden !== 'inscrito_reciente' ? '#0f1787' : '#fff',
              border: '0.5px solid #e5e7eb',
              display: 'flex',
              alignItems: 'center',
              gap: 6,
              cursor: 'pointer',
              whiteSpace: 'nowrap',
            }}
          >
            <ArrowUpDown size={15} color={mostrarOrden || orden !== 'inscrito_reciente' ? '#fff' : '#6b7280'} />
            <span style={{ fontSize: 14, color: mostrarOrden || orden !== 'inscrito_reciente' ? '#fff' : '#6b7280' }}>
              {ordenActual.icono}
            </span>
          </button>

          {/* Dropdown */}
          {mostrarOrden && (
            <div
              onClick={e => e.stopPropagation()}
              style={{
                position: 'absolute',
                top: 48,
                right: 0,
                background: '#fff',
                border: '0.5px solid #e5e7eb',
                borderRadius: 14,
                boxShadow: '0 8px 24px rgba(0,0,0,0.10)',
                zIndex: 50,
                minWidth: 200,
                overflow: 'hidden',
              }}
            >
              <div style={{ padding: '10px 14px 6px', fontSize: 11, fontWeight: 600, color: '#9ca3af', letterSpacing: '0.05em', textTransform: 'uppercase' }}>
                Ordenar por
              </div>
              {ORDENES.map((o, i) => (
                <button
                  key={o.key}
                  onClick={() => { setOrden(o.key); setMostrarOrden(false) }}
                  style={{
                    width: '100%',
                    padding: '10px 14px',
                    display: 'flex',
                    alignItems: 'center',
                    gap: 10,
                    background: orden === o.key ? '#f0f1ff' : 'transparent',
                    border: 'none',
                    borderTop: i === 2 ? '0.5px solid #f3f4f6' : 'none',
                    cursor: 'pointer',
                  }}
                >
                  <span style={{ fontSize: 16 }}>{o.icono}</span>
                  <span style={{ fontSize: 13, fontWeight: orden === o.key ? 600 : 400, color: orden === o.key ? '#0f1787' : '#374151' }}>
                    {o.label}
                  </span>
                  {orden === o.key && (
                    <span style={{ marginLeft: 'auto', width: 7, height: 7, borderRadius: '50%', background: '#0f1787' }} />
                  )}
                </button>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Filtros */}
      <div style={{ display: 'flex', gap: 8, padding: '0 20px 16px', overflowX: 'auto', scrollbarWidth: 'none' }}>
        {FILTROS.map(f => {
          const count = f.key === 'todos' ? caminantes.length
            : f.key === 'sorpresa' ? caminantes.filter(c => c.es_sorpresa).length
            : f.key === 'sin_enviar' ? caminantes.filter(c => c.estado_correo === 'sin_enviar').length
            : f.key === 'salud' ? caminantesSalud.length
            : caminantes.filter(c => c.estado_pago === f.key).length
          return (
            <button key={f.key} onClick={() => setFiltro(f.key)} style={{ padding: '6px 14px', borderRadius: 20, fontSize: 12, fontWeight: 500, whiteSpace: 'nowrap', cursor: 'pointer', border: '0.5px solid #e5e7eb', background: filtro === f.key ? '#0f1787' : '#fff', color: filtro === f.key ? '#fff' : '#6b7280' }}>
              {f.label} · {count}
            </button>
          )
        })}
      </div>

      {/* Cupos */}
      {cupos && (
        <div style={{ margin: '0 20px 16px', background: '#fff', borderRadius: 14, padding: '14px 16px', border: '0.5px solid #e5e7eb', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12 }}>
          <div style={{ flex: 1 }}>
            <div style={{ fontSize: 13, fontWeight: 500, color: '#0d0d14' }}>Cupos</div>
            <div style={{ fontSize: 11, color: '#9ca3af', marginTop: 2 }}>Bloqueo al llegar a 50</div>
            <div style={{ height: 4, background: '#f3f4f6', borderRadius: 2, marginTop: 8 }}>
              <div style={{ height: 4, borderRadius: 2, background: cupos.cupo_lleno ? '#dc2626' : '#d97706', width: `${Math.min(pctCupo, 100)}%` }} />
            </div>
          </div>
          <div style={{ textAlign: 'right' }}>
            <div style={{ fontSize: 22, fontWeight: 500, color: '#0d0d14' }}>{cupos.caminantes_con_abono}<span style={{ fontSize: 13, color: '#9ca3af', fontWeight: 400 }}>/50</span></div>
            <div style={{ fontSize: 11, fontWeight: 500, padding: '3px 10px', borderRadius: 20, background: cupos.cupo_lleno ? '#fee2e2' : '#fef3c7', color: cupos.cupo_lleno ? '#991b1b' : '#92400e', marginTop: 4 }}>
              {cupos.cupo_lleno ? '🔒 Cupo lleno' : `${cupos.cupos_disponibles} disponibles`}
            </div>
          </div>
        </div>
      )}

      {/* ── VISTA SALUD ── */}
      {esSalud ? (
        <div style={{ padding: '0 20px', display: 'flex', flexDirection: 'column', gap: 10 }}>
          {loading ? (
            <div style={{ textAlign: 'center', color: '#9ca3af', fontSize: 14, padding: 40 }}>Cargando...</div>
          ) : saludFiltrados.length === 0 ? (
            <div style={{ textAlign: 'center', color: '#9ca3af', fontSize: 14, padding: 40 }}>
              Ningún caminante tiene información médica registrada
            </div>
          ) : saludFiltrados.map(c => (
            <div key={c.id} onClick={() => router.push(`/dashboard/caminantes/${c.id}`)}
              style={{ background: '#fff', borderRadius: 14, padding: '16px', border: '0.5px solid #e5e7eb', cursor: 'pointer' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 12 }}>
                <div style={{ width: 36, height: 36, borderRadius: '50%', background: '#fef3c7', color: '#92400e', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 12, fontWeight: 600, flexShrink: 0 }}>
                  {iniciales(c.nombre)}
                </div>
                <div>
                  <div style={{ fontSize: 14, fontWeight: 500, color: '#0d0d14' }}>{c.nombre}</div>
                  <div style={{ fontSize: 11, color: '#9ca3af' }}>{c.edad} años</div>
                </div>
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                {c.alergias && (
                  <div style={{ display: 'flex', gap: 8, alignItems: 'flex-start' }}>
                    <span style={{ fontSize: 10, fontWeight: 600, padding: '2px 8px', borderRadius: 20, background: '#fee2e2', color: '#991b1b', whiteSpace: 'nowrap', marginTop: 1 }}>Alergias</span>
                    <span style={{ fontSize: 13, color: '#374151', lineHeight: 1.5 }}>{c.alergias}</span>
                  </div>
                )}
                {c.restricciones_alimentarias && (
                  <div style={{ display: 'flex', gap: 8, alignItems: 'flex-start' }}>
                    <span style={{ fontSize: 10, fontWeight: 600, padding: '2px 8px', borderRadius: 20, background: '#fef3c7', color: '#92400e', whiteSpace: 'nowrap', marginTop: 1 }}>Alimentación</span>
                    <span style={{ fontSize: 13, color: '#374151', lineHeight: 1.5 }}>{c.restricciones_alimentarias}</span>
                  </div>
                )}
                {c.medicamentos && (
                  <div style={{ display: 'flex', gap: 8, alignItems: 'flex-start' }}>
                    <span style={{ fontSize: 10, fontWeight: 600, padding: '2px 8px', borderRadius: 20, background: '#ede9fe', color: '#5b21b6', whiteSpace: 'nowrap', marginTop: 1 }}>Medicamentos</span>
                    <span style={{ fontSize: 13, color: '#374151', lineHeight: 1.5 }}>{c.medicamentos}</span>
                  </div>
                )}
                {c.eps && (
                  <div style={{ display: 'flex', gap: 8, alignItems: 'flex-start' }}>
                    <span style={{ fontSize: 10, fontWeight: 600, padding: '2px 8px', borderRadius: 20, background: '#dbeafe', color: '#1e40af', whiteSpace: 'nowrap', marginTop: 1 }}>EPS</span>
                    <span style={{ fontSize: 13, color: '#374151', lineHeight: 1.5 }}>{c.eps}</span>
                  </div>
                )}
              </div>
            </div>
          ))}
        </div>
      ) : (
        /* ── VISTA NORMAL ── */
        <div style={{ padding: '0 20px', display: 'flex', flexDirection: 'column', gap: 8 }}>
          {loading ? (
            <div style={{ textAlign: 'center', color: '#9ca3af', fontSize: 14, padding: 40 }}>Cargando...</div>
          ) : ordenados.length === 0 ? (
            <div style={{ textAlign: 'center', color: '#9ca3af', fontSize: 14, padding: 40 }}>Sin resultados</div>
          ) : ordenados.map(c => {
            const av = colorAvatar(c.estado_pago)
            return (
              <div key={c.id} onClick={() => router.push(`/dashboard/caminantes/${c.id}`)} style={{ background: '#fff', borderRadius: 14, padding: '14px 16px', display: 'flex', alignItems: 'center', gap: 12, border: '0.5px solid #e5e7eb', cursor: 'pointer' }}>
                <div style={{ width: 38, height: 38, borderRadius: '50%', background: av.bg, color: av.color, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 13, fontWeight: 500, flexShrink: 0 }}>
                  {iniciales(c.nombre)}
                </div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: 14, fontWeight: 500, color: '#0d0d14', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{c.nombre}</div>
                  <div style={{ fontSize: 11, color: '#9ca3af', marginTop: 2 }}>{c.edad} años · {c.talla_camiseta}</div>
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 4, flexShrink: 0 }}>
                  {c.es_sorpresa && <div style={{ fontSize: 10, fontWeight: 500, padding: '2px 7px', borderRadius: 20, background: '#ede9fe', color: '#5b21b6' }}>Sorpresa</div>}
                  <div style={{ fontSize: 12, fontWeight: 500, color: c.estado_pago === 'completo' ? '#166534' : c.estado_pago === 'parcial' ? '#d97706' : '#9ca3af' }}>{fmt(c.total_pagado)}</div>
                </div>
              </div>
            )
          })}
        </div>
      )}

      {cupos && !cupos.cupo_lleno && (
        <button onClick={() => router.push('/dashboard/caminantes/nuevo')} style={{ position: 'fixed', bottom: 80, left: 20, right: 20, background: '#0f1787', color: '#fff', border: 'none', borderRadius: 14, padding: 14, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8, fontSize: 14, fontWeight: 500, cursor: 'pointer' }}>
          <Plus size={18} /> Registrar caminante
        </button>
      )}
      <BottomNav />
    </div>
  )
}

export default function CaminantesPage() {
  return (
    <Suspense fallback={<div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: '100vh' }}><div style={{ color: '#9ca3af' }}>Cargando...</div></div>}>
      <CaminantesContent />
    </Suspense>
  )
}
