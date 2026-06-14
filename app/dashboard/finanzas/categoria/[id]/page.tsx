'use client'
import { useEffect, useState } from 'react'
import { useRouter, useParams } from 'next/navigation'
import { supabase } from '@/lib/supabase'
import { ChevronLeft, Plus, Trash2, Pencil, X, Check } from 'lucide-react'

type Transaccion = {
  id: string
  tipo: 'ingreso' | 'egreso'
  valor: number
  descripcion: string
  fecha: string
  comprobante_url: string | null
  comprobante_nombre: string | null
}

function fmt(n: number) { return `$${Number(n).toLocaleString('es-CO')}` }

export default function CategoriaPage() {
  const router = useRouter()
  const { id } = useParams<{ id: string }>()

  const [categoria, setCategoria] = useState<{ nombre: string; presupuesto: number } | null>(null)
  const [transacciones, setTransacciones] = useState<Transaccion[]>([])
  const [tab, setTab] = useState<'ingresos' | 'egresos'>('ingresos')
  const [loading, setLoading] = useState(true)

  // Edición
  const [editandoId, setEditandoId] = useState<string | null>(null)
  const [editValor, setEditValor] = useState('')
  const [editDescripcion, setEditDescripcion] = useState('')
  const [editFecha, setEditFecha] = useState('')
  const [guardandoEdit, setGuardandoEdit] = useState(false)

  // Confirmación borrado
  const [borrandoId, setBorrandoId] = useState<string | null>(null)

  useEffect(() => { cargar() }, [id])

  async function cargar() {
    const { data: cat } = await supabase
      .from('categorias_financieras')
      .select('nombre, presupuesto')
      .eq('id', id)
      .single()
    if (cat) setCategoria(cat)

    const { data: tx } = await supabase
      .from('transacciones')
      .select('id, tipo, valor, descripcion, fecha, comprobante_url, comprobante_nombre')
      .eq('categoria_id', id)
      .order('fecha', { ascending: false })
    if (tx) setTransacciones(tx as Transaccion[])

    setLoading(false)
  }

  function iniciarEdicion(t: Transaccion) {
    setEditandoId(t.id)
    setEditValor(String(t.valor))
    setEditDescripcion(t.descripcion)
    setEditFecha(t.fecha.split('T')[0])
  }

  function cancelarEdicion() {
    setEditandoId(null)
    setEditValor('')
    setEditDescripcion('')
    setEditFecha('')
  }

  async function guardarEdicion(t: Transaccion) {
    setGuardandoEdit(true)
    await supabase.from('transacciones').update({
      valor: Number(editValor),
      descripcion: editDescripcion,
      fecha: editFecha,
    }).eq('id', t.id)
    setGuardandoEdit(false)
    setEditandoId(null)
    cargar()
  }

  async function borrar(txId: string) {
    await supabase.from('transacciones').delete().eq('id', txId)
    setBorrandoId(null)
    cargar()
  }

  const ingresos = transacciones.filter(t => t.tipo === 'ingreso')
  const egresos = transacciones.filter(t => t.tipo === 'egreso')
  const totalIngresos = ingresos.reduce((s, t) => s + Number(t.valor), 0)
  const totalEgresos = egresos.reduce((s, t) => s + Number(t.valor), 0)
  const lista = tab === 'ingresos' ? ingresos : egresos

  if (loading) return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: '100vh', background: '#f7f8fc' }}>
      <div style={{ color: '#9ca3af', fontSize: 14 }}>Cargando...</div>
    </div>
  )

  return (
    <div style={{ background: '#f7f8fc', minHeight: '100vh', paddingBottom: 100 }}>

      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '18px 20px 14px' }}>
        <button onClick={() => router.back()} style={{ width: 34, height: 34, borderRadius: '50%', background: '#fff', border: '0.5px solid #e5e7eb', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer' }}>
          <ChevronLeft size={18} color="#6b7280" />
        </button>
        <div>
          <div style={{ fontSize: 17, fontWeight: 500, color: '#0d0d14' }}>{categoria?.nombre}</div>
          {categoria?.presupuesto > 0 && (
            <div style={{ fontSize: 11, color: '#9ca3af', marginTop: 1 }}>Presupuesto: {fmt(categoria.presupuesto)}</div>
          )}
        </div>
      </div>

      {/* Mini resumen */}
      <div style={{ display: 'flex', gap: 10, padding: '0 20px 16px' }}>
        <div style={{ flex: 1, background: '#fff', borderRadius: 12, padding: '12px 14px', border: '0.5px solid #e5e7eb' }}>
          <div style={{ fontSize: 11, color: '#9ca3af', marginBottom: 4 }}>Ingresos</div>
          <div style={{ fontSize: 16, fontWeight: 600, color: '#166534' }}>{fmt(totalIngresos)}</div>
        </div>
        <div style={{ flex: 1, background: '#fff', borderRadius: 12, padding: '12px 14px', border: '0.5px solid #e5e7eb' }}>
          <div style={{ fontSize: 11, color: '#9ca3af', marginBottom: 4 }}>Egresos</div>
          <div style={{ fontSize: 16, fontWeight: 600, color: '#dc2626' }}>{fmt(totalEgresos)}</div>
        </div>
        <div style={{ flex: 1, background: '#fff', borderRadius: 12, padding: '12px 14px', border: '0.5px solid #e5e7eb' }}>
          <div style={{ fontSize: 11, color: '#9ca3af', marginBottom: 4 }}>Balance</div>
          <div style={{ fontSize: 16, fontWeight: 600, color: totalIngresos - totalEgresos >= 0 ? '#0f1787' : '#dc2626' }}>
            {fmt(totalIngresos - totalEgresos)}
          </div>
        </div>
      </div>

      {/* Tabs */}
      <div style={{ display: 'flex', gap: 8, padding: '0 20px 16px' }}>
        {(['ingresos', 'egresos'] as const).map(t => (
          <button key={t} onClick={() => setTab(t)} style={{
            padding: '7px 18px', borderRadius: 20, fontSize: 13, fontWeight: 500,
            whiteSpace: 'nowrap', cursor: 'pointer', border: '0.5px solid #e5e7eb',
            background: tab === t ? '#0f1787' : '#fff',
            color: tab === t ? '#fff' : '#6b7280'
          }}>
            {t === 'ingresos' ? `↑ Ingresos · ${ingresos.length}` : `↓ Egresos · ${egresos.length}`}
          </button>
        ))}
      </div>

      {/* Lista */}
      <div style={{ padding: '0 20px', display: 'flex', flexDirection: 'column', gap: 10 }}>
        {lista.length === 0 ? (
          <div style={{ textAlign: 'center', color: '#9ca3af', fontSize: 14, padding: 40 }}>
            Sin {tab} registrados
          </div>
        ) : lista.map(t => (
          <div key={t.id} style={{ background: '#fff', borderRadius: 14, border: '0.5px solid #e5e7eb', overflow: 'hidden' }}>

            {/* Modal confirmación borrado */}
            {borrandoId === t.id && (
              <div style={{ padding: '14px 16px', background: '#fee2e2', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10 }}>
                <span style={{ fontSize: 13, color: '#991b1b', fontWeight: 500 }}>¿Borrar este movimiento?</span>
                <div style={{ display: 'flex', gap: 8 }}>
                  <button onClick={() => setBorrandoId(null)} style={{ padding: '6px 14px', borderRadius: 20, fontSize: 12, background: '#fff', border: '0.5px solid #e5e7eb', cursor: 'pointer', color: '#6b7280' }}>
                    Cancelar
                  </button>
                  <button onClick={() => borrar(t.id)} style={{ padding: '6px 14px', borderRadius: 20, fontSize: 12, background: '#dc2626', border: 'none', cursor: 'pointer', color: '#fff', fontWeight: 500 }}>
                    Sí, borrar
                  </button>
                </div>
              </div>
            )}

            {/* Vista normal */}
            {editandoId !== t.id && borrandoId !== t.id && (
              <div style={{ padding: '14px 16px', display: 'flex', alignItems: 'center', gap: 12 }}>
                <div style={{ flex: 1 }}>
                  <div style={{ fontSize: 14, fontWeight: 500, color: '#0d0d14' }}>{t.descripcion}</div>
                  <div style={{ fontSize: 11, color: '#9ca3af', marginTop: 2 }}>
                    {new Date(t.fecha).toLocaleDateString('es-CO', { day: 'numeric', month: 'short', year: 'numeric' })}
                  </div>
                  {t.comprobante_url && (
                    <a href={t.comprobante_url} target="_blank" rel="noopener noreferrer"
                      style={{ fontSize: 11, color: '#0f1787', marginTop: 4, display: 'inline-block', textDecoration: 'underline' }}>
                      Ver comprobante
                    </a>
                  )}
                </div>
                <div style={{ fontSize: 15, fontWeight: 600, color: tab === 'ingresos' ? '#166534' : '#dc2626', flexShrink: 0 }}>
                  {fmt(t.valor)}
                </div>
                <div style={{ display: 'flex', gap: 6, flexShrink: 0 }}>
                  <button onClick={() => iniciarEdicion(t)} style={{ width: 30, height: 30, borderRadius: '50%', background: '#f0f1ff', border: 'none', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer' }}>
                    <Pencil size={13} color="#0f1787" />
                  </button>
                  <button onClick={() => setBorrandoId(t.id)} style={{ width: 30, height: 30, borderRadius: '50%', background: '#fee2e2', border: 'none', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer' }}>
                    <Trash2 size={13} color="#dc2626" />
                  </button>
                </div>
              </div>
            )}

            {/* Vista edición */}
            {editandoId === t.id && (
              <div style={{ padding: '14px 16px', display: 'flex', flexDirection: 'column', gap: 10 }}>
                <div style={{ fontSize: 12, fontWeight: 600, color: '#0f1787', marginBottom: 2 }}>Editando</div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                  <div>
                    <div style={{ fontSize: 11, color: '#9ca3af', marginBottom: 4 }}>Descripción</div>
                    <input
                      value={editDescripcion}
                      onChange={e => setEditDescripcion(e.target.value)}
                      style={{ width: '100%', border: '0.5px solid #e5e7eb', borderRadius: 8, padding: '8px 10px', fontSize: 14, color: '#0d0d14', outline: 'none', boxSizing: 'border-box' }}
                    />
                  </div>
                  <div style={{ display: 'flex', gap: 8 }}>
                    <div style={{ flex: 1 }}>
                      <div style={{ fontSize: 11, color: '#9ca3af', marginBottom: 4 }}>Valor</div>
                      <input
                        type="number"
                        value={editValor}
                        onChange={e => setEditValor(e.target.value)}
                        style={{ width: '100%', border: '0.5px solid #e5e7eb', borderRadius: 8, padding: '8px 10px', fontSize: 14, color: '#0d0d14', outline: 'none', boxSizing: 'border-box' }}
                      />
                    </div>
                    <div style={{ flex: 1 }}>
                      <div style={{ fontSize: 11, color: '#9ca3af', marginBottom: 4 }}>Fecha</div>
                      <input
                        type="date"
                        value={editFecha}
                        onChange={e => setEditFecha(e.target.value)}
                        style={{ width: '100%', border: '0.5px solid #e5e7eb', borderRadius: 8, padding: '8px 10px', fontSize: 14, color: '#0d0d14', outline: 'none', boxSizing: 'border-box' }}
                      />
                    </div>
                  </div>
                </div>
                <div style={{ display: 'flex', gap: 8, marginTop: 4 }}>
                  <button onClick={cancelarEdicion} style={{ flex: 1, padding: '9px', borderRadius: 10, fontSize: 13, background: '#f3f4f6', border: 'none', cursor: 'pointer', color: '#6b7280', fontWeight: 500 }}>
                    Cancelar
                  </button>
                  <button onClick={() => guardarEdicion(t)} disabled={guardandoEdit} style={{ flex: 1, padding: '9px', borderRadius: 10, fontSize: 13, background: '#0f1787', border: 'none', cursor: 'pointer', color: '#fff', fontWeight: 500 }}>
                    {guardandoEdit ? 'Guardando...' : 'Guardar'}
                  </button>
                </div>
              </div>
            )}
          </div>
        ))}
      </div>

      {/* Botón registrar */}
      <button
        onClick={() => router.push(`/dashboard/finanzas/registrar?tipo=${tab === 'ingresos' ? 'ingreso' : 'egreso'}&categoria=${id}`)}
        style={{ position: 'fixed', bottom: 28, left: 20, right: 20, background: '#0f1787', color: '#fff', border: 'none', borderRadius: 14, padding: 14, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8, fontSize: 14, fontWeight: 500, cursor: 'pointer' }}>
        <Plus size={18} /> Registrar {tab === 'ingresos' ? 'ingreso' : 'egreso'}
      </button>
    </div>
  )
}
