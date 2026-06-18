'use client'
import { useEffect, useState, useCallback } from 'react'
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
  comprobante_url: string | null
  comprobante_nombre: string | null
  categorias_financieras?: { nombre: string }
}

type Categoria = {
  id: string
  nombre: string
  presupuesto: number
  tipo_cuenta: string
  tipo_movimiento?: string
  activa?: boolean
}

type CotItem = {
  id: string
  retiro_id: string
  categoria: string
  producto: string
  cantidad: string
  precio_total: number
  precio_unidad: number
  proveedor: string
  pagado: boolean
  notas: string
  fila_sheet: number | null
}

function fmt(n: number) { return `$${Number(n).toLocaleString('es-CO')}` }

const CATS_PARROQUIA = ['Inscripciones caminantes', 'Inscripciones servidores', 'Casa de retiros']
const SHEET_ID_COTIZACIONES = '1EB-8QHKlst9EEgEd2Kd2Mf7W2KZXhwamwRqrHyvEA48'
const SHEETS_API_KEY = 'AIzaSyCFp4MHCcKKOgeirEpccEoeO_5W5Qff4aE'
const GOOGLE_CLIENT_ID = '309085978370-38krrj9n4bkr9lsa7d01nungtesofmvr.apps.googleusercontent.com'
const OAUTH_SCOPE = 'https://www.googleapis.com/auth/spreadsheets'
const REDIRECT_URI = 'https://effeta-mazuren-app.vercel.app/dashboard/finanzas'
const APP_SHEET = 'App Cotizaciones'

const CATS_EXCEL = ['TORNEO', 'SNACKS', 'MATERIALES RELIGIOSOS', 'SANTISIMO', 'MATERIALES LOGISTICOS', 'MUSICA', 'CASA PINARES - MATRICULAS Y RIFA', 'ROPA', 'VENTAS 1ERA FECHA', 'VENTAS 2NDA FECHA', 'VENTAS 3ERA FECHA']

