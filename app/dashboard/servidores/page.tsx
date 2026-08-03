'use client'
import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'
import BottomNav from '@/components/BottomNav'
import { Search, Plus, ChevronDown, ChevronUp } from 'lucide-react'

type Servidor = {
  id: string
  nombre: string
  numero_documento: string
  celular: string
  edad: number
  talla_camiseta: string
  estado_correo: string
  total_pagado: number
  saldo_pendiente: number
  estado_pago: 'completo' | 'parcial' | 'sin_pago'
  inscrito_oficialmente: boolean
  es_interno: boolean
  fecha_inscripcion?: string
}

const FILTROS = [
  { key: 'todos', label: 'Todos' },
  { key: 'por_confirmar', label: 'Por confirmar' },
  { key: 'completo', label: 'Pago completo' },
  { key: 'parcial', label: 'Abono parcial' },
  { key: 'sin_pago', label: 'Sin pago' },
]

function iniciales(nombre: string) {
  return nombre.split(' ').slice(0, 2).map(n => n[0]).join('').toUpperCase()
}

function fmt(n: number) { return `$${Number(n).toLocaleString('es-CO')}` }

function BadgeTipo({ id, esInterno, onChange }: { id: string; esInterno: boolean; onChange: (nuevoValor: boolean) => void }) {
  const [abierto, setAbierto] = useState(false)
  const [cargando, setCargando] = useState(false)

  const opciones = [
    { valor: true, label: 'Interno', bg: '#eff6ff', color: '#1d4ed8' },
    { valor: false, label: 'Externo', bg: '#f3f4f6', color: '#6b7280' },
  ]
  const actual = opciones.find(o => o.valor === esInterno)!

  async function cambiar(nuevoValor: boolean) {
    if (nuevoValor === esInterno) { setAbierto(false); return }
    setCargando(true)
    try {
      const res = await fetch(`/api/servidores/${id}/tipo`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ es_interno: nuevoValor }),
      })
      if (res.ok) onChange(nuevoValor)
    } finally {
      setCargando(false)
      setAbierto(false)
    }
  }

  return (
    <div style={{ position: 'relative' }}>
      <button
        onClick={e => { e.stopPropagation(); setAbierto(v => !v) }}
        disabled={cargando}
        style={{ display: 'inline-flex', alignItems: 'center', gap: 4, padding: '3px 10px', borderRadius: 20, fontSize: 11, fontWeight: 500, background: actual.bg, color: actual.color, border: 'none', cursor: 'pointer', opacity: cargando ? 0.5 : 1 }}
      >
        {cargando ? '...' : actual.label}
        {!cargando && (
          <svg width="10" height="10" viewBox="0 0 20 20" fill="currentColor">
            <path fillRule="evenodd" d="M5.23 7.21a.75.75 0 011.06.02L10 11.168l3.71-3.938a.75.75 0 111.08 1.04l-4.25 4.5a.75.75 0 01-1.08 0l-4.25-4.5a.75.75 0 01.02-1.06z" clipRule="evenodd" />
          </svg>
        )}
      </button>
      {abierto && (
        <>
          <div style={{ position: 'fixed', inset: 0, zIndex: 10 }} onClick={e => { e.stopPropagation(); setAbierto(false) }} />
          <div style={{ position: 'absolute', right: 0, top: '110%', zIndex: 20, background: '#fff', borderRadius: 10, boxShadow: '0 4px 16px rgba(0,0,0,0.10)', border: '0.5px solid #e5e7eb', padding: '4px 0', minWidth: 110 }}>
            {opciones.map(op => (
              <button key={String(op.valor)} onClick={e => { e.stopPropagation(); cambiar(op.valor) }}
                style={{ width: '100%', textAlign: 'left', padding: '8px 14px', fontSize: 12, fontWeight: op.valor === esInterno ? 600 : 400, color: op.valor === esInterno ? '#0f1787' : '#374151', background: 'none', border: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 8 }}>
                <span style={{ width: 7, height: 7, borderRadius: '50%', flexShrink: 0, background: op.valor === esInterno ? '#0f1787' : 'transparent', border: op.valor === esInterno ? 'none' : '1.5px solid #d1d5db' }} />
                {op.label}
              </button>
            ))}
          </div>
        </>
      )}
    </div>
  )
}

