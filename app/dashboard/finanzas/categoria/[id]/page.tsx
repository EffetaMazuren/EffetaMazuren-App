'use client'

import { useEffect, useState } from 'react'
import { useRouter, useParams } from 'next/navigation'
import { supabase } from '@/lib/supabase'

type Transaccion = {
  id: string
  tipo: 'ingreso' | 'egreso'
  valor: number
  descripcion: string
  fecha: string
  comprobante_url: string | null
  comprobante_nombre: string | null
  estado: string | null
  servidor_inscripcion?: { nombre: string } | null
}

function fmt(n: number) { return `$${Number(n).toLocaleString('es-CO')}` }

export default function CategoriaDetallePage() {
  const router = useRouter()
  const params = useParams()
  const id = params?.id as string

  const [categoria, setCategoria] = useState<any>(null)
  const [transacciones, setTransacciones] = useState<Transaccion[]>([])
  const [loading, setLoading] = useState(true)
  const [editando, setEditando] = useState<string | null>(null)
  const [editValor, setEditValor] = useState('')
  const [editDesc, setEditDesc] = useState('')
  const [editTipo, setEditTipo] = useState<'ingreso' | 'egreso'>('egreso')
  const [guardando, setGuardando] = useState(false)
  const [eliminando, setEliminando] = useState<string | null>(null)
  const [imagenAmpliada, setImagenAmpliada] = useState<Transaccion | null>(null)

  useEffect(() => { cargar() }, [id])

  async function cargar() {
    setLoading(true)
    const [{ data: cat }, { data: tx }] = await Promise.all([
      supabase.from('categorias_financieras').select('*').eq('id', id).single(),
      supabase
        .from('transacciones')
        .select('*, servidor_inscripcion:servidor_inscripcion_id(nombre)')
        .eq('categoria_id', id)
        .eq('estado', 'aprobado')
        .order('fecha', { ascending: false }),
    ])
    setCategoria(cat)
    setTransacciones((tx || []) as Transaccion[])
    setLoading(false)
  }

  function abrirEdicion(t: Transaccion) {
    setEditando(t.id)
    setEditValor(String(t.valor))
    setEditDesc(t.descripcion)
    setEditTipo(t.tipo)
  }

  function cancelarEdicion() {
    setEditando(null)
    setEditValor('')
    setEditDesc('')
  }

  async function guardarEdicion(id: string) {
    if (!editValor || !editDesc) return
    setGuardando(true)
    const { error } = await supabase
      .from('transacciones')
      .update({
        valor: parseFloat(editValor),
        descripcion: editDesc,
        tipo: editTipo,
      })
      .eq('id', id)
    if (error) alert('Error: ' + error.message)
    else {
      setTransacciones(prev => prev.map(t =>
        t.id === id ? { ...t, valor: parseFloat(editValor), descripcion: editDesc, tipo: editTipo } : t
      ))
      setEditando(null)
    }
    setGuardando(false)
  }

  async function eliminar(t: Transaccion) {
    if (!confirm(`¿Eliminar "${t.descripcion}" por ${fmt(t.valor)}? Esta acción no se puede deshacer.`)) return
    setEliminando(t.id)
    const { error } = await supabase.from('transacciones').delete().eq('id', t.id)
    if (error) alert('Error: ' + error.message)
    else setTransacciones(prev => prev.filter(tx => tx.id !== t.id))
    setEliminando(null)
  }

  const totalIngresos = transacciones.filter(t => t.tipo === 'ingreso').reduce((s, t) => s + Number(t.valor), 0)
  const totalEgresos = transacciones.filter(t => t.tipo === 'egreso').reduce((s, t) => s + Number(t.valor), 0)
  const balance = totalIngresos - totalEgresos

  if (loading) return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: '100vh', background: '#f7f8fc' }}>
      <div style={{ color: '#9ca3af', fontSize: 14 }}>Cargando...</div>
    </div>
  )

  return (
    <div style={{ background: '#f7f8fc', minHeight: '100vh', paddingBottom: 40 }}>

      {/* Header */}
      <div style={{ background: '#0f1787', padding: '28px 20px 28px' }}>
        <button
          onClick={() => router.push('/dashboard/finanzas')}
          style={{ background: 'none', border: 'none', color: 'rgba(255,255,255,0.6)', fontSize: 14, cursor: 'pointer', padding: 0, marginBottom: 12 }}
        >
          ← Finanzas
        </button>
        <div style={{ fontSize: 22, fontWeight: 600, color: '#fff' }}>{categoria?.nombre ?? 'Categoría'}</div>
        <div style={{ fontSize: 13, color: 'rgba(255,255,255,0.5)', marginTop: 2, marginBottom: 20 }}>
          {transacciones.length} movimiento{transacciones.length !== 1 ? 's' : ''} aprobados
        </div>

        {/* Resumen financiero */}
        <div style={{ display: 'flex', gap: 10 }}>
          <div style={{ flex: 1, background: 'rgba(255,255,255,0.08)', borderRadius: 12, padding: '12px 14px' }}>
            <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.5)', marginBottom: 4 }}>Ingresos</div>
            <div style={{ fontSize: 16, fontWeight: 600, color: '#86efac' }}>{fmt(totalIngresos)}</div>
          </div>
          <div style={{ flex: 1, background: 'rgba(255,255,255,0.08)', borderRadius: 12, padding: '12px 14px' }}>
            <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.5)', marginBottom: 4 }}>Egresos</div>
            <div style={{ fontSize: 16, fontWeight: 600, color: '#fca5a5' }}>{fmt(totalEgresos)}</div>
          </div>
          <div style={{ flex: 1, background: 'rgba(255,255,255,0.08)', borderRadius: 12, padding: '12px 14px' }}>
            <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.5)', marginBottom: 4 }}>Balance</div>
            <div style={{ fontSize: 16, fontWeight: 600, color: balance >= 0 ? '#86efac' : '#fca5a5' }}>{fmt(balance)}</div>
          </div>
        </div>
      </div>

      <div style={{ padding: '20px', display: 'flex', flexDirection: 'column', gap: 12 }}>

        {transacciones.length === 0 ? (
          <div style={{ background: '#fff', borderRadius: 14, padding: 40, textAlign: 'center', color: '#9ca3af', fontSize: 14 }}>
            Sin movimientos en esta categoría
          </div>
        ) : (
          transacciones.map(t => (
            <div key={t.id} style={{ background: '#fff', borderRadius: 14, border: '0.5px solid #e5e7eb', overflow: 'hidden' }}>

              {/* Vista normal */}
              {editando !== t.id ? (
                <div style={{ padding: '16px' }}>
                  <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 12 }}>
                    <div style={{ flex: 1 }}>
                      {/* Tipo badge */}
                      <span style={{
                        display: 'inline-block', fontSize: 11, fontWeight: 600, padding: '2px 8px', borderRadius: 6, marginBottom: 6,
                        background: t.tipo === 'ingreso' ? '#f0fdf4' : '#fef2f2',
                        color: t.tipo === 'ingreso' ? '#16a34a' : '#dc2626',
                      }}>
                        {t.tipo === 'ingreso' ? '↑ Ingreso' : '↓ Egreso'}
                      </span>

                      <div style={{ fontSize: 20, fontWeight: 700, color: t.tipo === 'ingreso' ? '#16a34a' : '#dc2626' }}>
                        {t.tipo === 'egreso' ? '− ' : '+ '}{fmt(t.valor)}
                      </div>
                      <div style={{ fontSize: 14, color: '#334155', marginTop: 4 }}>{t.descripcion}</div>
                      <div style={{ fontSize: 12, color: '#94a3b8', marginTop: 4, display: 'flex', gap: 12 }}>
                        <span>📅 {t.fecha ? new Date(t.fecha).toLocaleDateString('es-CO', { day: 'numeric', month: 'long', year: 'numeric' }) : '—'}</span>
                        {t.servidor_inscripcion?.nombre && <span>👤 {t.servidor_inscripcion.nombre}</span>}
                      </div>
                    </div>

                    {/* Acciones */}
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 8, flexShrink: 0 }}>
                      <button
                        onClick={() => abrirEdicion(t)}
                        style={{ background: '#f1f5f9', border: 'none', borderRadius: 8, padding: '7px 12px', fontSize: 12, fontWeight: 500, color: '#475569', cursor: 'pointer' }}
                      >
                        ✏️ Editar
                      </button>
                      <button
                        onClick={() => eliminar(t)}
                        disabled={eliminando === t.id}
                        style={{ background: '#fef2f2', border: 'none', borderRadius: 8, padding: '7px 12px', fontSize: 12, fontWeight: 500, color: '#dc2626', cursor: eliminando === t.id ? 'not-allowed' : 'pointer' }}
                      >
                        {eliminando === t.id ? '...' : '🗑 Borrar'}
                      </button>
                    </div>
                  </div>

                  {/* Comprobante */}
                  {t.comprobante_url && (
                    <div style={{ marginTop: 12 }}>
                      <img
                        src={t.comprobante_url}
                        alt="comprobante"
                        onClick={() => setImagenAmpliada(t)}
                        style={{ width: '100%', maxHeight: 160, objectFit: 'cover', borderRadius: 10, cursor: 'pointer' }}
                        onError={e => { (e.target as HTMLImageElement).style.display = 'none' }}
                      />
                      <button
                        onClick={() => window.open(t.comprobante_url!, '_blank')}
                        style={{ marginTop: 6, fontSize: 12, color: '#0f1787', background: 'none', border: 'none', cursor: 'pointer', padding: 0 }}
                      >
                        Ver en pantalla completa →
                      </button>
                    </div>
                  )}
                </div>
              ) : (
                /* Modo edición */
                <div style={{ padding: '16px', background: '#f8fafc' }}>
                  <div style={{ fontSize: 13, fontWeight: 600, color: '#0f1787', marginBottom: 14 }}>Editando movimiento</div>

                  {/* Tipo */}
                  <label style={{ fontSize: 12, color: '#64748b', fontWeight: 500, display: 'block', marginBottom: 6 }}>Tipo</label>
                  <div style={{ display: 'flex', gap: 8, marginBottom: 12 }}>
                    <button
                      onClick={() => setEditTipo('egreso')}
                      style={{ flex: 1, padding: '9px', borderRadius: 8, border: `2px solid ${editTipo === 'egreso' ? '#dc2626' : '#e2e8f0'}`, background: editTipo === 'egreso' ? '#fef2f2' : '#fff', color: editTipo === 'egreso' ? '#dc2626' : '#94a3b8', fontWeight: 600, fontSize: 13, cursor: 'pointer' }}
                    >↓ Egreso</button>
                    <button
                      onClick={() => setEditTipo('ingreso')}
                      style={{ flex: 1, padding: '9px', borderRadius: 8, border: `2px solid ${editTipo === 'ingreso' ? '#16a34a' : '#e2e8f0'}`, background: editTipo === 'ingreso' ? '#f0fdf4' : '#fff', color: editTipo === 'ingreso' ? '#16a34a' : '#94a3b8', fontWeight: 600, fontSize: 13, cursor: 'pointer' }}
                    >↑ Ingreso</button>
                  </div>

                  {/* Monto */}
                  <label style={{ fontSize: 12, color: '#64748b', fontWeight: 500, display: 'block', marginBottom: 6 }}>Monto (COP)</label>
                  <input
                    type="number"
                    value={editValor}
                    onChange={e => setEditValor(e.target.value)}
                    style={{ width: '100%', padding: '10px 14px', border: '1.5px solid #e2e8f0', borderRadius: 10, fontSize: 15, marginBottom: 12, boxSizing: 'border-box' }}
                  />

                  {/* Descripción */}
                  <label style={{ fontSize: 12, color: '#64748b', fontWeight: 500, display: 'block', marginBottom: 6 }}>Descripción</label>
                  <input
                    type="text"
                    value={editDesc}
                    onChange={e => setEditDesc(e.target.value)}
                    style={{ width: '100%', padding: '10px 14px', border: '1.5px solid #e2e8f0', borderRadius: 10, fontSize: 14, marginBottom: 14, boxSizing: 'border-box' }}
                  />

                  {/* Botones */}
                  <div style={{ display: 'flex', gap: 8 }}>
                    <button
                      onClick={() => guardarEdicion(t.id)}
                      disabled={guardando}
                      style={{ flex: 1, background: guardando ? '#94a3b8' : '#0f1787', color: '#fff', border: 'none', borderRadius: 10, padding: '11px', fontWeight: 600, fontSize: 14, cursor: guardando ? 'not-allowed' : 'pointer' }}
                    >
                      {guardando ? 'Guardando...' : '✓ Guardar'}
                    </button>
                    <button
                      onClick={cancelarEdicion}
                      style={{ background: '#f1f5f9', color: '#64748b', border: 'none', borderRadius: 10, padding: '11px 16px', fontWeight: 500, fontSize: 14, cursor: 'pointer' }}
                    >
                      Cancelar
                    </button>
                  </div>
                </div>
              )}
            </div>
          ))
        )}
      </div>

      {/* Modal imagen ampliada */}
      {imagenAmpliada && (
        <div
          onClick={() => setImagenAmpliada(null)}
          style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.85)', zIndex: 100, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: 20 }}
        >
          <img
            src={imagenAmpliada.comprobante_url!}
            alt={imagenAmpliada.descripcion}
            style={{ maxWidth: '100%', maxHeight: '75vh', borderRadius: 12, objectFit: 'contain' }}
            onClick={e => e.stopPropagation()}
          />
          <div style={{ marginTop: 16, textAlign: 'center' }}>
            <div style={{ fontSize: 15, fontWeight: 500, color: '#fff' }}>{imagenAmpliada.descripcion}</div>
            <div style={{ fontSize: 12, color: 'rgba(255,255,255,0.6)', marginTop: 4 }}>{fmt(imagenAmpliada.valor)}</div>
          </div>
          <div style={{ marginTop: 20, fontSize: 12, color: 'rgba(255,255,255,0.4)' }}>Toca fuera para cerrar</div>
        </div>
      )}
    </div>
  )
}