export default function FinanzasPage() {
  const router = useRouter()
  const [tab, setTab] = useState<'resumen' | 'ingresos' | 'egresos' | 'comprobantes' | 'categorias' | 'cotizaciones'>('resumen')
  const [transacciones, setTransacciones] = useState<Transaccion[]>([])
  const [categorias, setCategorias] = useState<Categoria[]>([])
  const [todasCategorias, setTodasCategorias] = useState<Categoria[]>([])
  const [loading, setLoading] = useState(true)
  const [retiroId, setRetiroId] = useState('')
  const [totalPagadoCaminantes, setTotalPagadoCaminantes] = useState(0)
  const [totalPagadoServidores, setTotalPagadoServidores] = useState(0)
  const [imagenAmpliada, setImagenAmpliada] = useState<Transaccion | null>(null)
  const [filtroCategoria, setFiltroCategoria] = useState<string>('todas')

  // Estado tab categorias
  const [catError, setCatError] = useState('')
  const [catMostrarForm, setCatMostrarForm] = useState(false)
  const [catNombre, setCatNombre] = useState('')
  const [catCuenta, setCatCuenta] = useState('Nequi Effetá')
  const [catTipo, setCatTipo] = useState('egreso')
  const [catCreando, setCatCreando] = useState(false)
  const [catGuardando, setCatGuardando] = useState('')
  const [catEliminando, setCatEliminando] = useState('')

  // Estado tab cotizaciones
  const [cotItems, setCotItems] = useState<CotItem[]>([])
  const [cotLoading, setCotLoading] = useState(false)
  const [cotError, setCotError] = useState('')
  const [cotFiltro, setCotFiltro] = useState<'todos' | 'pagados' | 'pendientes'>('todos')
  const [cotCatFiltro, setCotCatFiltro] = useState<string>('todas')
  const [googleToken, setGoogleToken] = useState<string | null>(null)
  const [sincronizando, setSincronizando] = useState(false)

  // Formulario nueva cotización
  const [mostrarFormCot, setMostrarFormCot] = useState(false)
  const [cotForm, setCotForm] = useState({ categoria: CATS_EXCEL[0], producto: '', cantidad: '', precioUnidad: '', precioTotal: '', proveedor: '', notas: '' })
  const [cotGuardando, setCotGuardando] = useState(false)
  const [cotMensaje, setCotMensaje] = useState('')

  // Edición inline
  const [editandoId, setEditandoId] = useState<string | null>(null)
  const [editForm, setEditForm] = useState({ producto: '', cantidad: '', precio_total: '', precio_unidad: '', proveedor: '', notas: '' })
  const [editGuardando, setEditGuardando] = useState(false)

  // Procesar token OAuth
  useEffect(() => {
    if (typeof window === 'undefined') return
    const hash = window.location.hash
    if (hash.includes('access_token')) {
      const params = new URLSearchParams(hash.replace('#', ''))
      const token = params.get('access_token')
      if (token) {
        setGoogleToken(token)
        sessionStorage.setItem('google_sheets_token', token)
        setTab('cotizaciones')
        window.history.replaceState(null, '', window.location.pathname)
      }
    } else {
      const saved = sessionStorage.getItem('google_sheets_token')
      if (saved) setGoogleToken(saved)
    }
  }, [])

  useEffect(() => { cargar() }, [])

  useEffect(() => {
    if (tab === 'cotizaciones' && retiroId && cotItems.length === 0) {
      cargarCotizacionesDB()
    }
  }, [tab, retiroId])

  function conectarGoogle() {
    const url = `https://accounts.google.com/o/oauth2/v2/auth?client_id=${GOOGLE_CLIENT_ID}&redirect_uri=${encodeURIComponent(REDIRECT_URI)}&response_type=token&scope=${encodeURIComponent(OAUTH_SCOPE)}&prompt=consent`
    window.location.href = url
  }

  function desconectarGoogle() {
    setGoogleToken(null)
    sessionStorage.removeItem('google_sheets_token')
  }

  function parsePeso(str: string): number {
    if (!str) return 0
    return Number(str.replace(/[$\s.]/g, '').replace(/,/g, '.').replace(/[^0-9.]/g, '')) || 0
  }

  async function cargar() {
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) { router.push('/'); return }
    const { data: u } = await supabase.from('usuarios').select('rol').eq('id', user.id).single()
    if (!u || u.rol !== 'lider') { router.push('/dashboard'); return }
    const { data: r } = await supabase.from('retiros').select('id').eq('estado', 'activo').single()
    if (!r) return
    setRetiroId(r.id)
    const { data: cats } = await supabase.from('categorias_financieras').select('*').eq('retiro_id', r.id).order('orden')
    if (cats) {
      setTodasCategorias(cats)
      setCategorias(cats.filter((c: Categoria) => c.activa !== false).map((c: Categoria) => ({ ...c, tipo_cuenta: CATS_PARROQUIA.includes(c.nombre) ? 'parroquia' : 'effeta' })))
    }
    const { data: tx } = await supabase.from('transacciones').select('*, categorias_financieras(nombre)').eq('retiro_id', r.id).eq('estado', 'aprobado').order('fecha', { ascending: false })
    if (tx) setTransacciones(tx as Transaccion[])
    const { data: pagCam } = await supabase.from('pagos').select('valor').eq('tipo_persona', 'caminante')
    setTotalPagadoCaminantes(pagCam?.reduce((s, p) => s + Number(p.valor), 0) ?? 0)
    const { data: pagSer } = await supabase.from('pagos').select('valor').eq('tipo_persona', 'servidor')
    setTotalPagadoServidores(pagSer?.reduce((s, p) => s + Number(p.valor), 0) ?? 0)
    setLoading(false)
  }

  // Cargar items desde Supabase
  async function cargarCotizacionesDB() {
    setCotLoading(true)
    setCotError('')
    try {
      const { data, error } = await supabase
        .from('cotizaciones_items')
        .select('*')
        .eq('retiro_id', retiroId)
        .order('categoria')
        .order('producto')
      if (error) throw error
      setCotItems(data ?? [])
    } catch {
      setCotError('No se pudieron cargar las cotizaciones.')
    }
    setCotLoading(false)
  }

  // Sincronizar desde Google Sheets → Supabase (no borra items existentes, hace upsert por categoria+producto)
  async function sincronizarDesdeSheet() {
    const token = googleToken || sessionStorage.getItem('google_sheets_token')
    if (!token) { setCotError('Primero conecta tu cuenta Google.'); return }
    setSincronizando(true)
    setCotError('')
    try {
      const url = `https://sheets.googleapis.com/v4/spreadsheets/${SHEET_ID_COTIZACIONES}/values/${encodeURIComponent(APP_SHEET)}!A2:F500`
      const res = await fetch(url, { headers: { 'Authorization': `Bearer ${token}` } })
      if (res.status === 401) { desconectarGoogle(); setCotError('Sesión Google expirada. Vuelve a conectar.'); setSincronizando(false); return }
      const data = await res.json()
      const filas: string[][] = data.values || []

      const itemsSheet: Omit<CotItem, 'id' | 'pagado' | 'notas'>[] = filas
        .filter(f => f[0] && f[1])
        .map((f, idx) => ({
          retiro_id: retiroId,
          categoria: (f[0] || '').trim().toUpperCase(),
          producto: (f[1] || '').trim(),
          cantidad: f[2] || '',
          precio_unidad: parsePeso(f[3] || '0'),
          precio_total: parsePeso(f[4] || '0'),
          proveedor: f[5] || '',
          fila_sheet: idx + 2,
        }))

      // Upsert: mantiene pagado/notas existentes
      for (const item of itemsSheet) {
        const { data: existing } = await supabase
          .from('cotizaciones_items')
          .select('id, pagado, notas')
          .eq('retiro_id', retiroId)
          .eq('categoria', item.categoria)
          .eq('producto', item.producto)
          .maybeSingle()

        if (existing) {
          await supabase.from('cotizaciones_items').update({
            cantidad: item.cantidad,
            precio_total: item.precio_total,
            precio_unidad: item.precio_unidad,
            proveedor: item.proveedor,
            fila_sheet: item.fila_sheet,
          }).eq('id', existing.id)
        } else {
          await supabase.from('cotizaciones_items').insert({ ...item, pagado: false, notas: '' })
        }
      }
      await cargarCotizacionesDB()
      setCotMensaje('Sincronización completada.')
      setTimeout(() => setCotMensaje(''), 2500)
    } catch {
      setCotError('Error al sincronizar con Google Sheets.')
    }
    setSincronizando(false)
  }

  // Marcar/desmarcar pagado en Supabase
  async function togglePagado(item: CotItem) {
    const nuevoPagado = !item.pagado
    setCotItems(prev => prev.map(i => i.id === item.id ? { ...i, pagado: nuevoPagado } : i))
    await supabase.from('cotizaciones_items').update({ pagado: nuevoPagado, updated_at: new Date().toISOString() }).eq('id', item.id)
  }

  // Guardar edición
  async function guardarEdicion(item: CotItem) {
    setEditGuardando(true)
    const updates = {
      producto: editForm.producto.trim() || item.producto,
      cantidad: editForm.cantidad,
      precio_total: parsePeso(editForm.precio_total) || item.precio_total,
      precio_unidad: parsePeso(editForm.precio_unidad) || item.precio_unidad,
      proveedor: editForm.proveedor,
      notas: editForm.notas,
      updated_at: new Date().toISOString(),
    }
    await supabase.from('cotizaciones_items').update(updates).eq('id', item.id)

    // Actualizar en Sheet si tiene fila
    const token = googleToken || sessionStorage.getItem('google_sheets_token')
    if (token && item.fila_sheet) {
      try {
        const fila = [item.categoria, updates.producto, updates.cantidad, String(updates.precio_unidad), String(updates.precio_total), updates.proveedor]
        await fetch(`https://sheets.googleapis.com/v4/spreadsheets/${SHEET_ID_COTIZACIONES}/values/${encodeURIComponent(APP_SHEET)}!A${item.fila_sheet}:F${item.fila_sheet}?valueInputOption=USER_ENTERED`, {
          method: 'PUT',
          headers: { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' },
          body: JSON.stringify({ values: [fila] })
        })
      } catch { /* silencioso si falla el sheet */ }
    }

    setCotItems(prev => prev.map(i => i.id === item.id ? { ...i, ...updates } : i))
    setEditandoId(null)
    setEditGuardando(false)
  }

  // Eliminar item
  async function eliminarItem(item: CotItem) {
    if (!confirm(`¿Eliminar "${item.producto}"?`)) return
    await supabase.from('cotizaciones_items').delete().eq('id', item.id)
    setCotItems(prev => prev.filter(i => i.id !== item.id))

    // Borrar fila en Sheet si tiene token y fila
    const token = googleToken || sessionStorage.getItem('google_sheets_token')
    if (token && item.fila_sheet) {
      try {
        // Obtener sheetId del App Cotizaciones
        const metaRes = await fetch(`https://sheets.googleapis.com/v4/spreadsheets/${SHEET_ID_COTIZACIONES}?fields=sheets.properties`, { headers: { 'Authorization': `Bearer ${token}` } })
        const meta = await metaRes.json()
        const sheet = meta.sheets?.find((s: { properties: { title: string; sheetId: number } }) => s.properties.title === APP_SHEET)
        if (sheet) {
          await fetch(`https://sheets.googleapis.com/v4/spreadsheets/${SHEET_ID_COTIZACIONES}:batchUpdate`, {
            method: 'POST',
            headers: { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' },
            body: JSON.stringify({ requests: [{ deleteDimension: { range: { sheetId: sheet.properties.sheetId, dimension: 'ROWS', startIndex: item.fila_sheet - 1, endIndex: item.fila_sheet } } }] })
          })
        }
      } catch { /* silencioso */ }
    }
  }

  // Agregar nuevo item
  async function agregarItem() {
    if (!cotForm.producto.trim()) { setCotMensaje('El producto es obligatorio.'); return }
    setCotGuardando(true)
    setCotMensaje('')
    try {
      const precioU = parsePeso(cotForm.precioUnidad)
      const precioT = cotForm.precioTotal ? parsePeso(cotForm.precioTotal) : (precioU * (Number(cotForm.cantidad) || 1))
      const newItem = {
        retiro_id: retiroId,
        categoria: cotForm.categoria,
        producto: cotForm.producto.trim(),
        cantidad: cotForm.cantidad || '1',
        precio_unidad: precioU,
        precio_total: precioT,
        proveedor: cotForm.proveedor,
        notas: cotForm.notas,
        pagado: false,
        fila_sheet: null,
      }
      const { data, error } = await supabase.from('cotizaciones_items').insert(newItem).select().single()
      if (error) throw error

      // Agregar al Sheet App Cotizaciones
      const token = googleToken || sessionStorage.getItem('google_sheets_token')
      if (token) {
        try {
          const fila = [cotForm.categoria, cotForm.producto.trim(), cotForm.cantidad || '1', String(precioU), String(precioT), cotForm.proveedor]
          const appendRes = await fetch(`https://sheets.googleapis.com/v4/spreadsheets/${SHEET_ID_COTIZACIONES}/values/${encodeURIComponent(APP_SHEET)}!A:F/append?valueInputOption=USER_ENTERED&insertDataOption=INSERT_ROWS`, {
            method: 'POST',
            headers: { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' },
            body: JSON.stringify({ values: [fila] })
          })
          const appendData = await appendRes.json()
          const range = appendData.updates?.updatedRange
          if (range) {
            const match = range.match(/!A(\d+)/)
            if (match) {
              await supabase.from('cotizaciones_items').update({ fila_sheet: Number(match[1]) }).eq('id', data.id)
              data.fila_sheet = Number(match[1])
            }
          }
        } catch { /* silencioso */ }
      }

      setCotItems(prev => [...prev, data])
      setCotForm({ categoria: CATS_EXCEL[0], producto: '', cantidad: '', precioUnidad: '', precioTotal: '', proveedor: '', notas: '' })
      setMostrarFormCot(false)
      setCotMensaje('Ítem agregado.')
      setTimeout(() => setCotMensaje(''), 2000)
    } catch {
      setCotMensaje('No se pudo guardar. Intenta de nuevo.')
    }
    setCotGuardando(false)
  }

  // ── Funciones categorías ──────────────────────────────────────────────────
  async function toggleActiva(cat: Categoria) {
    setCatGuardando(cat.id)
    await supabase.from('categorias_financieras').update({ activa: !cat.activa }).eq('id', cat.id)
    setTodasCategorias(prev => prev.map(c => c.id === cat.id ? { ...c, activa: !cat.activa } : c))
    setCatGuardando('')
  }

  async function eliminarCat(cat: Categoria) {
    if (!confirm(`¿Eliminar "${cat.nombre}"?`)) return
    setCatEliminando(cat.id)
    const { count } = await supabase.from('transacciones').select('id', { count: 'exact', head: true }).eq('categoria_id', cat.id)
    if ((count ?? 0) > 0) {
      setCatError(`"${cat.nombre}" tiene ${count} movimiento(s). Desactívala en lugar de eliminarla.`)
      setCatEliminando('')
      return
    }
    await supabase.from('categorias_financieras').delete().eq('id', cat.id)
    setTodasCategorias(prev => prev.filter(c => c.id !== cat.id))
    setCatEliminando('')
  }

  async function crearCat() {
    if (!catNombre.trim()) { setCatError('El nombre es obligatorio.'); return }
    setCatCreando(true)
    const { data, error } = await supabase.from('categorias_financieras').insert({ nombre: catNombre.trim(), tipo_cuenta: catCuenta, tipo_movimiento: catTipo, activa: true, retiro_id: retiroId, presupuesto: 0 }).select().single()
    if (error) { setCatError('No se pudo crear.'); setCatCreando(false); return }
    setTodasCategorias(prev => [...prev, data])
    setCatNombre('')
    setCatMostrarForm(false)
    setCatCreando(false)
  }

  // ── Cálculos ──────────────────────────────────────────────────────────────
  const ingresosEffeta = transacciones.filter(t => t.tipo === 'ingreso').reduce((s, t) => s + Number(t.valor), 0)
  const egresosEffeta = transacciones.filter(t => t.tipo === 'egreso').reduce((s, t) => s + Number(t.valor), 0)
  const balanceEffeta = ingresosEffeta - egresosEffeta
  const totalParroquia = totalPagadoCaminantes + totalPagadoServidores
  const casaRetiros = categorias.find(c => c.nombre === 'Casa de retiros')?.presupuesto ?? 39000000
  const saldoParroquia = totalParroquia - casaRetiros
  const txIngresos = transacciones.filter(t => t.tipo === 'ingreso')
  const txEgresos = transacciones.filter(t => t.tipo === 'egreso')
  const txConComprobante = transacciones.filter(t => t.comprobante_url)

  // Cálculos cotizaciones
  const cotCats = [...new Set(cotItems.map(i => i.categoria))].sort()
  const cotItemsFiltrados = cotItems.filter(item => {
    const matchCat = cotCatFiltro === 'todas' || item.categoria === cotCatFiltro
    const matchPago = cotFiltro === 'todos' || (cotFiltro === 'pagados' ? item.pagado : !item.pagado)
    return matchCat && matchPago
  })
  const totalCotizado = cotItems.reduce((s, i) => s + (i.precio_total || 0), 0)
  const totalPagadoCot = cotItems.filter(i => i.pagado).reduce((s, i) => s + (i.precio_total || 0), 0)
  const totalPendienteCot = totalCotizado - totalPagadoCot
  const porcentajePagado = totalCotizado > 0 ? (totalPagadoCot / totalCotizado) * 100 : 0

  // Agrupar por categoria para mostrar
  const groupByCat = cotItemsFiltrados.reduce<Record<string, CotItem[]>>((acc, item) => {
    if (!acc[item.categoria]) acc[item.categoria] = []
    acc[item.categoria].push(item)
    return acc
  }, {})

  const gruposCats = todasCategorias.reduce<Record<string, Categoria[]>>((acc, cat) => {
    const k = cat.tipo_cuenta || 'Sin cuenta'
    if (!acc[k]) acc[k] = []
    acc[k].push(cat)
    return acc
  }, {})

  const COLORES = [
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
        <div style={{ fontSize: 36, fontWeight: 600, color: '#fff', letterSpacing: '-0.5px' }}>{fmt(balanceEffeta)}</div>
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
          { key: 'comprobantes', label: `🧾 ${txConComprobante.length}` },
          { key: 'categorias', label: '🗂 Categorías' },
          { key: 'cotizaciones', label: '📋 Cotizaciones' },
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
                  <span style={{ fontSize: 13, fontWeight: 500, color: '#166534' }}>{fmt(totalPagadoServidores)}</span>
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
              const ing = transacciones.filter(t => t.categoria_id === cat.id && t.tipo === 'ingreso').reduce((s, t) => s + Number(t.valor), 0)
              const egr = transacciones.filter(t => t.categoria_id === cat.id && t.tipo === 'egreso').reduce((s, t) => s + Number(t.valor), 0)
              const balance = ing - egr
              const hayMov = ing > 0 || egr > 0
              return (
                <div key={cat.id} onClick={() => router.push(`/dashboard/finanzas/categoria/${cat.id}`)}
                  style={{ background: '#fff', borderRadius: 14, padding: '14px 16px', border: '0.5px solid #e5e7eb', display: 'flex', alignItems: 'center', justifyContent: 'space-between', cursor: 'pointer' }}>
                  <div>
                    <div style={{ fontSize: 14, fontWeight: 500, color: '#0d0d14' }}>{cat.nombre}</div>
                    {hayMov && (
                      <div style={{ fontSize: 11, color: '#9ca3af', marginTop: 2 }}>
                        {ing > 0 && <span style={{ color: '#16a34a' }}>↑ {fmt(ing)} </span>}
                        {egr > 0 && <span style={{ color: '#dc2626' }}>↓ {fmt(egr)}</span>}
                      </div>
                    )}
                  </div>
                  <div style={{ textAlign: 'right' }}>
                    <div style={{ fontSize: 14, fontWeight: 600, color: !hayMov ? '#9ca3af' : balance >= 0 ? '#166534' : '#dc2626' }}>
                      {hayMov ? fmt(balance) : '—'}
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
            <div style={{ display: 'flex', gap: 8, overflowX: 'auto', scrollbarWidth: 'none', paddingBottom: 4 }}>
              <button onClick={() => setFiltroCategoria('todas')} style={{ padding: '6px 14px', borderRadius: 20, fontSize: 12, fontWeight: 500, whiteSpace: 'nowrap', cursor: 'pointer', border: '0.5px solid #e5e7eb', background: filtroCategoria === 'todas' ? '#0f1787' : '#fff', color: filtroCategoria === 'todas' ? '#fff' : '#6b7280' }}>
                Todas · {txConComprobante.length}
              </button>
              {categorias.filter(c => c.tipo_cuenta === 'effeta' && txConComprobante.some(t => t.categoria_id === c.id)).map(cat => (
                <button key={cat.id} onClick={() => setFiltroCategoria(cat.id)} style={{ padding: '6px 14px', borderRadius: 20, fontSize: 12, fontWeight: 500, whiteSpace: 'nowrap', cursor: 'pointer', border: '0.5px solid #e5e7eb', background: filtroCategoria === cat.id ? '#0f1787' : '#fff', color: filtroCategoria === cat.id ? '#fff' : '#6b7280' }}>
                  {cat.nombre} · {txConComprobante.filter(t => t.categoria_id === cat.id).length}
                </button>
              ))}
            </div>
            {txConComprobante.length === 0 ? (
              <div style={{ textAlign: 'center', color: '#9ca3af', fontSize: 14, padding: 40 }}>
                <div style={{ fontSize: 32, marginBottom: 8 }}>🧾</div>
                <div>Sin comprobantes subidos</div>
              </div>
            ) : filtroCategoria === 'todas' ? (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
                {categorias.filter(c => c.tipo_cuenta === 'effeta' && txConComprobante.some(t => t.categoria_id === c.id)).map((cat, idx) => {
                  const color = COLORES[idx % COLORES.length]
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
                              <div style={{ fontSize: 11, fontWeight: 600, color: t.tipo === 'ingreso' ? '#16a34a' : '#dc2626', marginTop: 2 }}>{t.tipo === 'egreso' ? '−' : '+'}{fmt(t.valor)}</div>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  )
                })}
              </div>
            ) : (
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
                {txConComprobante.filter(t => t.categoria_id === filtroCategoria).map(t => (
                  <div key={t.id} onClick={() => setImagenAmpliada(t)} style={{ background: '#fff', borderRadius: 14, border: '0.5px solid #e5e7eb', overflow: 'hidden', cursor: 'pointer' }}>
                    <img src={t.comprobante_url!} alt={t.descripcion} style={{ width: '100%', height: 130, objectFit: 'cover', display: 'block' }} />
                    <div style={{ padding: '10px 12px' }}>
                      <div style={{ fontSize: 12, fontWeight: 500, color: '#0d0d14', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{t.descripcion}</div>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: 4 }}>
                        <span style={{ fontSize: 11, color: '#9ca3af' }}>{new Date(t.fecha).toLocaleDateString('es-CO', { day: 'numeric', month: 'short' })}</span>
                        <span style={{ fontSize: 11, fontWeight: 600, color: t.tipo === 'ingreso' ? '#16a34a' : '#dc2626' }}>{t.tipo === 'egreso' ? '−' : '+'}{fmt(t.valor)}</span>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </>
        )}

        {/* ── CATEGORÍAS ── */}
        {tab === 'categorias' && (
          <>
            <div style={{ fontSize: 13, color: '#6b7280' }}>
              {todasCategorias.filter(c => c.activa !== false).length} activas · {todasCategorias.filter(c => c.activa === false).length} inactivas
            </div>
            {catError !== '' && (
              <div style={{ background: '#fef2f2', border: '0.5px solid #fecaca', borderRadius: 12, padding: '12px 16px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span style={{ fontSize: 13, color: '#991b1b' }}>{catError}</span>
                <button onClick={() => setCatError('')} style={{ background: 'none', border: 'none', color: '#fca5a5', cursor: 'pointer', fontSize: 20 }}>×</button>
              </div>
            )}
            <button onClick={() => { setCatMostrarForm(p => !p); setCatError('') }}
              style={{ background: catMostrarForm ? '#f3f4f6' : '#0f1787', color: catMostrarForm ? '#374151' : '#fff', border: '0.5px solid #e5e7eb', borderRadius: 12, padding: '13px 20px', fontSize: 14, fontWeight: 500, cursor: 'pointer' }}>
              {catMostrarForm ? '✕ Cancelar' : '+ Nueva categoría'}
            </button>
            {catMostrarForm && (
              <div style={{ background: '#fff', borderRadius: 14, border: '0.5px solid #e5e7eb', padding: 20, display: 'flex', flexDirection: 'column', gap: 14 }}>
                <div style={{ fontSize: 14, fontWeight: 600, color: '#0d0d14' }}>Nueva categoría</div>
                <div>
                  <div style={{ fontSize: 11, color: '#9ca3af', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 6 }}>Nombre *</div>
                  <input type="text" value={catNombre} onChange={e => setCatNombre(e.target.value)} onKeyDown={e => e.key === 'Enter' && crearCat()} placeholder="Ej. Palancas, Pinares…"
                    style={{ width: '100%', border: '0.5px solid #e5e7eb', borderRadius: 10, padding: '10px 14px', fontSize: 14, color: '#0d0d14', outline: 'none', boxSizing: 'border-box', background: '#fafafa' }} />
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
                  <div>
                    <div style={{ fontSize: 11, color: '#9ca3af', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 6 }}>Cuenta</div>
                    <select value={catCuenta} onChange={e => setCatCuenta(e.target.value)} style={{ width: '100%', border: '0.5px solid #e5e7eb', borderRadius: 10, padding: '10px 12px', fontSize: 13, color: '#0d0d14', background: '#fafafa', outline: 'none' }}>
                      <option value="Nequi Effetá">Nequi Effetá</option>
                      <option value="Parroquia">Parroquia</option>
                    </select>
                  </div>
                  <div>
                    <div style={{ fontSize: 11, color: '#9ca3af', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 6 }}>Tipo</div>
                    <select value={catTipo} onChange={e => setCatTipo(e.target.value)} style={{ width: '100%', border: '0.5px solid #e5e7eb', borderRadius: 10, padding: '10px 12px', fontSize: 13, color: '#0d0d14', background: '#fafafa', outline: 'none' }}>
                      <option value="egreso">Egreso</option>
                      <option value="ingreso">Ingreso</option>
                      <option value="ambos">Ambos</option>
                    </select>
                  </div>
                </div>
                <button onClick={crearCat} disabled={catCreando || !catNombre.trim()}
                  style={{ background: catCreando || !catNombre.trim() ? '#e5e7eb' : '#0f1787', color: catCreando || !catNombre.trim() ? '#9ca3af' : '#fff', border: 'none', borderRadius: 10, padding: 12, fontSize: 14, fontWeight: 500, cursor: catCreando || !catNombre.trim() ? 'not-allowed' : 'pointer' }}>
                  {catCreando ? 'Creando…' : 'Crear categoría'}
                </button>
              </div>
            )}
            {Object.entries(gruposCats).map(([cuenta, cats]) => (
              <div key={cuenta}>
                <div style={{ fontSize: 11, color: '#9ca3af', textTransform: 'uppercase', letterSpacing: '0.06em', fontWeight: 600, marginBottom: 8, paddingLeft: 2 }}>{cuenta}</div>
                <div style={{ background: '#fff', borderRadius: 14, border: '0.5px solid #e5e7eb', overflow: 'hidden' }}>
                  {cats.map((cat, i) => (
                    <div key={cat.id} style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '13px 16px', borderTop: i > 0 ? '0.5px solid #f3f4f6' : 'none', opacity: cat.activa === false ? 0.4 : 1 }}>
                      <button onClick={() => toggleActiva(cat)} disabled={catGuardando === cat.id}
                        style={{ position: 'relative', width: 40, height: 22, borderRadius: 11, background: cat.activa === false ? '#d1d5db' : '#0f1787', border: 'none', cursor: 'pointer', flexShrink: 0, opacity: catGuardando === cat.id ? 0.5 : 1 }}>
                        <span style={{ position: 'absolute', top: 3, left: cat.activa === false ? 3 : 21, width: 16, height: 16, borderRadius: '50%', background: '#fff', transition: 'left 0.2s', display: 'block' }} />
                      </button>
                      <span style={{ flex: 1, fontSize: 14, fontWeight: 500, color: '#0d0d14' }}>{cat.nombre}</span>
                      <span style={{ fontSize: 11, fontWeight: 500, padding: '3px 8px', borderRadius: 6, background: cat.tipo_movimiento === 'ingreso' ? '#f0fdf4' : cat.tipo_movimiento === 'egreso' ? '#fef2f2' : '#f9fafb', color: cat.tipo_movimiento === 'ingreso' ? '#166534' : cat.tipo_movimiento === 'egreso' ? '#991b1b' : '#374151', flexShrink: 0 }}>
                        {cat.tipo_movimiento === 'ingreso' ? 'Ingreso' : cat.tipo_movimiento === 'egreso' ? 'Egreso' : 'Ambos'}
                      </span>
                      <button onClick={() => eliminarCat(cat)} disabled={catEliminando === cat.id}
                        style={{ background: 'none', border: 'none', color: '#d1d5db', cursor: 'pointer', fontSize: 20, lineHeight: 1, padding: '0 0 0 4px', flexShrink: 0 }}>
                        {catEliminando === cat.id ? '…' : '×'}
                      </button>
                    </div>
                  ))}
                </div>
              </div>
            ))}
            <div style={{ background: '#fffbeb', border: '0.5px solid #fde68a', borderRadius: 12, padding: '12px 16px' }}>
              <div style={{ fontSize: 12, color: '#92400e', lineHeight: 1.6 }}>
                <strong>Categorías inactivas</strong> no aparecen al registrar movimientos pero conservan su historial.
              </div>
            </div>
          </>
        )}

        {/* ── COTIZACIONES ── */}
        {tab === 'cotizaciones' && (
          <>
            {/* Balance header */}
            <div style={{ background: '#0f1787', borderRadius: 16, padding: '18px 20px' }}>
              <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.55)', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 12 }}>Balance cotizaciones</div>
              <div style={{ display: 'flex', gap: 0, justifyContent: 'space-between' }}>
                <div>
                  <div style={{ fontSize: 22, fontWeight: 700, color: '#fff' }}>{fmt(totalCotizado)}</div>
                  <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.5)', marginTop: 2 }}>total cotizado</div>
                </div>
                <div style={{ width: '0.5px', background: 'rgba(255,255,255,0.1)' }} />
                <div style={{ textAlign: 'center' }}>
                  <div style={{ fontSize: 22, fontWeight: 700, color: '#86efac' }}>{fmt(totalPagadoCot)}</div>
                  <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.5)', marginTop: 2 }}>pagado</div>
                </div>
                <div style={{ width: '0.5px', background: 'rgba(255,255,255,0.1)' }} />
                <div style={{ textAlign: 'right' }}>
                  <div style={{ fontSize: 22, fontWeight: 700, color: '#fca5a5' }}>{fmt(totalPendienteCot)}</div>
                  <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.5)', marginTop: 2 }}>pendiente</div>
                </div>
              </div>
              <div style={{ marginTop: 14 }}>
                <div style={{ height: 6, background: 'rgba(255,255,255,0.1)', borderRadius: 3, overflow: 'hidden' }}>
                  <div style={{ height: 6, background: '#86efac', borderRadius: 3, width: `${porcentajePagado}%`, transition: 'width 0.5s' }} />
                </div>
                <div style={{ fontSize: 10, color: 'rgba(255,255,255,0.4)', marginTop: 5, textAlign: 'right' }}>{porcentajePagado.toFixed(0)}% pagado</div>
              </div>
            </div>

            {/* Google + Sincronizar */}
            {!googleToken ? (
              <div style={{ background: '#eff6ff', border: '0.5px solid #bfdbfe', borderRadius: 14, padding: '16px' }}>
                <div style={{ fontSize: 13, fontWeight: 600, color: '#1e40af', marginBottom: 6 }}>Conecta Google para sincronizar y editar</div>
                <div style={{ fontSize: 12, color: '#3b82f6', marginBottom: 14, lineHeight: 1.6 }}>
                  Necesitas conectar la cuenta Google con acceso al Sheet para sincronizar ítems y reflejar cambios en el Excel.
                </div>
                <button onClick={conectarGoogle} style={{ background: '#0f1787', color: '#fff', border: 'none', borderRadius: 10, padding: '11px 20px', fontSize: 13, fontWeight: 500, cursor: 'pointer', width: '100%' }}>
                  Conectar con Google
                </button>
              </div>
            ) : (
              <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                <div style={{ flex: 1, background: '#f0fdf4', border: '0.5px solid #bbf7d0', borderRadius: 10, padding: '10px 14px', fontSize: 12, color: '#166534' }}>
                  Google conectado
                </div>
                <button onClick={sincronizarDesdeSheet} disabled={sincronizando}
                  style={{ background: sincronizando ? '#e5e7eb' : '#0f1787', color: sincronizando ? '#9ca3af' : '#fff', border: 'none', borderRadius: 10, padding: '10px 16px', fontSize: 12, fontWeight: 500, cursor: sincronizando ? 'not-allowed' : 'pointer', whiteSpace: 'nowrap' }}>
                  {sincronizando ? 'Sincronizando…' : '↻ Sync Sheet'}
                </button>
                <button onClick={desconectarGoogle} style={{ background: '#fff', border: '0.5px solid #e5e7eb', borderRadius: 10, padding: '10px 12px', fontSize: 12, color: '#6b7280', cursor: 'pointer' }}>
                  ×
                </button>
              </div>
            )}

            {/* Filtros estado */}
            <div style={{ display: 'flex', gap: 6 }}>
              {(['todos', 'pendientes', 'pagados'] as const).map(f => (
                <button key={f} onClick={() => setCotFiltro(f)} style={{
                  flex: 1, padding: '8px 4px', borderRadius: 10, fontSize: 12, fontWeight: 600, cursor: 'pointer',
                  border: '0.5px solid #e5e7eb',
                  background: cotFiltro === f ? (f === 'pagados' ? '#dcfce7' : f === 'pendientes' ? '#fef2f2' : '#0f1787') : '#fff',
                  color: cotFiltro === f ? (f === 'pagados' ? '#166534' : f === 'pendientes' ? '#991b1b' : '#fff') : '#6b7280'
                }}>
                  {f === 'todos' ? `Todos (${cotItems.length})` : f === 'pagados' ? `✓ Pagados (${cotItems.filter(i => i.pagado).length})` : `○ Pendientes (${cotItems.filter(i => !i.pagado).length})`}
                </button>
              ))}
            </div>

            {/* Filtro por categoría */}
            <div style={{ display: 'flex', gap: 6, overflowX: 'auto', scrollbarWidth: 'none', paddingBottom: 2 }}>
              <button onClick={() => setCotCatFiltro('todas')} style={{ padding: '5px 12px', borderRadius: 20, fontSize: 11, fontWeight: 500, whiteSpace: 'nowrap', cursor: 'pointer', border: '0.5px solid #e5e7eb', background: cotCatFiltro === 'todas' ? '#374151' : '#fff', color: cotCatFiltro === 'todas' ? '#fff' : '#6b7280' }}>
                Todas
              </button>
              {cotCats.map(cat => (
                <button key={cat} onClick={() => setCotCatFiltro(cat)} style={{ padding: '5px 12px', borderRadius: 20, fontSize: 11, fontWeight: 500, whiteSpace: 'nowrap', cursor: 'pointer', border: '0.5px solid #e5e7eb', background: cotCatFiltro === cat ? '#374151' : '#fff', color: cotCatFiltro === cat ? '#fff' : '#6b7280' }}>
                  {cat}
                </button>
              ))}
            </div>

            {/* Botón agregar */}
            <button onClick={() => { setMostrarFormCot(p => !p); setCotMensaje('') }}
              style={{ background: mostrarFormCot ? '#f3f4f6' : '#fff', color: mostrarFormCot ? '#374151' : '#0f1787', border: `0.5px solid ${mostrarFormCot ? '#e5e7eb' : '#0f1787'}`, borderRadius: 12, padding: '11px', fontSize: 13, fontWeight: 500, cursor: 'pointer' }}>
              {mostrarFormCot ? '✕ Cancelar' : '+ Agregar ítem'}
            </button>

            {/* Formulario nuevo ítem */}
            {mostrarFormCot && (
              <div style={{ background: '#fff', borderRadius: 14, border: '0.5px solid #e5e7eb', padding: 18, display: 'flex', flexDirection: 'column', gap: 12 }}>
                <div style={{ fontSize: 14, fontWeight: 600, color: '#0d0d14' }}>Nuevo ítem</div>
                <div>
                  <div style={{ fontSize: 11, color: '#9ca3af', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 5 }}>Categoría</div>
                  <select value={cotForm.categoria} onChange={e => setCotForm(p => ({ ...p, categoria: e.target.value }))}
                    style={{ width: '100%', border: '0.5px solid #e5e7eb', borderRadius: 10, padding: '9px 12px', fontSize: 13, color: '#0d0d14', background: '#fafafa', outline: 'none' }}>
                    {CATS_EXCEL.map(c => <option key={c} value={c}>{c}</option>)}
                  </select>
                </div>
                <div>
                  <div style={{ fontSize: 11, color: '#9ca3af', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 5 }}>Producto *</div>
                  <input type="text" value={cotForm.producto} onChange={e => setCotForm(p => ({ ...p, producto: e.target.value }))} placeholder="Ej. Empanadas…"
                    style={{ width: '100%', border: '0.5px solid #e5e7eb', borderRadius: 10, padding: '9px 14px', fontSize: 14, color: '#0d0d14', outline: 'none', boxSizing: 'border-box', background: '#fafafa' }} />
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
                  <div>
                    <div style={{ fontSize: 11, color: '#9ca3af', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 5 }}>Cantidad</div>
                    <input type="text" value={cotForm.cantidad} onChange={e => setCotForm(p => ({ ...p, cantidad: e.target.value }))} placeholder="1"
                      style={{ width: '100%', border: '0.5px solid #e5e7eb', borderRadius: 10, padding: '9px 14px', fontSize: 14, color: '#0d0d14', outline: 'none', boxSizing: 'border-box', background: '#fafafa' }} />
                  </div>
                  <div>
                    <div style={{ fontSize: 11, color: '#9ca3af', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 5 }}>Precio unitario</div>
                    <input type="number" value={cotForm.precioUnidad} onChange={e => setCotForm(p => ({ ...p, precioUnidad: e.target.value }))} placeholder="0"
                      style={{ width: '100%', border: '0.5px solid #e5e7eb', borderRadius: 10, padding: '9px 14px', fontSize: 14, color: '#0d0d14', outline: 'none', boxSizing: 'border-box', background: '#fafafa' }} />
                  </div>
                </div>
                <div>
                  <div style={{ fontSize: 11, color: '#9ca3af', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 5 }}>Precio total (opcional)</div>
                  <input type="number" value={cotForm.precioTotal} onChange={e => setCotForm(p => ({ ...p, precioTotal: e.target.value }))} placeholder="Se calcula automático"
                    style={{ width: '100%', border: '0.5px solid #e5e7eb', borderRadius: 10, padding: '9px 14px', fontSize: 14, color: '#0d0d14', outline: 'none', boxSizing: 'border-box', background: '#fafafa' }} />
                </div>
                <div>
                  <div style={{ fontSize: 11, color: '#9ca3af', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 5 }}>Proveedor</div>
                  <input type="text" value={cotForm.proveedor} onChange={e => setCotForm(p => ({ ...p, proveedor: e.target.value }))} placeholder="Ej. Giovanny Avila…"
                    style={{ width: '100%', border: '0.5px solid #e5e7eb', borderRadius: 10, padding: '9px 14px', fontSize: 14, color: '#0d0d14', outline: 'none', boxSizing: 'border-box', background: '#fafafa' }} />
                </div>
                <div>
                  <div style={{ fontSize: 11, color: '#9ca3af', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 5 }}>Notas</div>
                  <input type="text" value={cotForm.notas} onChange={e => setCotForm(p => ({ ...p, notas: e.target.value }))} placeholder="Observaciones opcionales…"
                    style={{ width: '100%', border: '0.5px solid #e5e7eb', borderRadius: 10, padding: '9px 14px', fontSize: 14, color: '#0d0d14', outline: 'none', boxSizing: 'border-box', background: '#fafafa' }} />
                </div>
                {cotMensaje && (
                  <div style={{ background: cotMensaje.includes('agregado') || cotMensaje.includes('completada') ? '#f0fdf4' : '#fef2f2', border: `0.5px solid ${cotMensaje.includes('agregado') || cotMensaje.includes('completada') ? '#bbf7d0' : '#fecaca'}`, borderRadius: 10, padding: '10px 14px', fontSize: 13, color: cotMensaje.includes('agregado') || cotMensaje.includes('completada') ? '#166534' : '#991b1b' }}>
                    {cotMensaje}
                  </div>
                )}
                <button onClick={agregarItem} disabled={cotGuardando || !cotForm.producto.trim()}
                  style={{ background: cotGuardando || !cotForm.producto.trim() ? '#e5e7eb' : '#0f1787', color: cotGuardando || !cotForm.producto.trim() ? '#9ca3af' : '#fff', border: 'none', borderRadius: 10, padding: 12, fontSize: 14, fontWeight: 500, cursor: cotGuardando || !cotForm.producto.trim() ? 'not-allowed' : 'pointer' }}>
                  {cotGuardando ? 'Guardando…' : 'Agregar ítem'}
                </button>
              </div>
            )}

            {cotError && (
              <div style={{ background: '#fef2f2', border: '0.5px solid #fecaca', borderRadius: 12, padding: '12px 16px', fontSize: 13, color: '#991b1b' }}>{cotError}</div>
            )}
            {cotMensaje && !mostrarFormCot && (
              <div style={{ background: '#f0fdf4', border: '0.5px solid #bbf7d0', borderRadius: 12, padding: '12px 16px', fontSize: 13, color: '#166534' }}>{cotMensaje}</div>
            )}

            {/* Lista items agrupados por categoría */}
            {cotLoading ? (
              <div style={{ textAlign: 'center', color: '#9ca3af', fontSize: 14, padding: 40 }}>Cargando cotizaciones…</div>
            ) : Object.keys(groupByCat).length === 0 ? (
              <div style={{ textAlign: 'center', color: '#9ca3af', fontSize: 14, padding: 40 }}>
                {cotItems.length === 0 ? 'Sin cotizaciones. Usa "↻ Sync Sheet" para importar del Excel.' : 'Sin ítems con este filtro.'}
              </div>
            ) : Object.entries(groupByCat).map(([cat, items], catIdx) => {
              const color = COLORES[catIdx % COLORES.length]
              const pagadosCat = items.filter(i => i.pagado).length
              const totalCat = items.reduce((s, i) => s + (i.precio_total || 0), 0)
              return (
                <div key={cat} style={{ background: '#fff', borderRadius: 14, border: '0.5px solid #e5e7eb', overflow: 'hidden' }}>
                  {/* Header categoría */}
                  <div style={{ background: color.bg, borderBottom: `0.5px solid ${color.border}`, padding: '12px 16px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <div>
                      <div style={{ fontSize: 12, fontWeight: 700, color: color.texto, textTransform: 'uppercase', letterSpacing: '0.05em' }}>{cat}</div>
                      <div style={{ fontSize: 11, color: '#9ca3af', marginTop: 2 }}>{pagadosCat}/{items.length} pagados</div>
                    </div>
                    <div style={{ textAlign: 'right' }}>
                      <div style={{ fontSize: 14, fontWeight: 600, color: '#0d0d14' }}>{fmt(totalCat)}</div>
                      <div style={{ fontSize: 10, color: '#9ca3af', marginTop: 1 }}>total categoría</div>
                    </div>
                  </div>

                  {/* Items */}
                  {items.map((item, i) => (
                    <div key={item.id}>
                      {editandoId === item.id ? (
                        /* ── Formulario edición inline ── */
                        <div style={{ padding: '14px 16px', borderTop: i > 0 ? '0.5px solid #f3f4f6' : 'none', background: '#fafbff' }}>
                          <div style={{ fontSize: 12, fontWeight: 600, color: '#0f1787', marginBottom: 10 }}>Editar ítem</div>
                          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                            <div>
                              <div style={{ fontSize: 10, color: '#9ca3af', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 4 }}>Producto</div>
                              <input type="text" value={editForm.producto} onChange={e => setEditForm(p => ({ ...p, producto: e.target.value }))}
                                style={{ width: '100%', border: '0.5px solid #c7d2fe', borderRadius: 8, padding: '8px 12px', fontSize: 13, color: '#0d0d14', outline: 'none', boxSizing: 'border-box', background: '#fff' }} />
                            </div>
                            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
                              <div>
                                <div style={{ fontSize: 10, color: '#9ca3af', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 4 }}>Cantidad</div>
                                <input type="text" value={editForm.cantidad} onChange={e => setEditForm(p => ({ ...p, cantidad: e.target.value }))}
                                  style={{ width: '100%', border: '0.5px solid #c7d2fe', borderRadius: 8, padding: '8px 12px', fontSize: 13, color: '#0d0d14', outline: 'none', boxSizing: 'border-box', background: '#fff' }} />
                              </div>
                              <div>
                                <div style={{ fontSize: 10, color: '#9ca3af', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 4 }}>Precio total</div>
                                <input type="number" value={editForm.precio_total} onChange={e => setEditForm(p => ({ ...p, precio_total: e.target.value }))}
                                  style={{ width: '100%', border: '0.5px solid #c7d2fe', borderRadius: 8, padding: '8px 12px', fontSize: 13, color: '#0d0d14', outline: 'none', boxSizing: 'border-box', background: '#fff' }} />
                              </div>
                            </div>
                            <div>
                              <div style={{ fontSize: 10, color: '#9ca3af', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 4 }}>Proveedor</div>
                              <input type="text" value={editForm.proveedor} onChange={e => setEditForm(p => ({ ...p, proveedor: e.target.value }))}
                                style={{ width: '100%', border: '0.5px solid #c7d2fe', borderRadius: 8, padding: '8px 12px', fontSize: 13, color: '#0d0d14', outline: 'none', boxSizing: 'border-box', background: '#fff' }} />
                            </div>
                            <div>
                              <div style={{ fontSize: 10, color: '#9ca3af', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 4 }}>Notas</div>
                              <input type="text" value={editForm.notas} onChange={e => setEditForm(p => ({ ...p, notas: e.target.value }))} placeholder="Observaciones…"
                                style={{ width: '100%', border: '0.5px solid #c7d2fe', borderRadius: 8, padding: '8px 12px', fontSize: 13, color: '#0d0d14', outline: 'none', boxSizing: 'border-box', background: '#fff' }} />
                            </div>
                            <div style={{ display: 'flex', gap: 8, marginTop: 4 }}>
                              <button onClick={() => guardarEdicion(item)} disabled={editGuardando}
                                style={{ flex: 1, background: editGuardando ? '#e5e7eb' : '#0f1787', color: editGuardando ? '#9ca3af' : '#fff', border: 'none', borderRadius: 8, padding: '9px', fontSize: 13, fontWeight: 500, cursor: editGuardando ? 'not-allowed' : 'pointer' }}>
                                {editGuardando ? 'Guardando…' : 'Guardar'}
                              </button>
                              <button onClick={() => setEditandoId(null)}
                                style={{ flex: 1, background: '#fff', color: '#6b7280', border: '0.5px solid #e5e7eb', borderRadius: 8, padding: '9px', fontSize: 13, fontWeight: 500, cursor: 'pointer' }}>
                                Cancelar
                              </button>
                              <button onClick={() => eliminarItem(item)}
                                style={{ background: '#fef2f2', color: '#dc2626', border: '0.5px solid #fecaca', borderRadius: 8, padding: '9px 12px', fontSize: 13, cursor: 'pointer' }}>
                                Eliminar
                              </button>
                            </div>
                          </div>
                        </div>
                      ) : (
                        /* ── Vista normal del ítem ── */
                        <div style={{ padding: '12px 16px', borderTop: i > 0 ? '0.5px solid #f3f4f6' : 'none', display: 'flex', alignItems: 'flex-start', gap: 10, opacity: item.pagado ? 0.65 : 1 }}>
                          {/* Checkbox pagado */}
                          <button onClick={() => togglePagado(item)}
                            style={{ width: 22, height: 22, borderRadius: 6, border: `2px solid ${item.pagado ? '#16a34a' : '#d1d5db'}`, background: item.pagado ? '#16a34a' : '#fff', cursor: 'pointer', flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', marginTop: 1 }}>
                            {item.pagado && <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="3" strokeLinecap="round"><polyline points="20 6 9 17 4 12" /></svg>}
                          </button>
                          {/* Info */}
                          <div style={{ flex: 1, minWidth: 0 }}>
                            <div style={{ fontSize: 13, fontWeight: 500, color: '#0d0d14', textDecoration: item.pagado ? 'line-through' : 'none' }}>{item.producto}</div>
                            <div style={{ fontSize: 11, color: '#9ca3af', marginTop: 2 }}>
                              {item.cantidad && <span>x{item.cantidad} </span>}
                              {item.proveedor && <span>· {item.proveedor}</span>}
                            </div>
                            {item.notas && <div style={{ fontSize: 11, color: '#6366f1', marginTop: 2, fontStyle: 'italic' }}>{item.notas}</div>}
                          </div>
                          {/* Precio + editar */}
                          <div style={{ textAlign: 'right', flexShrink: 0 }}>
                            {item.precio_total > 0 && (
                              <div style={{ fontSize: 13, fontWeight: 600, color: item.pagado ? '#16a34a' : '#0d0d14' }}>{fmt(item.precio_total)}</div>
                            )}
                            <button onClick={() => { setEditandoId(item.id); setEditForm({ producto: item.producto, cantidad: item.cantidad || '', precio_total: String(item.precio_total || ''), precio_unidad: String(item.precio_unidad || ''), proveedor: item.proveedor || '', notas: item.notas || '' }) }}
                              style={{ background: 'none', border: 'none', color: '#9ca3af', cursor: 'pointer', fontSize: 11, padding: '2px 0', marginTop: 2 }}>
                              editar
                            </button>
                          </div>
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              )
            })}
          </>
        )}

      </div>

      {/* Modal imagen ampliada */}
      {imagenAmpliada && (
        <div onClick={() => setImagenAmpliada(null)} style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.85)', zIndex: 100, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: 20 }}>
          <img src={imagenAmpliada.comprobante_url!} alt={imagenAmpliada.descripcion} style={{ maxWidth: '100%', maxHeight: '75vh', borderRadius: 12, objectFit: 'contain' }} onClick={e => e.stopPropagation()} />
          <div style={{ marginTop: 16, textAlign: 'center' }}>
            <div style={{ fontSize: 15, fontWeight: 500, color: '#fff' }}>{imagenAmpliada.descripcion}</div>
            <div style={{ fontSize: 12, color: 'rgba(255,255,255,0.6)', marginTop: 4 }}>
              {imagenAmpliada.categorias_financieras?.nombre} · {fmt(imagenAmpliada.valor)}
            </div>
            <a href={imagenAmpliada.comprobante_url!} target="_blank" rel="noopener noreferrer" style={{ display: 'inline-block', marginTop: 12, fontSize: 13, color: '#a5b4fc', textDecoration: 'underline' }}>
              Abrir en pantalla completa
            </a>
          </div>
          <div style={{ marginTop: 20, fontSize: 12, color: 'rgba(255,255,255,0.4)' }}>Toca fuera para cerrar</div>
        </div>
      )}

      {/* Botón registrar ingresos/egresos */}
      {(tab === 'ingresos' || tab === 'egresos') && (
        <button onClick={() => router.push(`/dashboard/finanzas/registrar?tipo=${tab === 'ingresos' ? 'ingreso' : 'egreso'}`)}
          style={{ position: 'fixed', bottom: 80, left: 20, right: 20, background: '#0f1787', color: '#fff', border: 'none', borderRadius: 14, padding: 14, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8, fontSize: 14, fontWeight: 500, cursor: 'pointer' }}>
          <Plus size={18} /> Registrar {tab === 'ingresos' ? 'ingreso' : 'egreso'}
        </button>
      )}

      <BottomNav />
    </div>
  )
}
