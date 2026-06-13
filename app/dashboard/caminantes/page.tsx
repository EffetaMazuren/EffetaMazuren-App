'use client'
import { useEffect, useState, Suspense } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { supabase } from '@/lib/supabase'
import BottomNav from '@/components/BottomNav'
import { Search, SlidersHorizontal, Download, Plus } from 'lucide-react'

type Caminante = {
  id: string; nombre: string; numero_documento: string
  celular: string; edad: number; talla_camiseta: string
  es_sorpresa: boolean; estado_correo: string
  total_pagado: number; saldo_pendiente: number
  estado_pago: 'completo' | 'parcial' | 'sin_pago'
  inscrito_oficialmente: boolean
}

const FILTROS = [
  { key: 'todos', label: 'Todos' },
  { key: 'completo', label: 'Pago completo' },
  { key: 'parcial', label: 'Abono parcial' },
  { key: 'sin_pago', label: 'Sin pago' },
  { key: 'sorpresa', label: 'Sorpresa' },
  { key: 'sin_enviar', label: 'Sin correo' },
]

function iniciales(nombre: string) {
  return nombre.split(' ').slice(0, 2).map(n => n[0]).join('').toUpperCase()
}

function fmt(n: number) { return `$${Number(n).toLocaleString('es-CO')}` }

function CaminantesContent() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const [caminantes, setCaminantes] = useState<Caminante[]>([])
  const [filtro, setFiltro] = useState(searchParams.get('filtro') || 'todos')
  const [busqueda, setBusqueda] = useState('')
  const [cupos, setCupos] = useState<any>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    async function cargar() {
      const { data: r } = await supabase.from('retiros').select('id').eq('estado', 'activo').single()
      if (!r) return
      const { data } = await supabase.from('vista_pagos_caminantes').select('*').eq('retiro_id', r.id).order('nombre')
      if (data) setCaminantes(data as Caminante[])
      const { data: c } = await supabase.from('vista_cupos').select('*').eq('retiro_id', r.id).single()
      setCupos(c)
      setLoading(false)
    }
    cargar()
  }, [])

  const filtrados = caminantes.filter(c => {
    const matchBusqueda = c.nombre.toLowerCase().includes(busqueda.toLowerCase()) || c.numero_documento.includes(busqueda)
    const matchFiltro = filtro === 'todos' ? true
      : filtro === 'sorpresa' ? c.es_sorpresa
      : filtro === 'sin_enviar' ? c.estado_correo === 'sin_enviar'
      : c.estado_pago === filtro
    return matchBusqueda && matchFiltro
  })

  const pctCupo = cupos ? Math.round((cupos.caminantes_con_abono / 50) * 100) : 0

  const colorAvatar = (estado: string) =>
    estado === 'completo' ? { bg: '#dcfce7', color: '#166534' }
    : estado === 'parcial' ? { bg: '#fef3c7', color: '#92400e' }
    : { bg: '#f3f4f6', color: '#6b7280' }

  return (
    <div style={{ background: '#f7f8fc', minHeight: '100vh', paddingBottom: 80 }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '18px 20px 14px' }}>
        <div style={{ fontSize: 17, fontWeight: 500, color: '#0d0d14' }}>Caminantes</div>
        <div style={{ display: 'flex', gap: 8 }}>
          <button style={{ width: 34, height: 34, borderRadius: '50%', background: '#fff', border: '0.5px solid #e5e7eb', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer' }}><SlidersHorizontal size={16} color="#6b7280" /></button>
          <button style={{ width: 34, height: 34, borderRadius: '50%', background: '#fff', border: '0.5px solid #e5e7eb', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer' }}><Download size={16} color="#6b7280" /></button>
        </div>
      </div>
      <div style={{ padding: '0 20px 14px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, background: '#fff', border: '0.5px solid #e5e7eb', borderRadius: 12, padding: '10px 14px' }}>
          <Search size={16} color="#9ca3af" />
          <input value={busqueda} onChange={e => setBusqueda(e.target.value)} placeholder="Buscar por nombre o documento…" style={{ border: 'none', outline: 'none', fontSize: 14, color: '#0d0d14', background: 'transparent', flex: 1 }} />
        </div>
      </div>
      <div style={{ display: 'flex', gap: 8, padding: '0 20px 16px', overflowX: 'auto', scrollbarWidth: 'none' }}>
        {FILTROS.map(f => {
          const count = f.key === 'todos' ? caminantes.length
            : f.key === 'sorpresa' ? caminantes.filter(c => c.es_sorpresa).length
            : f.key === 'sin_enviar' ? caminantes.filter(c => c.estado_correo === 'sin_enviar').length
            : caminantes.filter(c => c.estado_pago === f.key).length
          return (
            <button key={f.key} onClick={() => setFiltro(f.key)} style={{ padding: '6px 14px', borderRadius: 20, fontSize: 12, fontWeight: 500, whiteSpace: 'nowrap', cursor: 'pointer', border: '0.5px solid #e5e7eb', background: filtro === f.key ? '#0f1787' : '#fff', color: filtro === f.key ? '#fff' : '#6b7280' }}>
              {f.label} · {count}
            </button>
          )
        })}
      </div>
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
      <div style={{ padding: '0 20px', display: 'flex', flexDirection: 'column', gap: 8 }}>
        {loading ? <div style={{ textAlign: 'center', color: '#9ca3af', fontSize: 14, padding: 40 }}>Cargando...</div>
        : filtrados.length === 0 ? <div style={{ textAlign: 'center', color: '#9ca3af', fontSize: 14, padding: 40 }}>Sin resultados</div>
        : filtrados.map(c => {
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
