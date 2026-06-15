'use client'
import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '../../../../../lib/supabase'

type Categoria = {
  id: string
  nombre: string
  tipo_cuenta: string
  tipo_movimiento: string
  activa: boolean
  presupuesto: number
  retiro_id: string
}

export default function CategoriasPage() {
  const router = useRouter()
  const [retiroId, setRetiroId] = useState('')
  const [categorias, setCategorias] = useState<Categoria[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [mostrarForm, setMostrarForm] = useState(false)
  const [nombre, setNombre] = useState('')
  const [tipoCuenta, setTipoCuenta] = useState('Nequi Effetá')
  const [tipoMovimiento, setTipoMovimiento] = useState('egreso')
  const [creando, setCreando] = useState(false)
  const [guardando, setGuardando] = useState('')
  const [eliminando, setEliminando] = useState('')

  useEffect(() => {
    cargar()
  }, [])

  async function cargar() {
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) { router.push('/'); return }
    const { data: r } = await supabase.from('retiros').select('id').eq('estado', 'activo').single()
    if (!r) return
    setRetiroId(r.id)
    const { data } = await supabase
      .from('categorias_financieras')
      .select('*')
      .eq('retiro_id', r.id)
      .order('tipo_cuenta')
      .order('nombre')
    if (data) setCategorias(data)
    setLoading(false)
  }

  async function toggleActiva(cat: Categoria) {
    setGuardando(cat.id)
    await supabase.from('categorias_financieras').update({ activa: !cat.activa }).eq('id', cat.id)
    setCategorias(prev => prev.map(c => c.id === cat.id ? { ...c, activa: !cat.activa } : c))
    setGuardando('')
  }

  async function eliminar(cat: Categoria) {
    if (!confirm(`¿Eliminar "${cat.nombre}"?`)) return
    setEliminando(cat.id)
    const { count } = await supabase.from('transacciones').select('id', { count: 'exact', head: true }).eq('categoria_id', cat.id)
    if ((count ?? 0) > 0) {
      setError(`"${cat.nombre}" tiene ${count} movimiento(s). Desactívala en lugar de eliminarla.`)
      setEliminando('')
      return
    }
    await supabase.from('categorias_financieras').delete().eq('id', cat.id)
    setCategorias(prev => prev.filter(c => c.id !== cat.id))
    setEliminando('')
  }

  async function crear() {
    if (!nombre.trim()) { setError('El nombre es obligatorio.'); return }
    setCreando(true)
    const { data, error: err } = await supabase
      .from('categorias_financieras')
      .insert({ nombre: nombre.trim(), tipo_cuenta: tipoCuenta, tipo_movimiento: tipoMovimiento, activa: true, retiro_id: retiroId, presupuesto: 0 })
      .select()
      .single()
    if (err) { setError('No se pudo crear.'); setCreando(false); return }
    setCategorias(prev => [...prev, data].sort((a, b) => a.nombre.localeCompare(b.nombre)))
    setNombre('')
    setMostrarForm(false)
    setCreando(false)
  }

  const grupos: Record<string, Categoria[]> = {}
  categorias.forEach(cat => {
    const k = cat.tipo_cuenta || 'Sin cuenta'
    if (!grupos[k]) grupos[k] = []
    grupos[k].push(cat)
  })

  if (loading) return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: '100vh', background: '#f7f8fc' }}>
      <p style={{ color: '#9ca3af', fontSize: 14 }}>Cargando...</p>
    </div>
  )

  return (
    <div style={{ background: '#f7f8fc', minHeight: '100vh', paddingBottom: 40 }}>

      <div style={{ background: '#0f1787', padding: '28px 20px 24px' }}>
        <button onClick={() => router.push('/dashboard/finanzas')}
          style={{ background: 'none', border: 'none', color: 'rgba(255,255,255,0.6)', fontSize: 14, cursor: 'pointer', padding: 0, marginBottom: 12 }}>
          ← Finanzas
        </button>
        <div style={{ fontSize: 22, fontWeight: 600, color: '#fff' }}>Categorías</div>
        <div style={{ fontSize: 13, color: 'rgba(255,255,255,0.5)', marginTop: 4 }}>
          {categorias.filter(c => c.activa).length} activas · {categorias.filter(c => !c.activa).length} inactivas
        </div>
      </div>

      <div style={{ padding: 20, display: 'flex', flexDirection: 'column', gap: 12 }}>

        {error !== '' && (
          <div style={{ background: '#fef2f2', border: '0.5px solid #fecaca', borderRadius: 12, padding: '12px 16px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span style={{ fontSize: 13, color: '#991b1b' }}>{error}</span>
            <button onClick={() => setError('')} style={{ background: 'none', border: 'none', color: '#fca5a5', cursor: 'pointer', fontSize: 20 }}>×</button>
          </div>
        )}

        <button onClick={() => { setMostrarForm(p => !p); setError('') }}
          style={{ background: mostrarForm ? '#f3f4f6' : '#0f1787', color: mostrarForm ? '#374151' : '#fff', border: '0.5px solid #e5e7eb', borderRadius: 12, padding: '13px 20px', fontSize: 14, fontWeight: 500, cursor: 'pointer' }}>
          {mostrarForm ? '✕ Cancelar' : '+ Nueva categoría'}
        </button>

        {mostrarForm && (
          <div style={{ background: '#fff', borderRadius: 14, border: '0.5px solid #e5e7eb', padding: 20, display: 'flex', flexDirection: 'column', gap: 14 }}>
            <div style={{ fontSize: 14, fontWeight: 600, color: '#0d0d14' }}>Nueva categoría</div>
            <div>
              <div style={{ fontSize: 11, color: '#9ca3af', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 6 }}>Nombre *</div>
              <input type="text" value={nombre} onChange={e => setNombre(e.target.value)} onKeyDown={e => e.key === 'Enter' && crear()}
                placeholder="Ej. Palancas, Pinares…"
                style={{ width: '100%', border: '0.5px solid #e5e7eb', borderRadius: 10, padding: '10px 14px', fontSize: 14, color: '#0d0d14', outline: 'none', boxSizing: 'border-box', background: '#fafafa' }} />
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
              <div>
                <div style={{ fontSize: 11, color: '#9ca3af', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 6 }}>Cuenta</div>
                <select value={tipoCuenta} onChange={e => setTipoCuenta(e.target.value)}
                  style={{ width: '100%', border: '0.5px solid #e5e7eb', borderRadius: 10, padding: '10px 12px', fontSize: 13, color: '#0d0d14', background: '#fafafa', outline: 'none' }}>
                  <option value="Nequi Effetá">Nequi Effetá</option>
                  <option value="Parroquia">Parroquia</option>
                </select>
              </div>
              <div>
                <div style={{ fontSize: 11, color: '#9ca3af', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 6 }}>Tipo</div>
                <select value={tipoMovimiento} onChange={e => setTipoMovimiento(e.target.value)}
                  style={{ width: '100%', border: '0.5px solid #e5e7eb', borderRadius: 10, padding: '10px 12px', fontSize: 13, color: '#0d0d14', background: '#fafafa', outline: 'none' }}>
                  <option value="egreso">Egreso</option>
                  <option value="ingreso">Ingreso</option>
                  <option value="ambos">Ambos</option>
                </select>
              </div>
            </div>
            <button onClick={crear} disabled={creando || !nombre.trim()}
              style={{ background: creando || !nombre.trim() ? '#e5e7eb' : '#0f1787', color: creando || !nombre.trim() ? '#9ca3af' : '#fff', border: 'none', borderRadius: 10, padding: 12, fontSize: 14, fontWeight: 500, cursor: creando || !nombre.trim() ? 'not-allowed' : 'pointer' }}>
              {creando ? 'Creando…' : 'Crear categoría'}
            </button>
          </div>
        )}

        {Object.entries(grupos).map(([cuenta, cats]) => (
          <div key={cuenta}>
            <div style={{ fontSize: 11, color: '#9ca3af', textTransform: 'uppercase', letterSpacing: '0.06em', fontWeight: 600, marginBottom: 8, paddingLeft: 2 }}>{cuenta}</div>
            <div style={{ background: '#fff', borderRadius: 14, border: '0.5px solid #e5e7eb', overflow: 'hidden' }}>
              {cats.map((cat, i) => (
                <div key={cat.id} style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '13px 16px', borderTop: i > 0 ? '0.5px solid #f3f4f6' : 'none', opacity: cat.activa ? 1 : 0.4 }}>
                  <button onClick={() => toggleActiva(cat)} disabled={guardando === cat.id}
                    style={{ position: 'relative', width: 40, height: 22, borderRadius: 11, background: cat.activa ? '#0f1787' : '#d1d5db', border: 'none', cursor: 'pointer', flexShrink: 0, opacity: guardando === cat.id ? 0.5 : 1 }}>
                    <span style={{ position: 'absolute', top: 3, left: cat.activa ? 21 : 3, width: 16, height: 16, borderRadius: '50%', background: '#fff', transition: 'left 0.2s', display: 'block' }} />
                  </button>
                  <span style={{ flex: 1, fontSize: 14, fontWeight: 500, color: '#0d0d14' }}>{cat.nombre}</span>
                  <span style={{ fontSize: 11, fontWeight: 500, padding: '3px 8px', borderRadius: 6, background: cat.tipo_movimiento === 'ingreso' ? '#f0fdf4' : cat.tipo_movimiento === 'egreso' ? '#fef2f2' : '#f9fafb', color: cat.tipo_movimiento === 'ingreso' ? '#166534' : cat.tipo_movimiento === 'egreso' ? '#991b1b' : '#374151', flexShrink: 0 }}>
                    {cat.tipo_movimiento === 'ingreso' ? 'Ingreso' : cat.tipo_movimiento === 'egreso' ? 'Egreso' : 'Ambos'}
                  </span>
                  <button onClick={() => eliminar(cat)} disabled={eliminando === cat.id}
                    style={{ background: 'none', border: 'none', color: '#d1d5db', cursor: 'pointer', fontSize: 20, lineHeight: 1, padding: '0 0 0 4px', flexShrink: 0 }}>
                    {eliminando === cat.id ? '…' : '×'}
                  </button>
                </div>
              ))}
            </div>
          </div>
        ))}

        <div style={{ background: '#fffbeb', border: '0.5px solid #fde68a', borderRadius: 12, padding: '12px 16px' }}>
          <div style={{ fontSize: 12, color: '#92400e', lineHeight: 1.6 }}>
            <strong>Categorías inactivas</strong> no aparecen al registrar movimientos pero conservan su historial. Solo puedes <strong>eliminar</strong> categorías sin movimientos.
          </div>
        </div>

      </div>
    </div>
  )
}