export default function ServidoresPage() {
  const router = useRouter()
  const [servidores, setServidores] = useState<Servidor[]>([])
  const [idsConPendiente, setIdsConPendiente] = useState<Set<string>>(new Set())
  const [filtro, setFiltro] = useState('todos')
  const [busqueda, setBusqueda] = useState('')
  const [loading, setLoading] = useState(true)
  const [mostrarExternos, setMostrarExternos] = useState(false)

  useEffect(() => {
    async function cargar() {
      const { data: r } = await supabase.from('retiros').select('id').eq('estado', 'activo').single()
      if (!r) return

      const [{ data }, { data: pagosPendientes }] = await Promise.all([
        supabase.from('vista_pagos_servidores').select('*').eq('retiro_id', r.id).order('nombre'),
        supabase.from('pagos').select('persona_id').eq('retiro_id', r.id).eq('tipo_persona', 'servidor').eq('estado', 'pendiente'),
      ])

      if (data) setServidores(data as Servidor[])
      if (pagosPendientes) {
        setIdsConPendiente(new Set(pagosPendientes.map(p => p.persona_id)))
      }
      setLoading(false)
    }
    cargar()
  }, [])

  function cambiarTipo(id: string, nuevoInterno: boolean) {
    setServidores(prev => prev.map(s => s.id === id ? { ...s, es_interno: nuevoInterno } : s))
  }

  const internos = servidores.filter(s => s.es_interno)
  const externos = servidores.filter(s => !s.es_interno)

  const aplicarFiltros = (lista: Servidor[]) => lista.filter(s => {
    const matchBusqueda = s.nombre.toLowerCase().includes(busqueda.toLowerCase()) || s.numero_documento.includes(busqueda)
    const matchFiltro =
      filtro === 'todos' ? true :
      filtro === 'por_confirmar' ? idsConPendiente.has(s.id) :
      s.estado_pago === filtro
    return matchBusqueda && matchFiltro
  })

  const internosFiltrados = aplicarFiltros(internos)
  const externosFiltrados = aplicarFiltros(externos)

  const totalConPendiente = servidores.filter(s => idsConPendiente.has(s.id)).length

  const colorAvatar = (estado: string) =>
    estado === 'completo' ? { bg: '#dcfce7', color: '#166534' }
    : estado === 'parcial' ? { bg: '#fef3c7', color: '#92400e' }
    : { bg: '#f3f4f6', color: '#6b7280' }

  const totalInternos = internos.length
  const pagadosInternos = internos.filter(s => s.estado_pago === 'completo').length

  const CardServidor = ({ s }: { s: Servidor }) => {
    const av = colorAvatar(s.estado_pago)
    const tienePendiente = idsConPendiente.has(s.id)
    return (
      <div
        onClick={() => router.push(`/dashboard/servidores/${s.id}`)}
        style={{ background: tienePendiente ? '#fffbeb' : '#fff', borderRadius: 14, padding: '14px 16px', display: 'flex', alignItems: 'center', gap: 12, border: tienePendiente ? '1px solid #fde68a' : '0.5px solid #e5e7eb', cursor: 'pointer', position: 'relative' }}
      >
        {/* Badge pendiente */}
        {tienePendiente && (
          <div style={{ position: 'absolute', top: -6, right: 12, background: '#d97706', color: '#fff', fontSize: 10, fontWeight: 700, borderRadius: 20, padding: '2px 8px' }}>
            Verificar pago
          </div>
        )}
        <div style={{ width: 38, height: 38, borderRadius: '50%', background: tienePendiente ? '#fef3c7' : av.bg, color: tienePendiente ? '#92400e' : av.color, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 13, fontWeight: 500, flexShrink: 0 }}>
          {iniciales(s.nombre)}
        </div>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontSize: 14, fontWeight: 500, color: '#0d0d14', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{s.nombre}</div>
          <div style={{ fontSize: 11, color: '#9ca3af', marginTop: 2 }}>{s.edad} años · {s.talla_camiseta}</div>
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 6, flexShrink: 0 }}>
          <BadgeTipo id={s.id} esInterno={s.es_interno} onChange={v => cambiarTipo(s.id, v)} />
          <div style={{ fontSize: 12, fontWeight: 500, color: s.estado_pago === 'completo' ? '#166534' : s.estado_pago === 'parcial' ? '#d97706' : '#9ca3af' }}>
            {fmt(s.total_pagado)}
          </div>
        </div>
      </div>
    )
  }

  const CardExterno = ({ s }: { s: Servidor }) => {
    const tienePendiente = idsConPendiente.has(s.id)
    return (
      <div
        onClick={() => router.push(`/dashboard/servidores/${s.id}`)}
        style={{ background: tienePendiente ? '#fffbeb' : '#fff', borderRadius: 14, padding: '14px 16px', display: 'flex', alignItems: 'center', gap: 12, border: tienePendiente ? '1px solid #fde68a' : '0.5px solid #e5e7eb', cursor: 'pointer', opacity: tienePendiente ? 1 : 0.8, position: 'relative' }}
      >
        {tienePendiente && (
          <div style={{ position: 'absolute', top: -6, right: 12, background: '#d97706', color: '#fff', fontSize: 10, fontWeight: 700, borderRadius: 20, padding: '2px 8px' }}>
            Verificar pago
          </div>
        )}
        <div style={{ width: 38, height: 38, borderRadius: '50%', background: '#f3f4f6', color: '#6b7280', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 13, fontWeight: 500, flexShrink: 0 }}>
          {iniciales(s.nombre)}
        </div>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontSize: 14, fontWeight: 500, color: '#0d0d14', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{s.nombre}</div>
          <div style={{ fontSize: 11, color: '#9ca3af', marginTop: 2 }}>{s.edad} años · {s.talla_camiseta}</div>
        </div>
        <BadgeTipo id={s.id} esInterno={s.es_interno} onChange={v => cambiarTipo(s.id, v)} />
      </div>
    )
  }

  return (
    <div style={{ background: '#f7f8fc', minHeight: '100vh', paddingBottom: 100 }}>

      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '18px 20px 14px' }}>
        <div style={{ fontSize: 17, fontWeight: 500, color: '#0d0d14' }}>Servidores</div>
        {totalConPendiente > 0 && (
          <div style={{ background: '#d97706', color: '#fff', fontSize: 11, fontWeight: 700, borderRadius: 20, padding: '4px 12px' }}>
            {totalConPendiente} por verificar
          </div>
        )}
      </div>

      {/* Buscador */}
      <div style={{ padding: '0 20px 14px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, background: '#fff', border: '0.5px solid #e5e7eb', borderRadius: 12, padding: '10px 14px' }}>
          <Search size={16} color="#9ca3af" />
          <input value={busqueda} onChange={e => setBusqueda(e.target.value)} placeholder="Buscar por nombre o documento…"
            style={{ border: 'none', outline: 'none', fontSize: 14, color: '#0d0d14', background: 'transparent', flex: 1 }} />
        </div>
      </div>

      {/* Filtros */}
      <div style={{ display: 'flex', gap: 8, padding: '0 20px 16px', overflowX: 'auto', scrollbarWidth: 'none' }}>
        {FILTROS.map(f => {
          const count =
            f.key === 'todos' ? internos.length :
            f.key === 'por_confirmar' ? totalConPendiente :
            internos.filter(s => s.estado_pago === f.key).length

          const isActive = filtro === f.key
          const isPorConfirmar = f.key === 'por_confirmar'

          return (
            <button key={f.key} onClick={() => setFiltro(f.key)} style={{
              padding: '6px 14px', borderRadius: 20, fontSize: 12, fontWeight: 500,
              whiteSpace: 'nowrap', cursor: 'pointer', border: isPorConfirmar && !isActive ? '1px solid #fde68a' : '0.5px solid #e5e7eb',
              background: isActive ? (isPorConfirmar ? '#d97706' : '#0f1787') : (isPorConfirmar && totalConPendiente > 0 ? '#fffbeb' : '#fff'),
              color: isActive ? '#fff' : (isPorConfirmar && totalConPendiente > 0 ? '#92400e' : '#6b7280'),
              display: 'flex', alignItems: 'center', gap: 5
            }}>
              {isPorConfirmar && totalConPendiente > 0 && !isActive && (
                <span style={{ width: 6, height: 6, borderRadius: '50%', background: '#d97706', display: 'inline-block' }} />
              )}
              {f.label} · {count}
            </button>
          )
        })}
      </div>

      {/* Barra progreso internos */}
      <div style={{ margin: '0 20px 16px', background: '#fff', borderRadius: 14, padding: '14px 16px', border: '0.5px solid #e5e7eb', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12 }}>
        <div style={{ flex: 1 }}>
          <div style={{ fontSize: 13, fontWeight: 500, color: '#0d0d14' }}>Servidores internos</div>
          <div style={{ fontSize: 11, color: '#9ca3af', marginTop: 2 }}>Pago $380.000</div>
          <div style={{ height: 4, background: '#f3f4f6', borderRadius: 2, marginTop: 8 }}>
            <div style={{ height: 4, borderRadius: 2, background: '#0f1787', width: `${Math.min((pagadosInternos / (totalInternos || 1)) * 100, 100)}%` }} />
          </div>
        </div>
        <div style={{ textAlign: 'right' }}>
          <div style={{ fontSize: 22, fontWeight: 500, color: '#0d0d14' }}>{pagadosInternos}<span style={{ fontSize: 13, color: '#9ca3af', fontWeight: 400 }}>/{totalInternos}</span></div>
          <div style={{ fontSize: 11, color: '#9ca3af', marginTop: 4 }}>pago completo</div>
        </div>
      </div>

      <div style={{ padding: '0 20px', display: 'flex', flexDirection: 'column', gap: 8 }}>
        {loading ? (
          <div style={{ textAlign: 'center', color: '#9ca3af', fontSize: 14, padding: 40 }}>Cargando...</div>
        ) : (
          <>
            {internosFiltrados.length === 0 && filtro !== 'por_confirmar' ? (
              <div style={{ textAlign: 'center', color: '#9ca3af', fontSize: 14, padding: 20 }}>Sin resultados</div>
            ) : internosFiltrados.map(s => <CardServidor key={s.id} s={s} />)}

            {/* Mensaje especial filtro por_confirmar vacío */}
            {filtro === 'por_confirmar' && totalConPendiente === 0 && (
              <div style={{ textAlign: 'center', color: '#9ca3af', fontSize: 14, padding: 40 }}>
                <div style={{ fontSize: 32, marginBottom: 8 }}>✓</div>
                Sin comprobantes pendientes de verificar
              </div>
            )}

            {/* Externos */}
            {externosFiltrados.length > 0 && (
              <div style={{ marginTop: 8 }}>
                <button
                  onClick={() => setMostrarExternos(v => !v)}
                  style={{ width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '12px 16px', background: '#fff', borderRadius: 14, border: '0.5px solid #e5e7eb', cursor: 'pointer', marginBottom: mostrarExternos ? 8 : 0 }}>
                  <div>
                    <div style={{ fontSize: 13, fontWeight: 600, color: '#6b7280' }}>Servidores externos · {externosFiltrados.length}</div>
                    <div style={{ fontSize: 11, color: '#9ca3af', marginTop: 2 }}>No tienen pago asignado</div>
                  </div>
                  {mostrarExternos ? <ChevronUp size={16} color="#9ca3af" /> : <ChevronDown size={16} color="#9ca3af" />}
                </button>
                {mostrarExternos && (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                    {externosFiltrados.map(s => <CardExterno key={s.id} s={s} />)}
                  </div>
                )}
              </div>
            )}
          </>
        )}
      </div>

      <button onClick={() => router.push('/dashboard/servidores/nuevo')}
        style={{ position: 'fixed', bottom: 80, left: 20, right: 20, background: '#0f1787', color: '#fff', border: 'none', borderRadius: 14, padding: 14, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8, fontSize: 14, fontWeight: 500, cursor: 'pointer' }}>
        <Plus size={18} /> Registrar servidor
      </button>

      <BottomNav />
    </div>
  )
}
