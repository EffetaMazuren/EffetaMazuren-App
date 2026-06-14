'use client'
import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'
import BottomNav from '@/components/BottomNav'
import { Plus, ArrowUpRight, ArrowDownRight } from 'lucide-react'

type Transaccion = {
  id: string
  categoria_id: string
  tipo: 'ingreso' | 'egreso'
  valor: number
  descripcion: string
  fecha: string
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
  const [tab, setTab] = useState<'resumen' | 'ingresos' | 'egresos'>('resumen')
  const [transacciones, setTransacciones] = useState<Transaccion[]>([])
  const [categorias, setCategorias] = useState<Categoria[]>([])
  const [loading, setLoading] = useState(true)
  const [totalPagadoCaminantes, setTotalPagadoCaminantes] = useState(0)
  const [totalPagadoServidores, setTotalPagadoServidores] = useState(0)

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
        {(['resumen', 'ingresos', 'egresos'] as const).map(t => (
          <button key={t} onClick={() => setTab(t)} style={{
            padding: '7px 18px', borderRadius: 20, fontSize: 13, fontWeight: 500,
            whiteSpace: 'nowrap', cursor: 'pointer', border: '0.5px solid #e5e7eb',
            background: tab === t ? '#0f1787' : '#fff',
            color: tab === t ? '#fff' : '#6b7280'
          }}>
            {t === 'resumen' ? 'Resumen' : t === 'ingresos' ? '↑ Ingresos' : '↓ Egresos'}
          </button>
        ))}
      </div>

      <div style={{ padding: '16px 20px', display: 'flex', flexDirection: 'column', gap: 12 }}>

        {/* ── RESUMEN ── */}
        {tab === 'resumen' && (
          <>
            {/* Tarjeta parroquia */}
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
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <span style={{ fontSize: 13, color: '#6b7280' }}>Pagos caminantes</span>
                  <span style={{ fontSize: 13, fontWeight: 500, color: '#166534' }}>{fmt(totalPagadoCaminantes)}</span>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <span style={{ fontSize: 13, color: '#6b7280' }}>Pagos servidores</span>
                  <span style={{ fontSize: 13, fontWeight: 500, color: '#166534' }}>{fmt(totalPagadoServidores)}</span>
                </div>
                <div style={{ height: '0.5px', background: '#f3f4f6' }} />
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <span style={{ fontSize: 13, color: '#6b7280' }}>Total recaudado</span>
                  <span style={{ fontSize: 14, fontWeight: 600, color: '#0d0d14' }}>{fmt(totalParroquia)}</span>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
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

            {/* Categorías Nequi Effeta */}
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
      </div>

      {/* Botón registrar */}
      {tab !== 'resumen' && (
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
