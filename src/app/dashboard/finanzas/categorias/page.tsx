'use client'

import { useEffect, useState } from 'react'
import { createBrowserClient } from '@supabase/ssr'
import Link from 'next/link'

// ── Tipos ────────────────────────────────────────────────────────────────────
interface Categoria {
  id: string
  nombre: string
  tipo_cuenta: 'Parroquia' | 'Nequi Effetá'
  tipo_movimiento: 'ingreso' | 'egreso' | 'ambos'
  activa: boolean
}

type TipoCuenta = 'Parroquia' | 'Nequi Effetá'
type TipoMovimiento = 'ingreso' | 'egreso' | 'ambos'

const TIPO_LABELS: Record<TipoMovimiento, { label: string; color: string }> = {
  ingreso: { label: 'Ingreso', color: 'bg-emerald-50 text-emerald-700' },
  egreso: { label: 'Egreso', color: 'bg-red-50 text-red-600' },
  ambos: { label: 'Ambos', color: 'bg-gray-100 text-gray-600' },
}

// ── Componente principal ─────────────────────────────────────────────────────
export default function CategoriasPage() {
  const supabase = createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  )
  const [categorias, setCategorias] = useState<Categoria[]>([])
  const [loading, setLoading] = useState(true)
  const [guardando, setGuardando] = useState<string | null>(null)
  const [eliminando, setEliminando] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [mostrarForm, setMostrarForm] = useState(false)

  // Form nueva categoría
  const [nombre, setNombre] = useState('')
  const [tipoCuenta, setTipoCuenta] = useState<TipoCuenta>('Nequi Effetá')
  const [tipoMovimiento, setTipoMovimiento] = useState<TipoMovimiento>('egreso')
  const [creando, setCreando] = useState(false)

  // ── Cargar ──────────────────────────────────────────────────────────────
  const cargar = async () => {
    setLoading(true)
    const { data, error } = await supabase
      .from('categorias_financieras')
      .select('*')
      .order('tipo_cuenta', { ascending: true })
      .order('activa', { ascending: false })
      .order('nombre', { ascending: true })

    if (!error && data) setCategorias(data as Categoria[])
    setLoading(false)
  }

  useEffect(() => { cargar() }, [])

  // ── Toggle activa/inactiva ───────────────────────────────────────────────
  const toggleActiva = async (cat: Categoria) => {
    setGuardando(cat.id)
    setError(null)

    const { error } = await supabase
      .from('categorias_financieras')
      .update({ activa: !cat.activa })
      .eq('id', cat.id)

    if (error) {
      setError('No se pudo actualizar la categoría.')
    } else {
      setCategorias(prev =>
        prev.map(c => c.id === cat.id ? { ...c, activa: !cat.activa } : c)
      )
    }
    setGuardando(null)
  }

  // ── Eliminar ─────────────────────────────────────────────────────────────
  const eliminar = async (cat: Categoria) => {
    if (!confirm(`¿Eliminar "${cat.nombre}"? Solo se puede si no tiene movimientos.`)) return
    setEliminando(cat.id)
    setError(null)

    // Verificar si tiene transacciones
    const { count } = await supabase
      .from('transacciones')
      .select('id', { count: 'exact', head: true })
      .eq('categoria_id', cat.id)

    if ((count ?? 0) > 0) {
      setError(`"${cat.nombre}" tiene ${count} movimiento(s). Desactívala en lugar de eliminarla.`)
      setEliminando(null)
      return
    }

    const { error } = await supabase
      .from('categorias_financieras')
      .delete()
      .eq('id', cat.id)

    if (error) {
      setError('No se pudo eliminar la categoría.')
    } else {
      setCategorias(prev => prev.filter(c => c.id !== cat.id))
    }
    setEliminando(null)
  }

  // ── Crear nueva ──────────────────────────────────────────────────────────
  const crear = async () => {
    if (!nombre.trim()) {
      setError('El nombre es obligatorio.')
      return
    }
    setCreando(true)
    setError(null)

    const { data, error } = await supabase
      .from('categorias_financieras')
      .insert({ nombre: nombre.trim(), tipo_cuenta: tipoCuenta, tipo_movimiento: tipoMovimiento, activa: true })
      .select()
      .single()

    if (error) {
      setError('No se pudo crear la categoría.')
    } else {
      setCategorias(prev => [...prev, data as Categoria].sort((a, b) => {
        if (a.tipo_cuenta !== b.tipo_cuenta) return a.tipo_cuenta.localeCompare(b.tipo_cuenta)
        return a.nombre.localeCompare(b.nombre)
      }))
      setNombre('')
      setMostrarForm(false)
    }
    setCreando(false)
  }

  // ── Agrupar por cuenta ───────────────────────────────────────────────────
  const grupos = categorias.reduce<Record<string, Categoria[]>>((acc, cat) => {
    if (!acc[cat.tipo_cuenta]) acc[cat.tipo_cuenta] = []
    acc[cat.tipo_cuenta].push(cat)
    return acc
  }, {})

  const activas = categorias.filter(c => c.activa).length
  const inactivas = categorias.filter(c => !c.activa).length

  // ── Render ───────────────────────────────────────────────────────────────
  return (
    <div className="min-h-screen bg-[#f7f8fc] pb-24">
      <div className="max-w-lg mx-auto px-4 pt-8 space-y-5">

        {/* Header */}
        <div className="flex items-center gap-3 mb-1">
          <Link href="/dashboard/finanzas" className="text-gray-400 hover:text-gray-600 transition-colors">
            ←
          </Link>
          <div>
            <h1 className="text-[22px] font-medium text-gray-900 leading-tight">Categorías</h1>
            <p className="text-sm text-gray-400 mt-0.5">
              {activas} activas · {inactivas} inactivas
            </p>
          </div>
        </div>

        {/* Error */}
        {error && (
          <div className="bg-red-50 border border-red-100 rounded-xl px-4 py-3">
            <p className="text-sm text-red-600">{error}</p>
            <button
              onClick={() => setError(null)}
              className="text-xs text-red-400 mt-1 hover:text-red-600"
            >
              Cerrar
            </button>
          </div>
        )}

        {/* Botón crear */}
        <button
          onClick={() => { setMostrarForm(p => !p); setError(null) }}
          className="w-full flex items-center justify-center gap-2 bg-[#0f1787] text-white text-sm font-medium py-3 rounded-xl hover:bg-[#0d1469] transition-colors"
        >
          {mostrarForm ? '✕ Cancelar' : '+ Nueva categoría'}
        </button>

        {/* Formulario crear */}
        {mostrarForm && (
          <div className="bg-white rounded-2xl border border-gray-100 px-5 py-5 space-y-4">
            <p className="text-sm font-medium text-gray-700">Nueva categoría</p>

            <div className="space-y-1">
              <label className="text-xs text-gray-400 uppercase tracking-wide">Nombre</label>
              <input
                type="text"
                value={nombre}
                onChange={e => setNombre(e.target.value)}
                placeholder="Ej. Impresiones, Decoración…"
                className="w-full border border-gray-200 rounded-xl px-4 py-2.5 text-sm text-gray-800 placeholder-gray-300 focus:outline-none focus:border-[#0f1787] transition-colors"
                onKeyDown={e => e.key === 'Enter' && crear()}
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <label className="text-xs text-gray-400 uppercase tracking-wide">Cuenta</label>
                <select
                  value={tipoCuenta}
                  onChange={e => setTipoCuenta(e.target.value as TipoCuenta)}
                  className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm text-gray-800 focus:outline-none focus:border-[#0f1787] bg-white transition-colors"
                >
                  <option value="Nequi Effetá">Nequi Effetá</option>
                  <option value="Parroquia">Parroquia</option>
                </select>
              </div>
              <div className="space-y-1">
                <label className="text-xs text-gray-400 uppercase tracking-wide">Tipo</label>
                <select
                  value={tipoMovimiento}
                  onChange={e => setTipoMovimiento(e.target.value as TipoMovimiento)}
                  className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm text-gray-800 focus:outline-none focus:border-[#0f1787] bg-white transition-colors"
                >
                  <option value="ingreso">Ingreso</option>
                  <option value="egreso">Egreso</option>
                  <option value="ambos">Ambos</option>
                </select>
              </div>
            </div>

            <button
              onClick={crear}
              disabled={creando || !nombre.trim()}
              className="w-full bg-[#0f1787] text-white text-sm font-medium py-3 rounded-xl hover:bg-[#0d1469] transition-colors disabled:opacity-40"
            >
              {creando ? 'Guardando…' : 'Crear categoría'}
            </button>
          </div>
        )}

        {/* Lista agrupada */}
        {loading ? (
          <div className="space-y-3">
            {[1, 2, 3, 4].map(i => (
              <div key={i} className="h-14 bg-white rounded-xl animate-pulse border border-gray-100" />
            ))}
          </div>
        ) : (
          Object.entries(grupos).map(([cuenta, cats]) => (
            <div key={cuenta} className="space-y-2">
              {/* Encabezado grupo */}
              <p className="text-[11px] uppercase tracking-widest text-gray-400 px-1">{cuenta}</p>

              {/* Cards categorías */}
              <div className="bg-white rounded-2xl border border-gray-100 overflow-hidden divide-y divide-gray-50">
                {cats.map(cat => (
                  <div
                    key={cat.id}
                    className={`px-5 py-3.5 flex items-center gap-3 transition-colors ${
                      !cat.activa ? 'opacity-40' : ''
                    }`}
                  >
                    {/* Toggle switch */}
                    <button
                      onClick={() => toggleActiva(cat)}
                      disabled={guardando === cat.id}
                      aria-label={cat.activa ? 'Desactivar' : 'Activar'}
                      className={`relative w-10 h-5 rounded-full transition-colors flex-shrink-0 ${
                        cat.activa ? 'bg-[#0f1787]' : 'bg-gray-200'
                      } ${guardando === cat.id ? 'opacity-50' : ''}`}
                    >
                      <span
                        className={`absolute top-0.5 left-0.5 w-4 h-4 bg-white rounded-full shadow-sm transition-transform ${
                          cat.activa ? 'translate-x-5' : 'translate-x-0'
                        }`}
                      />
                    </button>

                    {/* Nombre */}
                    <span className="flex-1 text-sm text-gray-800 font-medium truncate">
                      {cat.nombre}
                    </span>

                    {/* Badge tipo */}
                    <span className={`text-[11px] px-2 py-0.5 rounded-md font-medium flex-shrink-0 ${
                      TIPO_LABELS[cat.tipo_movimiento].color
                    }`}>
                      {TIPO_LABELS[cat.tipo_movimiento].label}
                    </span>

                    {/* Eliminar */}
                    <button
                      onClick={() => eliminar(cat)}
                      disabled={eliminando === cat.id}
                      aria-label="Eliminar categoría"
                      className="flex-shrink-0 text-gray-200 hover:text-red-400 transition-colors disabled:opacity-30 text-lg leading-none"
                    >
                      {eliminando === cat.id ? '…' : '×'}
                    </button>
                  </div>
                ))}
              </div>
            </div>
          ))
        )}

        {/* Info */}
        <div className="bg-amber-50 border border-amber-100 rounded-xl px-4 py-3">
          <p className="text-xs text-amber-700 leading-relaxed">
            <span className="font-medium">Categorías inactivas</span> no aparecen al registrar movimientos pero conservan su historial.
            Solo puedes <span className="font-medium">eliminar</span> categorías que no tengan movimientos registrados.
          </p>
        </div>

      </div>
    </div>
  )
}
