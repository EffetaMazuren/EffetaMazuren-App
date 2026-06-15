'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'

type Categoria = {
  id: string
  nombre: string
  tipo_cuenta: string
  tipo_movimiento: 'ingreso' | 'egreso' | 'ambos'
  activa: boolean
  presupuesto?: number
  orden?: number
}

type TipoMovimiento = 'ingreso' | 'egreso' | 'ambos'

const TIPO_LABELS: Record<TipoMovimiento, { label: string; color: string; text: string }> = {
  ingreso:  { label: 'Ingreso',  color: '#f0fdf4', text: '#166534' },
  egreso:   { label: 'Egreso',   color: '#fef2f2', text: '#991b1b' },
  ambos:    { label: 'Ambos',    color: '#f9fafb', text: '#374151' },
}

function fmt(n: number) { return `$${Number(n).toLocaleString('es-CO')}` }

export default function CategoriasPage() {
  const router = useRouter()
  const [retiroId, setRetiroId] = useState<string | null>(null)
  const [categorias, setCategorias] = useState<Categoria[]>([])
  const [loading, setLoading] = useState(true)
  const [guardando, setGuardando] = useState<string | null>(null)
  const [eliminando, setEliminando] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [mostrarForm, setMostrarForm] = useState(false)

  // Form
  const [nombre, setNombre] = useState('')
  const [tipoCuenta, setTipoCuenta] = useState('Nequi Effetá')
  const [tipoMovimiento, setTipoMovimiento] = useState<TipoMovimiento>('egreso')
  const [presupuesto, setPresupuesto] = useState('')
  const [creando, setCreando] = useState(false)

  useEffect(() => {
    async function cargar() {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) { router.push('/'); return }

      const { data: r } = await supabase.from('retiros').select('id').eq('estado', 'activo').single()
      if (!r) return
      setRetiroId(r.id)

      const { data: cats } = await supabase
        .from('categorias_financieras')
        .select('*')
        .eq('retiro_id', r.id)
        .order('tipo_cuenta', { ascending: true })
        .order('activa', { ascending: false })
        .order('nombre', { ascending: true })

      if (cats) setCategorias(cats as Categoria[])
      setLoading(false)
    }
    cargar()
  }, [])

  const toggleActiva = async (cat: Categoria) => {
    setGuardando(cat.id)
    setError(null)
    const { error } = await supabase
      .from('categorias_financieras')
      .update({ activa: !cat.activa })
      .eq('id', cat.id)
    if (error) {
      setError('No se pudo actualizar.')
    } else {
      setCategorias(prev => prev.map(c => c.id === cat.id ? { ...c, activa: !cat.activa } : c))
    }
    setGuardando(null)
  }

  const eliminar = async (cat: Categoria) => {
    if (!confirm(`¿Eliminar "${cat.nombre}"?\nSolo es posible si no tiene movimientos registrados.`)) return
    setEliminando(cat.id)
    setError(null)

    const { count } = await supabase
      .from('transacciones')
      .select('id', { count: 'exact', head: true })
      .eq('categoria_id', cat.id)

    if ((count ?? 0) > 0) {
      setError(`"${cat.nombre}" tiene ${count} movimiento(s). Desactívala en lugar de eliminarla.`)
      setEliminando(null)
      return
    }

    const { error } = await supabase.from('categorias_financieras').delete().eq('id', cat.id)
    if (error) {
      setError('No se pudo eliminar.')
    } else {
      setCategorias(prev => prev.filter(c => c.id !== cat.id))
    }
    setEliminando(null)
  }

  const crear = async () => {
    if (!nombre.trim()) { setError('El nombre es obligatorio.'); return }
    if (!retiroId) return
    setCreando(true)
    setError(null)

    const { data, error } = await supabase
      .from('categorias_financieras')
      .insert({
        nombre: nombre.trim(),
        tipo_cuenta: tipoCuenta,
        tipo_movimiento: tipoMovimiento,
        activa: true,
        retiro_id: retiroId,
        presupuesto: presupuesto ? Number(presupuesto.replace(/\D/g, '')) : 0,
      })
      .select()
      .single()

    if (error) {
      setError('No se pudo crear la categoría.')
    } else {
      setCategorias(prev => [...prev, data as Categoria]
        .sort((a, b) => a.tipo_cuenta.localeCompare(b.tipo_cuenta) || a.nombre.localeCompare(b.nombre)))
      setNombre('')
      setPresupuesto('')
      setMostrarForm(false)
    }
    setCreando(false)
  }

  // Agrupar por tipo_cuenta
  const grupos = categorias.reduce<Record<string, Categoria[]>>((acc, cat) => {
    const key = cat.tipo_cuenta ?? 'Sin cuenta'
    if (!acc[key]) acc[key] = []
    acc[key].push(cat)
    return acc
  }, {})

  const activas = categorias.filter(c => c.activa).length
  const inactivas = categorias.filter(c => !c.activa).length

  if (loading) return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: '100vh', background: '#f7f8fc' }}>
      <div style={{ color: '#9ca3af', fontSize: 14 }}>Cargando...</div>
    </div>
  )

  return (
    <div style={{ background: '#f7f8fc', minHeight: '100vh', paddingBottom: 40 }}>

      {/* Header */}
      <div style={{ background: '#0f1787', padding: '28px 20px 24px' }}>
        <button onClick={() => router.push('/dashboard/finanzas')}
          style={{ background: 'none', border: 'none', color: 'rgba(255,255,255,0.6)', fontSize: 14, cursor: 'pointer', padding: 0, marginBottom: 12 }}>
          ← Finanzas
        </button>
        <div style={{ fontSize: 22, fontWeight: 600, color: '#fff' }}>Categorías</div>
        <div style={{ fontSize: 13, color: 'rgba(255,255,255,0.5)', marginTop: 4 }}>
          {activas} activas · {inactivas} inactivas
        </div>
      </div>

      <div style={{ padding: '20px 20px', display: 'flex', flexDirection: 'column', gap: 12 }}>

        {/* Error */}
        {error && (
          <div style={{ background: '#fef2f2', border: '0.5px solid #fecaca', borderRadius: 12, padding: '12px 16px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span style={{ fontSize: 13, color: '#991b1b' }}>{error}</span>
            <button onClick={() => setError(null)} style={{ background: 'none', border: 'none', color: '#fca5a5', cursor: 'pointer', fontSize: 18, lineHeight: 1 }}>×</button>
          </div>
        )}

        {/* Botón crear */}
        <button
          onClick={() => { setMostrarForm(p => !p); setError(null) }}
          style={{ background: mostrarForm ? '#f3f4f6' : '#0f1787', color: mostrarForm ? '#374151' : '#fff', border: '0.5px solid #e5e7eb', borderRadius: 12, padding: '13px 20px', fontSize: 14, fontWeight: 500, cursor: 'pointer' }}>
          {mostrarForm ? '✕ Cancelar' : '+ Nueva categoría'}
        </button>

        {/* Form */}
        {mostrarForm && (
          <div style={{ background: '#fff', borderRadius: 14, border: '0.5px solid #e5e7eb', padding: '20px' }}>
            <div style={{ fontSize: 14, fontWeight: 600, color: '#0d0d14', marginBottom: 16 }}>Nueva categoría</div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              <div>
                <div style={{ fontSize: 11, color: '#9ca3af', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 6 }}>Nombre *</div>
                <input
                  type="text"
                  value={nombre}
                  onChange={e => setNombre(e.target.value)}
                  placeholder="Ej. Palancas, Pinares, Decoración…"
                  onKeyDown={e => e.key === 'Enter' && crear()}
                  style={{ width: '100%', border: '0.5px solid #e5e7eb', borderRadius: 10, padding: '10px 14px', fontSize: 14, color: '#0d0d14', outline: 'none', boxSizing: 'border-box', background: '#fafafa' }}
                />
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
                <div>
                  <div style={{ fontSize: 11, color: '#9ca3af', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 6 }}>Cuenta</div>
                  <select
                    value={tipoCuenta}
                    onChange={e => setTipoCuenta(e.target.value)}
                    style={{ width: '100%', border: '0.5px solid #e5e7eb', borderRadius: 10, padding: '10px 12px', fontSize: 13, color: '#0d0d14', background: '#fafafa', outline: 'none' }}>
                    <option value="Nequi Effetá">Nequi Effetá</option>
                    <option value="Parroquia">Parroquia</option>
                  </select>
                </div>
                <div>
                  <div style={{ fontSize: 11, color: '#9ca3af', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 6 }}>Tipo</div>
                  <select
                    value={tipoMovimiento}
                    onChange={e => setTipoMovimiento(e.target.value as TipoMovimiento)}
                    style={{ width: '100%', border: '0.5px solid #e5e7eb', borderRadius: 10, padding: '10px 12px', fontSize: 13, color: '#0d0d14', background: '#fafafa', outline: 'none' }}>
                    <option value="egreso">Egreso</option>
                    <option value="ingreso">Ingreso</option>
                    <option value="ambos">Ambos</option>
                  </select>
                </div>
              </div>

              <div>
                <div style={{ fontSize: 11, color: '#9ca3af', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 6 }}>Presupuesto (opcional)</div>
                <input
                  type="text"
                  value={presupuesto}
                  onChange={e => setPresupuesto(e.target.value)}
                  placeholder="Ej. 500000"
                  style={{ width: '100%', border: '0.5px solid #e5e7eb', borderRadius: 10, padding: '10px 14px', fontSize: 14, color: '#0d0d14', outline: 'none', boxSizing: 'border-box', background: '#fafafa' }}
                />
              </div>

              <button
                onClick={crear}
                disabled={creando || !nombre.trim()}
                style={{ background: creando || !nombre.trim() ? '#e5e7eb' : '#0f1787', color: creando || !nombre.trim() ? '#9ca3af' : '#fff', border: 'none', borderRadius: 10, padding: '12px', fontSize: 14, fontWeight: 500, cursor: creando || !nombre.trim() ? 'not-allowed' : 'pointer', marginTop: 4 }}>
                {creando ? 'Creando…' : 'Crear categoría'}
              </button>
            </div>
          </div>
        )}

        {/* Lista agrupada */}
        {Object.entries(grupos).map(([cuenta, cats]) => (
          <div key={cuenta}>
            <div style={{ fontSize: 11, color: '#9ca3af', textTransform: 'uppercase', letterSpacing: '0.06em', fontWeight: 600, marginBottom: 8, paddingLeft: 2 }}>
              {cuenta}
            </div>
            <div style={{ background: '#fff', borderRadius: 14, border: '0.5px solid #e5e7eb', overflow: 'hidden' }}>
              {cats.map((cat, i) => (
                <div key={cat.id} style={{
                  display: 'flex', alignItems: 'center', gap: 12,
                  padding: '13px 16px',
                  borderTop: i > 0 ? '0.5px solid #f3f4f6' : 'none',
                  opacity: cat.activa ? 1 : 0.4,
                  transition: 'opacity 0.2s',
                }}>
                  {/* Toggle */}
                  <button
                    onClick={() => toggleActiva(cat)}
                    disabled={guardando === cat.id}
                    aria-label={cat.activa ? 'Desactivar' : 'Activar'}
                    style={{
                      position: 'relative', width: 40, height: 22, borderRadius: 11,
                      background: cat.activa ? '#0f1787' : '#d1d5db',
                      border: 'none', cursor: 'pointer', flexShrink: 0,
                      opacity: guardando === cat.id ? 0.5 : 1, transition: 'background 0.2s',
                    }}>
                    <span style={{
                      position: 'absolute', top: 3, left: cat.activa ? 21 : 3,
                      width: 16, height: 16, borderRadius: '50%', background: '#fff',
                      transition: 'left 0.2s', boxShadow: '0 1px 2px rgba(0,0,0,0.15)',
                    }} />
                  </button>

                  {/* Nombre */}
                  <span style={{ flex: 1, fontSize: 14, fontWeight: 500, color: '#0d0d14' }}>
                    {cat.nombre}
                  </span>

                  {/* Badge tipo */}
                  <span style={{
                    fontSize: 11, fontWeight: 500, padding: '3px 8px', borderRadius: 6,
                    background: TIPO_LABELS[cat.tipo_movimiento]?.color ?? '#f9fafb',
                    color: TIPO_LABELS[cat.tipo_movimiento]?.text ?? '#374151',
                    flexShrink: 0,
                  }}>
                    {TIPO_LABELS[cat.tipo_movimiento]?.label}
                  </span>

                  {/* Presupuesto si existe */}
                  {(cat.presupuesto ?? 0) > 0 && (
                    <span style={{ fontSize: 11, color: '#9ca3af', flexShrink: 0 }}>
                      {fmt(cat.presupuesto!)}
                    </span>
                  )}

                  {/* Eliminar */}
                  <button
                    onClick={() => eliminar(cat)}
                    disabled={eliminando === cat.id}
                    aria-label="Eliminar"
                    style={{ background: 'none', border: 'none', color: '#d1d5db', cursor: 'pointer', fontSize: 20, lineHeight: 1, padding: '0 0 0 4px', flexShrink: 0 }}>
                    {eliminando === cat.id ? '…' : '×'}
                  </button>
                </div>
              ))}
            </div>
          </div>
        ))}

        {/* Nota */}
        <div style={{ background: '#fffbeb', border: '0.5px solid #fde68a', borderRadius: 12, padding: '12px 16px', marginTop: 4 }}>
          <div style={{ fontSize: 12, color: '#92400e', lineHeight: 1.6 }}>
            <strong>Categorías inactivas</strong> no aparecen al registrar movimientos pero conservan su historial.<br />
            Solo puedes <strong>eliminar</strong> categorías sin movimientos.
          </div>
        </div>

      </div>
    </div>
  )
}
