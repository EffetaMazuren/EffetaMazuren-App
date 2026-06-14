'use client'
import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'
import BottomNav from '@/components/BottomNav'
import { Plus, ArrowUpRight, ArrowDownRight, FileImage } from 'lucide-react'

type Transaccion = {
  id: string
  categoria_id: string
  tipo: 'ingreso' | 'egreso'
  valor: number
  descripcion: string
  fecha: string
  comprobante_url: string | null
  comprobante_nombre: string | null
  categorias_financieras?: { nombre: string }
}

type Categoria = {
  id: string
  nombre: string
  presupuesto: number
  tipo_cuenta: 'parroquia' | 'effeta'
}

function fmt(n: number) { return `$${Number(n).toLocaleString('es-CO')}` }

const CATS_PARROQUIA = ['Inscripciones caminantes', 'Inscripciones servidores', 'Casa de retiros']

export default function FinanzasPage() {
  const router = useRouter()
  const [tab, setTab] = useState<'resumen' | 'ingresos' | 'egresos' | 'comprobantes'>('resumen')
  const [transacciones, setTransacciones] = useState<Transaccion[]>([])
  const [categorias, setCategorias] = useState<Categoria[]>([])
  const [loading, setLoading] = useState(true)
  const [totalPagadoCaminantes, setTotalPagadoCaminantes] = useState(0)
  const [totalPagadoServidores, setTotalPagadoServidores] = useState(0)
  const [imagenAmpliada, setImagenAmpliada] = useState<Transaccion | null>(null)
  const [filtroCategoria, setFiltroCategoria] = useState<string>('todas')

  useEffect(() => {
    async function cargar() {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) { router.push('/'); return }
      const { data: u } = await supabase.from('usuarios').select('rol').eq('id', user.id).single()
      if (!u || u.rol !== 'lider') { router.push('/dashboard'); return }

      const { data: r } = await supabase.from('retiros').select('id').eq('estado', 'activo').single()
      if (!r) return

      const { data: cats } = await supabase
        .from('categorias_financieras')
        .select('id, nombre, presupuesto')
        .eq('retiro_id', r.id)
        .eq('activa', true)
        .order('orden')
      if (cats) {
        setCategorias(cats.map(c => ({
          ...c,
          tipo_cuenta: CATS_PARROQUIA.includes(c.nombre) ? 'parroquia' : 'effeta'
        })))
      }

      const { data: tx } = await supabase
        .from('transacciones')
        .select('*, categorias_financieras(nombre)')
        .eq('retiro_id', r.id)
        .order('fecha', { ascending: false })
      if (tx) setTransacciones(tx as Transaccion[])

      const { data: pagCam } = await supabase.from('pagos').select('valor').eq('tipo_persona', 'caminante')
      setTotalPagadoCaminantes(pagCam?.reduce((s, p) => s + Number(p.valor), 0) ?? 0)

      const { data: pagSer } = await supabase.from('pagos').select('valor').eq('tipo_persona', 'servidor')
      setTotalPagadoServidores(pagSer?.reduce((s, p) => s + Number(p.valor), 0) ?? 0)

      setLoading(false)
    }
    cargar()
  }, [])

  const ingresosEffeta = transacciones.filter(t => t.tipo === 'ingreso').reduce((s, t) => s + Number(t.valor), 0)
  const egresosEffeta = transacciones.filter(t => t.tipo === 'egreso').reduce((s, t) => s + Number(t.valor), 0)
  const balanceEffeta = ingresosEffeta - egresosEffeta

  const totalParroquia = totalPagadoCaminantes + totalPagadoServidores
  const casaRetiros = categorias.find(c => c.nombre === 'Casa de retiros')?.presupuesto ?? 39000000
  const saldoParroquia = totalParroquia - casaRetiros

  const txIngresos = transacciones.filter(t => t.tipo === 'ingreso')
  const txEgresos = transacciones.filter(t => t.tipo === 'egreso')
  const txConComprobante = transacciones.filter(t => t.comprobante_url)

  if (loading) return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: '100vh', background: '#f7f8fc' }}>
      <div style={{ color: '#9ca3af', fontSize: 14 }}>Cargando...</div>
    </div>
  )

  return (
    <div style={{ background: '#f7f8fc', minHeight: '100vh', paddingBottom: 100 }}>

      {/* Hero navy */}
      <div style={{ background: '#0f1787', padding: '28px 20px 32px' }}>
        <div style={{ fontSize: 13, color: 'rgba(255,255,255,0.6)', marginBottom: 4 }}>Nequi Effetá</div>
        <div style={{ fontSize: 36, fontWeight: 600, color: '#fff', letterSpacing: '-0.5px' }}>
          {fmt(balanceEffeta)}
        </div>
        <div style={{ fontSize: 12, color: balanceEffeta >= 0 ? '#86efac' : '#fca5a5', marginTop: 4 }}>
          {balanceEffeta >= 0 ? '↑' : '↓'} Balance disponible
        </div>
        <div style={{ display: 'flex', gap: 12, marginTop: 20 }}>
          <div style={{ flex: 1, background: 'rgba(255,255,255,0.08)', borderRadius: 12, padding: '12px 14px' }}>
            <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.5)', marginBottom: 4 }}>Ingresos</div>
            <div style={{ fontSize: 16, fontWeight: 600, color: '#86efac' }}>{fmt(ingresosEffeta)}</div>
          </div>
          <div style={{ flex: 1, background: 'rgba(255,255,255,0.08)', borderRadius: 12, padding: '12px 14px' }}>
            <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.5)', marginBottom: 4 }}>Egresos</div>
            <div style={{ fontSize: 16, fontWeight: 600, color: '#fca5a5' }}>{fmt(egresosEffeta)}</div>
          </div>
        </div>
      </div>

      {/* Tabs */}
      <div style={{ display: 'flex', gap: 8, padding: '16px 20px 0', overflowX: 'auto', scrollbarWidth: 'none' }}>
        {([
          { key: 'resumen', label: 'Resumen' },
          { key: 'ingresos', label: '↑ Ingresos' },
          { key: 'egresos', label: '↓ Egresos' },
          { key: 'comprobantes', label: `🧾 Comprobantes · ${txConComprobante.length}` },
        ] as const).map(t => (
          <button key={t.key} onClick={() => setTab(t.key)} style={{
            padding: '7px 18px', borderRadius: 20, fontSize: 13, fontWeight: 500,
            whiteSpace: 'nowrap', cursor: 'pointer', border: '0.5px solid #e5e7eb',
            background: tab === t.key ? '#0f1787' : '#fff',
            color: tab === t.key ? '#fff' : '#6b7280'
          }}>
            {t.label}
          </button>
        ))}
      </div>

      <div style={{ padding: '16px 20px', display: 'flex', flexDirection: 'column', gap: 12 }}>

        {/* ── RESUMEN ── */}
        {tab === 'resumen' && (
          <>
            <div style={{ background: '#fff', borderRadius: 14, padding: '16px', border: '0.5px solid #e5e7eb' }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14 }}>
                <div>
                  <div style={{ fontSize: 13, fontWeight: 600, color: '#0d0d14' }}>Cuenta Parroquia</div>
                  <div style={{ fontSize: 11, color: '#9ca3af', marginTop: 1 }}>Casa de retiros · seguimiento</div>
                </div>
                <div style={{ fontSize: 11, fontWeight: 500, padding: '3px 10px', borderRadius: 20, background: saldoParroquia >= 0 ? '#dcfce7' : '#fee2e2', color: saldoParroquia >= 0 ? '#166534' : '#991b1b' }}>
                  {saldoParroquia >= 0 ? 'Al día' : 'Pendiente'}
                </div>
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                  <span style={{ fontSize: 13, color: '#6b7280' }}>Pagos caminantes</span>
                  <span style={{ fontSize: 13, fontWeight: 500, color: '#166534' }}>{fmt(totalPagadoCaminantes)}</span>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                  <span style={{ fontSize: 13, color: '#6b7280' }}>Pagos servidores</span>
                  <span style={{ fontSize: 13, fontWeight: 500, color: '#166634' }}>{fmt(totalPagadoServidores)}</span>
                </div>
                <div style={{ height: '0.5px', background: '#f3f4f6' }} />
                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                  <span style={{ fontSize: 13, color: '#6b7280' }}>Total recaudado</span>
                  <span style={{ fontSize: 14, fontWeight: 600, color: '#0d0d14' }}>{fmt(totalParroquia)}</span>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                  <span style={{ fontSize: 13, color: '#6b7280' }}>Casa de retiros</span>
                  <span style={{ fontSize: 13, fontWeight: 500, color: '#dc2626' }}>− {fmt(casaRetiros)}</span>
                </div>
                <div style={{ marginTop: 4 }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 6 }}>
                    <span style={{ fontSize: 11, color: '#9ca3af' }}>Progreso pago</span>
                    <span style={{ fontSize: 11, fontWeight: 600, color: '#0d0d14' }}>{Math.round((totalParroquia / casaRetiros) * 100)}%</span>
                  </div>
                  <div style={{ height: 6, background: '#f3f4f6', borderRadius: 3 }}>
                    <div style={{ height: 6, borderRadius: 3, background: totalParroquia >= casaRetiros ? '#16a34a' : '#0f1787', width: `${Math.min((totalParroquia / casaRetiros) * 100, 100)}%`, transition: 'width 0.5s' }} />
                  </div>
                </div>
              </div>
            </div>

            <div style={{ fontSize: 12, fontWeight: 600, color: '#9ca3af', letterSpacing: '0.05em', textTransform: 'uppercase', marginTop: 4 }}>
              Nequi Effetá · por categoría
            </div>
            {categorias.filter(c => c.tipo_cuenta === 'effeta').map(cat => {
              const ingresos = transacciones.filter(t => t.categoria_id === cat.id && t.tipo === 'ingreso').reduce((s, t) => s + Number(t.valor), 0)
              const egresos = transacciones.filter(t => t.categoria_id === cat.id && t.tipo === 'egreso').reduce((s, t) => s + Number(t.valor), 0)
              const balance = ingresos - egresos
              const hayMovimientos = ingresos > 0 || egresos > 0
              return (
                <div key={cat.id}
                  onClick={() => router.push(`/dashboard/finanzas/categoria/${cat.id}`)}
                  style={{ background: '#fff', borderRadius: 14, padding: '14px 16px', border: '0.5px solid #e5e7eb', display: 'flex', alignItems: 'center', justifyContent: 'space-between', cursor: 'pointer' }}>
                  <div>
                    <div style={{ fontSize: 14, fontWeight: 500, color: '#0d0d14' }}>{cat.nombre}</div>
                    {hayMovimientos && (
                      <div style={{ fontSize: 11, color: '#9ca3af', marginTop: 2 }}>
                        {ingresos > 0 && <span style={{ color: '#16a34a' }}>↑ {fmt(ingresos)} </span>}
                        {egresos > 0 && <span style={{ color: '#dc2626' }}>↓ {fmt(egresos)}</span>}
                      </div>
                    )}
                  </div>
                  <div style={{ textAlign: 'right' }}>
                    <div style={{ fontSize: 14, fontWeight: 600, color: !hayMovimientos ? '#9ca3af' : balance >= 0 ? '#166534' : '#dc2626' }}>
                      {hayMovimientos ? fmt(balance) : '—'}
                    </div>
                    {(cat.presupuesto ?? 0) > 0 && (
                      <div style={{ fontSize: 11, color: '#9ca3af', marginTop: 1 }}>de {fmt(cat.presupuesto)}</div>
                    )}
                  </div>
                </div>
              )
            })}
          </>
        )}

        {/* ── INGRESOS ── */}
        {tab === 'ingresos' && (
          <>
            <div style={{ fontSize: 13, color: '#6b7280' }}>{txIngresos.length} movimientos · {fmt(ingresosEffeta)}</div>
            {txIngresos.length === 0 ? (
              <div style={{ textAlign: 'center', color: '#9ca3af', fontSize: 14, padding: 40 }}>Sin ingresos registrados</div>
            ) : txIngresos.map(t => (
              <div key={t.id} style={{ background: '#fff', borderRadius: 14, padding: '14px 16px', border: '0.5px solid #e5e7eb', display: 'flex', alignItems: 'center', gap: 12 }}>
                <div style={{ width: 36, height: 36, borderRadius: '50%', background: '#dcfce7', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                  <ArrowUpRight size={16} color="#16a34a" />
                </div>
                <div style={{ flex: 1 }}>
                  <div style={{ fontSize: 14, fontWeight: 500, color: '#0d0d14' }}>{t.descripcion}</div>
                  <div style={{ fontSize: 11, color: '#9ca3af', marginTop: 2 }}>
                    {t.categorias_financieras?.nombre} · {new Date(t.fecha).toLocaleDateString('es-CO', { day: 'numeric', month: 'short' })}
                  </div>
                </div>
                <div style={{ fontSize: 14, fontWeight: 600, color: '#16a34a' }}>{fmt(t.valor)}</div>
              </div>
            ))}
          </>
        )}

        {/* ── EGRESOS ── */}
        {tab === 'egresos' && (
          <>
            <div style={{ fontSize: 13, color: '#6b7280' }}>{txEgresos.length} movimientos · {fmt(egresosEffeta)}</div>
            {txEgresos.length === 0 ? (
              <div style={{ textAlign: 'center', color: '#9ca3af', fontSize: 14, padding: 40 }}>Sin egresos registrados</div>
            ) : txEgresos.map(t => (
              <div key={t.id} style={{ background: '#fff', borderRadius: 14, padding: '14px 16px', border: '0.5px solid #e5e7eb', display: 'flex', alignItems: 'center', gap: 12 }}>
                <div style={{ width: 36, height: 36, borderRadius: '50%', background: '#fee2e2', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                  <ArrowDownRight size={16} color="#dc2626" />
                </div>
                <div style={{ flex: 1 }}>
                  <div style={{ fontSize: 14, fontWeight: 500, color: '#0d0d14' }}>{t.descripcion}</div>
                  <div style={{ fontSize: 11, color: '#9ca3af', marginTop: 2 }}>
                    {t.categorias_financieras?.nombre} · {new Date(t.fecha).toLocaleDateString('es-CO', { day: 'numeric', month: 'short' })}
                  </div>
                </div>
                <div style={{ fontSize: 14, fontWeight: 600, color: '#dc2626' }}>− {fmt(t.valor)}</div>
              </div>
            ))}
          </>
        )}

{/* ── COMPROBANTES ── */}
        {tab === 'comprobantes' && (
          <>
            {/* Filtro por categoría */}
            <div style={{ display: 'flex', gap: 8, overflowX: 'auto', scrollbarWidth: 'none', paddingBottom: 4 }}>
              <button
                onClick={() => setFiltroCategoria('todas')}
                style={{ padding: '6px 14px', borderRadius: 20, fontSize: 12, fontWeight: 500, whiteSpace: 'nowrap', cursor: 'pointer', border: '0.5px solid #e5e7eb', background: filtroCategoria === 'todas' ? '#0f1787' : '#fff', color: filtroCategoria === 'todas' ? '#fff' : '#6b7280' }}>
                Todas · {txConComprobante.length}
              </button>
              {categorias.filter(c => c.tipo_cuenta === 'effeta').filter(cat =>
                txConComprobante.some(t => t.categoria_id === cat.id)
              ).map(cat => {
                const count = txConComprobante.filter(t => t.categoria_id === cat.id).length
                return (
                  <button key={cat.id}
                    onClick={() => setFiltroCategoria(cat.id)}
                    style={{ padding: '6px 14px', borderRadius: 20, fontSize: 12, fontWeight: 500, whiteSpace: 'nowrap', cursor: 'pointer', border: '0.5px solid #e5e7eb', background: filtroCategoria === cat.id ? '#0f1787' : '#fff', color: filtroCategoria === cat.id ? '#fff' : '#6b7280' }}>
                    {cat.nombre} · {count}
                  </button>
                )
              })}
            </div>

            {txConComprobante.length === 0 ? (
              <div style={{ textAlign: 'center', color: '#9ca3af', fontSize: 14, padding: 40 }}>
                <div style={{ fontSize: 32, marginBottom: 8 }}>🧾</div>
                <div>Sin comprobantes subidos</div>
              </div>
            ) : filtroCategoria === 'todas' ? (
              /* Vista todas — agrupadas por categoría con color */
              <>
                {categorias.filter(c => c.tipo_cuenta === 'effeta').filter(cat =>
                  txConComprobante.some(t => t.categoria_id === cat.id)
                ).map((cat, idx) => {
                  const colores = [
                    { bg: '#eff6ff', border: '#bfdbfe', texto: '#1e40af' },
                    { bg: '#f0fdf4', border: '#bbf7d0', texto: '#166534' },
                    { bg: '#fdf4ff', border: '#e9d5ff', texto: '#6b21a8' },
                    { bg: '#fff7ed', border: '#fed7aa', texto: '#9a3412' },
                    { bg: '#fef2f2', border: '#fecaca', texto: '#991b1b' },
                    { bg: '#f0f9ff', border: '#bae6fd', texto: '#0c4a6e' },
                    { bg: '#fafaf9', border: '#d6d3d1', texto: '#44403c' },
                    { bg: '#f7fee7', border: '#d9f99d', texto: '#3f6212' },
                    { bg: '#fff1f2', border: '#fecdd3', texto: '#9f1239' },
                    { bg: '#ecfdf5', border: '#a7f3d0', texto: '#065f46' },
                    { bg: '#eef2ff', border: '#c7d2fe', texto: '#3730a3' },
                  ]
                  const color = colores[idx % colores.length]
                  const txCat = txConComprobante.filter(t => t.categoria_id === cat.id)
                  return (
                    <div key={cat.id} style={{ background: color.bg, border: `1px solid ${color.border}`, borderRadius: 14, padding: '14px' }}>
                      <div style={{ fontSize: 12, fontWeight: 600, color: color.texto, marginBottom: 10, textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                        {cat.nombre} · {txCat.length}
                      </div>
                      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
                        {txCat.map(t => (
                          <div key={t.id} onClick={() => setImagenAmpliada(t)} style={{ background: '#fff', borderRadius: 10, overflow: 'hidden', cursor: 'pointer', border: `0.5px solid ${color.border}` }}>
                            <img src={t.comprobante_url!} alt={t.descripcion} style={{ width: '100%', height: 110, objectFit: 'cover', display: 'block' }} />
                            <div style={{ padding: '8px 10px' }}>
                              <div style={{ fontSize: 11, fontWeight: 500, color: '#0d0d14', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{t.descripcion}</div>
                              <div style={{ fontSize: 11, fontWeight: 600, color: t.tipo === 'ingreso' ? '#16a34a' : '#dc2626', marginTop: 2 }}>
                                {t.tipo === 'egreso' ? '−' : '+'}{fmt(t.valor)}
                              </div>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  )
                })}
              </>
            ) : (
              /* Vista categoría individual */
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
                {txConComprobante.filter(t => t.categoria_id === filtroCategoria).map(t => (
                  <div key={t.id} onClick={() => setImagenAmpliada(t)} style={{ background: '#fff', borderRadius: 14, border: '0.5px solid #e5e7eb', overflow: 'hidden', cursor: 'pointer' }}>
                    <img src={t.comprobante_url!} alt={t.descripcion} style={{ width: '100%', height: 130, objectFit: 'cover', display: 'block' }} />
                    <div style={{ padding: '10px 12px' }}>
                      <div style={{ fontSize: 12, fontWeight: 500, color: '#0d0d14', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{t.descripcion}</div>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: 4 }}>
                        <span style={{ fontSize: 11, color: '#9ca3af' }}>{new Date(t.fecha).toLocaleDateString('es-CO', { day: 'numeric', month: 'short' })}</span>
                        <span style={{ fontSize: 11, fontWeight: 600, color: t.tipo === 'ingreso' ? '#16a34a' : '#dc2626' }}>
                          {t.tipo === 'egreso' ? '−' : '+'}{fmt(t.valor)}
                        </span>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </>
        )}

      {/* Modal imagen ampliada */}
      {imagenAmpliada && (
        <div
          onClick={() => setImagenAmpliada(null)}
          style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.85)', zIndex: 100, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: 20 }}>
          <img
            src={imagenAmpliada.comprobante_url!}
            alt={imagenAmpliada.descripcion}
            style={{ maxWidth: '100%', maxHeight: '75vh', borderRadius: 12, objectFit: 'contain' }}
            onClick={e => e.stopPropagation()}
          />
          <div style={{ marginTop: 16, textAlign: 'center' }}>
            <div style={{ fontSize: 15, fontWeight: 500, color: '#fff' }}>{imagenAmpliada.descripcion}</div>
            <div style={{ fontSize: 12, color: 'rgba(255,255,255,0.6)', marginTop: 4 }}>
              {imagenAmpliada.categorias_financieras?.nombre} · {fmt(imagenAmpliada.valor)}
            </div>
            <a href={imagenAmpliada.comprobante_url!} target="_blank" rel="noopener noreferrer"
              style={{ display: 'inline-block', marginTop: 12, fontSize: 13, color: '#a5b4fc', textDecoration: 'underline' }}>
              Abrir en pantalla completa
            </a>
          </div>
          <div style={{ marginTop: 20, fontSize: 12, color: 'rgba(255,255,255,0.4)' }}>Toca fuera para cerrar</div>
        </div>
      )}

      {/* Botón registrar */}
      {tab !== 'resumen' && tab !== 'comprobantes' && (
        <button
          onClick={() => router.push(`/dashboard/finanzas/registrar?tipo=${tab === 'ingresos' ? 'ingreso' : 'egreso'}`)}
          style={{ position: 'fixed', bottom: 80, left: 20, right: 20, background: '#0f1787', color: '#fff', border: 'none', borderRadius: 14, padding: 14, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8, fontSize: 14, fontWeight: 500, cursor: 'pointer' }}>
          <Plus size={18} /> Registrar {tab === 'ingresos' ? 'ingreso' : 'egreso'}
        </button>
      )}

      <BottomNav />
    </div>
  )
}
