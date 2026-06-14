'use client'
import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'
import BottomNav from '@/components/BottomNav'
import { Search, Plus } from 'lucide-react'

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
  fecha_inscripcion?: string
}

const FILTROS = [
  { key: 'todos', label: 'Todos' },
  { key: 'completo', label: 'Pago completo' },
  { key: 'parcial', label: 'Abono parcial' },
  { key: 'sin_pago', label: 'Sin pago' },
]

function iniciales(nombre: string) {
  return nombre.split(' ').slice(0, 2).map(n => n[0]).join('').toUpperCase()
}

function fmt(n: number) { return `$${Number(n).toLocaleString('es-CO')}` }

export default function ServidoresPage() {
  const router = useRouter()
  const [servidores, setServidores] = useState<Servidor[]>([])
  const [filtro, setFiltro] = useState('todos')
  const [busqueda, setBusqueda] = useState('')
  const [loading, setLoading] = useState(true)
  const [total, setTotal] = useState(0)

  useEffect(() => {
    async function cargar() {
      const { data: r } = await supabase.from('retiros').select('id').eq('estado', 'activo').single()
      if (!r) return

      const { data } = await supabase
        .from('vista_pagos_servidores')
        .select('*')
        .eq('retiro_id', r.id)
        .order('fecha_inscripcion', { ascending: false })
      if (data) {
        setServidores(data as Servidor[])
        setTotal(data.length)
      }
      setLoading(false)
    }
    cargar()
  }, [])

  const filtrados = servidores.filter(s => {
    const matchBusqueda = s.nombre.toLowerCase().includes(busqueda.toLowerCase()) || s.numero_documento.includes(busqueda)
    const matchFiltro = filtro === 'todos' ? true : s.estado_pago === filtro
    return matchBusqueda && matchFiltro
  })

  const colorAvatar = (estado: string) =>
    estado === 'completo' ? { bg: '#dcfce7', color: '#166534' }
    : estado === 'parcial' ? { bg: '#fef3c7', color: '#92400e' }
    : { bg: '#f3f4f6', color: '#6b7280' }

  const pctCupo = Math.round((total / 50) * 100)

  return (
    <div style={{ background: '#f7f8fc', minHeight: '100vh', paddingBottom: 100 }}>

      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '18px 20px 14px' }}>
        <div style={{ fontSize: 17, fontWeight: 500, color: '#0d0d14' }}>Servidores</div>
      </div>

      {/* Buscador */}
      <div style={{ padding: '0 20px 14px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, background: '#fff', border: '0.5px solid #e5e7eb', borderRadius: 12, padding: '10px 14px' }}>
          <Search size={16} color="#9ca3af" />
          <input
            value={busqueda}
            onChange={e => setBusqueda(e.target.value)}
            placeholder="Buscar por nombre o documento…"
            style={{ border: 'none', outline: 'none', fontSize: 14, color: '#0d0d14', background: 'transparent', flex: 1 }}
          />
        </div>
      </div>

      {/* Filtros */}
      <div style={{ display: 'flex', gap: 8, padding: '0 20px 16px', overflowX: 'auto', scrollbarWidth: 'none' }}>
        {FILTROS.map(f => {
          const count = f.key === 'todos' ? servidores.length
            : servidores.filter(s => s.estado_pago === f.key).length
          return (
            <button key={f.key} onClick={() => setFiltro(f.key)} style={{
              padding: '6px 14px', borderRadius: 20, fontSize: 12, fontWeight: 500,
              whiteSpace: 'nowrap', cursor: 'pointer', border: '0.5px solid #e5e7eb',
              background: filtro === f.key ? '#0f1787' : '#fff',
              color: filtro === f.key ? '#fff' : '#6b7280'
            }}>
              {f.label} · {count}
            </button>
          )
        })}
      </div>

      {/* Cupos */}
      <div style={{ margin: '0 20px 16px', background: '#fff', borderRadius: 14, padding: '14px 16px', border: '0.5px solid #e5e7eb', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12 }}>
        <div style={{ flex: 1 }}>
          <div style={{ fontSize: 13, fontWeight: 500, color: '#0d0d14' }}>Cupos servidores</div>
          <div style={{ fontSize: 11, color: '#9ca3af', marginTop: 2 }}>Máximo 50</div>
          <div style={{ height: 4, background: '#f3f4f6', borderRadius: 2, marginTop: 8 }}>
            <div style={{ height: 4, borderRadius: 2, background: total >= 50 ? '#dc2626' : '#0f1787', width: `${Math.min(pctCupo, 100)}%` }} />
          </div>
        </div>
        <div style={{ textAlign: 'right' }}>
          <div style={{ fontSize: 22, fontWeight: 500, color: '#0d0d14' }}>{total}<span style={{ fontSize: 13, color: '#9ca3af', fontWeight: 400 }}>/50</span></div>
          <div style={{ fontSize: 11, fontWeight: 500, padding: '3px 10px', borderRadius: 20, background: total >= 50 ? '#fee2e2' : '#f0f1ff', color: total >= 50 ? '#991b1b' : '#0f1787', marginTop: 4 }}>
            {total >= 50 ? '🔒 Cupo lleno' : `${50 - total} disponibles`}
          </div>
        </div>
      </div>

      {/* Lista */}
      <div style={{ padding: '0 20px', display: 'flex', flexDirection: 'column', gap: 8 }}>
        {loading ? (
          <div style={{ textAlign: 'center', color: '#9ca3af', fontSize: 14, padding: 40 }}>Cargando...</div>
        ) : filtrados.length === 0 ? (
          <div style={{ textAlign: 'center', color: '#9ca3af', fontSize: 14, padding: 40 }}>Sin resultados</div>
        ) : filtrados.map(s => {
          const av = colorAvatar(s.estado_pago)
          return (
            <div key={s.id} onClick={() => router.push(`/dashboard/servidores/${s.id}`)}
              style={{ background: '#fff', borderRadius: 14, padding: '14px 16px', display: 'flex', alignItems: 'center', gap: 12, border: '0.5px solid #e5e7eb', cursor: 'pointer' }}>
              <div style={{ width: 38, height: 38, borderRadius: '50%', background: av.bg, color: av.color, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 13, fontWeight: 500, flexShrink: 0 }}>
                {iniciales(s.nombre)}
              </div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: 14, fontWeight: 500, color: '#0d0d14', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{s.nombre}</div>
                <div style={{ fontSize: 11, color: '#9ca3af', marginTop: 2 }}>{s.edad} años · {s.talla_camiseta}</div>
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 4, flexShrink: 0 }}>
                <div style={{ fontSize: 12, fontWeight: 500, color: s.estado_pago === 'completo' ? '#166534' : s.estado_pago === 'parcial' ? '#d97706' : '#9ca3af' }}>
                  {fmt(s.total_pagado)}
                </div>
                <div style={{ fontSize: 10, color: '#9ca3af' }}>de $380.000</div>
              </div>
            </div>
          )
        })}
      </div>

      {/* Botón registrar */}
      {total < 50 && (
        <button onClick={() => router.push('/dashboard/servidores/nuevo')}
          style={{ position: 'fixed', bottom: 80, left: 20, right: 20, background: '#0f1787', color: '#fff', border: 'none', borderRadius: 14, padding: 14, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8, fontSize: 14, fontWeight: 500, cursor: 'pointer' }}>
          <Plus size={18} /> Registrar servidor
        </button>
      )}

      <BottomNav />
    </div>
  )
}
