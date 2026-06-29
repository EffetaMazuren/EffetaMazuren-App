'use client'

import { useEffect, useState, ReactElement } from 'react'
import { createClient } from '@supabase/supabase-js'
import { useRouter, usePathname } from 'next/navigation'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
)

const RETIRO_ID = '21da7588-f7d9-4bf8-a6f6-ae6c8258c00e'
const META_RECAUDO = 50_000_000
const CUPO_MAXIMO = 60

interface DashboardData {
  totalCaminantes: number
  caminantesInscritos: number
  caminantesPagoCompleto: number
  caminantesCorreoEnviado: number
  caminantesConAbono: number
  cuposDisponibles: number
  servidoresPagoCompleto: number
  servidoresConAbono: number
  totalRecaudado: number
  totalPagadoCaminantes: number
  totalCuentaParroquia: number
  totalNequiEffeta: number
  balanceNequiEffeta: number
  nombreRetiro: string
  fechaInicio: string
  fechaFin: string
  diasRestantes: number
  reembolsosPendientes: number
  alertasAsistencia: number
}

function formatCOP(value: number): string {
  if (value >= 1_000_000) {
    const m = value / 1_000_000
    return `$${m % 1 === 0 ? m.toFixed(0) : m.toFixed(1)}M`
  }
  if (value >= 1_000) {
    return `$${(value / 1_000).toFixed(0)}K`
  }
  return `$${value.toLocaleString('es-CO')}`
}

function formatCOPFull(value: number): string {
  return `$${value.toLocaleString('es-CO')}`
}

export default function DashboardPage() {
  const router = useRouter()
  const pathname = usePathname()
  const [data, setData] = useState<DashboardData | null>(null)
  const [loading, setLoading] = useState(true)
  const [userName, setUserName] = useState('Líder')
  const [expandedCard, setExpandedCard] = useState<'caminantes' | 'servidores' | null>(null)
  const [lastUpdated, setLastUpdated] = useState<Date>(new Date())

  async function fetchDashboard() {
    try {
      const { data: retiro } = await supabase
        .from('retiros')
        .select('nombre, fecha_inicio, fecha_fin')
        .eq('id', RETIRO_ID)
        .single()

      const fechaInicio = retiro?.fecha_inicio ? new Date(retiro.fecha_inicio) : new Date('2026-07-03')
      const fechaFin = retiro?.fecha_fin ? new Date(retiro.fecha_fin) : new Date('2026-07-05')
      const hoy = new Date()
      const diasRestantes = Math.max(0, Math.ceil((fechaInicio.getTime() - hoy.getTime()) / (1000 * 60 * 60 * 24)))

      const { data: caminantes } = await supabase
        .from('vista_pagos_caminantes')
        .select('id, inscrito_oficialmente, estado_pago, estado_correo, total_pagado')
        .eq('retiro_id', RETIRO_ID)

      const totalCaminantes = caminantes?.length ?? 0
      const caminantesInscritos = caminantes?.filter(c => c.inscrito_oficialmente).length ?? 0
      const caminantesPagoCompleto = caminantes?.filter(c => c.estado_pago === 'completo').length ?? 0
      const caminantesCorreoEnviado = caminantes?.filter(c => c.estado_correo === 'enviado').length ?? 0
      const caminantesConAbono = caminantes?.filter(c => c.total_pagado > 0).length ?? 0
      const cuposDisponibles = Math.max(0, CUPO_MAXIMO - caminantesConAbono)
      const totalPagadoCaminantes = caminantes?.reduce((acc, c) => acc + (c.total_pagado ?? 0), 0) ?? 0

      const { data: servidores } = await supabase
        .from('vista_pagos_servidores')
        .select('id, estado_pago, total_pagado')
        .eq('retiro_id', RETIRO_ID)

      const servidoresPagoCompleto = servidores?.filter(s => s.estado_pago === 'completo').length ?? 0
      const servidoresConAbono = servidores?.filter(s => s.total_pagado > 0).length ?? 0

      const { data: pagos } = await supabase
        .from('pagos')
        .select('valor, estado')
        .eq('retiro_id', RETIRO_ID)
        .eq('estado', 'confirmado')

      const { data: ingresosNequi } = await supabase
        .from('transacciones')
        .select('valor')
        .eq('retiro_id', RETIRO_ID)
        .eq('tipo', 'ingreso')
        .eq('estado', 'aprobado')

      const { data: egresosNequi } = await supabase
        .from('transacciones')
        .select('valor')
        .eq('retiro_id', RETIRO_ID)
        .eq('tipo', 'egreso')
        .eq('estado', 'aprobado')

      const { data: reembolsos } = await supabase
        .from('transacciones')
        .select('id, estado')
        .eq('retiro_id', RETIRO_ID)
        .eq('estado', 'pendiente')

      const { data: alertas } = await supabase
        .from('asistencias')
        .select('id')
        .eq('fuera_de_horario', true)

      const totalCuentaParroquia = pagos?.reduce((acc, p) => acc + (p.valor ?? 0), 0) ?? 0
      const totalNequiEffeta = ingresosNequi?.reduce((acc, t) => acc + (t.valor ?? 0), 0) ?? 0
      const totalEgresosNequi = egresosNequi?.reduce((acc, t) => acc + (t.valor ?? 0), 0) ?? 0
      const balanceNequiEffeta = totalNequiEffeta - totalEgresosNequi
      const totalRecaudado = totalCuentaParroquia + totalNequiEffeta

      setData({
        totalCaminantes,
        caminantesInscritos,
        caminantesPagoCompleto,
        caminantesCorreoEnviado,
        caminantesConAbono,
        cuposDisponibles,
        servidoresPagoCompleto,
        servidoresConAbono,
        totalRecaudado,
        totalPagadoCaminantes,
        totalCuentaParroquia,
        totalNequiEffeta,
        balanceNequiEffeta,
        nombreRetiro: retiro?.nombre ?? 'Effetá Mazuren · Julio 2026',
        fechaInicio: fechaInicio.toLocaleDateString('es-CO', { day: 'numeric', month: 'long', year: 'numeric' }),
        fechaFin: fechaFin.toLocaleDateString('es-CO', { day: 'numeric', month: 'long', year: 'numeric' }),
        diasRestantes,
        reembolsosPendientes: reembolsos?.length ?? 0,
        alertasAsistencia: alertas?.length ?? 0,
      })
      setLastUpdated(new Date())
    } catch (err) {
      console.error('Error fetching dashboard:', err)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    supabase.auth.getUser().then(({ data: { user } }) => {
      if (user) {
        supabase
          .from('usuarios')
          .select('nombre')
          .eq('id', user.id)
          .single()
          .then(({ data: u }) => {
            if (u?.nombre) setUserName(u.nombre.split(' ')[0])
          })
      }
    })

    fetchDashboard()

    const channel = supabase
      .channel('dashboard-realtime')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'pagos' }, fetchDashboard)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'transacciones' }, fetchDashboard)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'caminantes' }, fetchDashboard)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'servidores_inscripcion' }, fetchDashboard)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'asistencias' }, fetchDashboard)
      .subscribe()

    return () => { supabase.removeChannel(channel) }
  }, [])

  const porcentajeMeta = data ? Math.min(100, (data.totalRecaudado / META_RECAUDO) * 100) : 0
  const porcentajeCupos = data ? Math.min(100, (data.caminantesConAbono / CUPO_MAXIMO) * 100) : 0
  const metaServidores = data ? Math.min(100, ((data.servidoresPagoCompleto * 380_000) / (CUPO_MAXIMO * 380_000)) * 100) : 0

  const getHora = () => {
    const h = new Date().getHours()
    if (h < 12) return 'Buenos días'
    if (h < 18) return 'Buenas tardes'
    return 'Buenas noches'
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-[#f7f8fc] flex items-center justify-center">
        <div className="flex flex-col items-center gap-3">
          <div className="w-8 h-8 border-2 border-[#0f1787] border-t-transparent rounded-full animate-spin" />
          <p className="text-sm text-gray-400 font-medium">Cargando datos…</p>
        </div>
      </div>
    )
  }

  const navTabs = [
    { label: 'Inicio', icon: 'home', href: '/dashboard' },
    { label: 'Personas', icon: 'users', href: '/dashboard/personas' },
    { label: 'Finanzas', icon: 'bar-chart', href: '/dashboard/finanzas' },
    { label: 'Retiro', icon: 'cross', href: '/dashboard/retiro' },
    { label: 'Config', icon: 'settings', href: '/dashboard/config' },
  ]

  return (
    <div className="min-h-screen bg-[#f7f8fc] pb-24">

      {/* Header */}
      <header className="bg-white border-b border-gray-100 px-5 py-4 flex items-center justify-between sticky top-0 z-10">
        <span className="text-xs font-semibold tracking-[0.15em] text-[#0f1787] uppercase">
          Effetá · Mazuren
        </span>
        <div className="flex items-center gap-3">
          <span className="text-[10px] text-gray-400 hidden sm:block">
            Actualizado {lastUpdated.toLocaleTimeString('es-CO', { hour: '2-digit', minute: '2-digit' })}
          </span>
          <button onClick={() => router.push('/notifications')} className="w-8 h-8 flex items-center justify-center text-gray-400 hover:text-gray-600 transition-colors relative">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
              <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9" /><path d="M13.73 21a2 2 0 0 1-3.46 0" />
            </svg>
            {((data?.reembolsosPendientes ?? 0) + (data?.alertasAsistencia ?? 0)) > 0 && (
              <span className="absolute top-0 right-0 bg-red-500 text-white text-[9px] font-bold w-4 h-4 rounded-full flex items-center justify-center">
                {(data?.reembolsosPendientes ?? 0) + (data?.alertasAsistencia ?? 0)}
              </span>
            )}
          </button>
          <button onClick={() => router.push('/perfil')} className="w-8 h-8 flex items-center justify-center text-gray-400 hover:text-gray-600 transition-colors">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
              <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" /><circle cx="12" cy="7" r="4" />
            </svg>
          </button>
        </div>
      </header>

      <main className="px-5 pt-6 max-w-2xl mx-auto">

        {/* Saludo */}
        <div className="mb-6">
          <h1 className="text-2xl font-semibold text-gray-900 tracking-tight">
            {getHora()}, {userName} 👋
          </h1>
          {data && (
            <p className="text-sm text-gray-400 mt-0.5">
              {data.diasRestantes > 0 ? `El retiro comienza en ${data.diasRestantes} días` : 'El retiro ya comenzó'}
            </p>
          )}
        </div>

        {/* Hero — Meta de Recaudo */}
        <div className="bg-[#0f1787] rounded-2xl p-5 mb-3 overflow-hidden relative">
          <div className="absolute -right-8 -top-8 w-32 h-32 bg-white/5 rounded-full" />
          <div className="absolute -right-2 top-12 w-20 h-20 bg-white/5 rounded-full" />
          <div className="relative z-10">
            <p className="text-[10px] font-semibold tracking-[0.18em] text-blue-300 uppercase mb-1">
              Meta de recaudo · {data?.nombreRetiro}
            </p>
            <p className="text-[11px] text-blue-200/60 mb-4">{data?.fechaInicio} — {data?.fechaFin}</p>
            <div className="flex items-end justify-between mb-4">
              <div>
                <p className="text-3xl font-bold text-white tracking-tight">{data ? formatCOP(data.totalRecaudado) : '$0'}</p>
                <p className="text-xs text-blue-200/70 mt-0.5">recaudado en total</p>
              </div>
              <div className="text-right">
                <p className="text-2xl font-bold text-blue-300/80">{formatCOP(META_RECAUDO)}</p>
                <p className="text-xs text-blue-200/50 mt-0.5">meta ideal</p>
              </div>
            </div>
            <div className="mb-3">
              <div className="h-1.5 bg-white/10 rounded-full overflow-hidden">
                <div className="h-full bg-gradient-to-r from-blue-300 to-white rounded-full transition-all duration-700" style={{ width: `${porcentajeMeta}%` }} />
              </div>
            </div>
            <div className="flex items-center gap-0 divide-x divide-white/10">
              <div className="pr-4">
                <p className="text-lg font-bold text-white">{porcentajeMeta.toFixed(1)}%</p>
                <p className="text-[10px] text-blue-200/60">financiado</p>
              </div>
              <div className="px-4">
                <p className="text-lg font-bold text-white">{data ? formatCOP(META_RECAUDO - data.totalRecaudado) : formatCOP(META_RECAUDO)}</p>
                <p className="text-[10px] text-blue-200/60">pendiente</p>
              </div>
              <div className="pl-4">
                <p className="text-lg font-bold text-white">{data ? formatCOP(data.totalRecaudado / Math.max(1, data.caminantesConAbono + data.servidoresConAbono)) : '$0'}</p>
                <p className="text-[10px] text-blue-200/60">promedio / persona</p>
              </div>
            </div>
          </div>
        </div>

        {/* Dos tarjetas azules: Parroquia y Nequi */}
        <div className="grid grid-cols-2 gap-3 mb-4">
          <div className="bg-[#0f1787] rounded-2xl p-4 overflow-hidden relative">
            <div className="absolute -right-4 -bottom-4 w-16 h-16 bg-white/5 rounded-full" />
            <div className="relative z-10">
              <p className="text-[9px] font-semibold tracking-[0.15em] text-blue-300 uppercase mb-3">Cuenta parroquia</p>
              <p className="text-2xl font-bold text-white tracking-tight leading-none">{data ? formatCOP(data.totalCuentaParroquia) : '$0'}</p>
              <p className="text-[10px] text-blue-200/60 mt-1 leading-tight">inscripciones caminantes y servidores</p>
              <p className="text-[10px] text-blue-300/80 mt-2 font-medium">{formatCOPFull(data?.totalCuentaParroquia ?? 0)}</p>
            </div>
          </div>
          <div className="bg-[#1a2a9b] rounded-2xl p-4 overflow-hidden relative">
            <div className="absolute -right-4 -bottom-4 w-16 h-16 bg-white/5 rounded-full" />
            <div className="relative z-10">
              <p className="text-[9px] font-semibold tracking-[0.15em] text-blue-300 uppercase mb-3">Nequi Effetá · Balance</p>
              <p className="text-2xl font-bold text-white tracking-tight leading-none">{data ? formatCOP(data.balanceNequiEffeta) : '$0'}</p>
              <p className="text-[10px] text-blue-200/60 mt-1 leading-tight">ingresos menos egresos aprobados</p>
              <p className="text-[10px] text-blue-300/80 mt-2 font-medium">{formatCOPFull(data?.balanceNequiEffeta ?? 0)}</p>
            </div>
          </div>
        </div>

        {/* Tarjeta Caminantes */}
        <div className="bg-white rounded-2xl mb-3 overflow-hidden shadow-sm border border-gray-100">
          <button onClick={() => setExpandedCard(expandedCard === 'caminantes' ? null : 'caminantes')} className="w-full text-left p-5">
            <div className="flex items-start justify-between">
              <div>
                <div className="flex items-center gap-2 mb-1">
                  <div className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
                  <p className="text-[11px] font-semibold text-gray-400 uppercase tracking-wider">Caminantes</p>
                </div>
                <p className="text-4xl font-bold text-gray-900 tracking-tight leading-none">{data?.caminantesConAbono ?? 0}</p>
                <p className="text-sm text-gray-400 mt-1">con abono registrado</p>
              </div>
              <div className="flex flex-col items-end gap-2">
                <div className={`flex items-center justify-center w-7 h-7 rounded-full transition-all duration-200 ${expandedCard === 'caminantes' ? 'bg-gray-100 rotate-180' : 'bg-gray-50'}`}>
                  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="#6b7280" strokeWidth="2.5" strokeLinecap="round"><polyline points="6 9 12 15 18 9" /></svg>
                </div>
                <span className={`text-xs font-medium px-2.5 py-1 rounded-full ${(data?.cuposDisponibles ?? 0) > 0 ? 'bg-emerald-50 text-emerald-700' : 'bg-red-50 text-red-600'}`}>
                  {data?.cuposDisponibles ?? 0} cupos libres
                </span>
              </div>
            </div>
            <div className="mt-4">
              <div className="h-1 bg-gray-100 rounded-full overflow-hidden">
                <div className="h-full bg-emerald-400 rounded-full transition-all duration-700" style={{ width: `${porcentajeCupos}%` }} />
              </div>
              <div className="flex justify-between mt-1">
                <span className="text-[10px] text-gray-400">{data?.caminantesConAbono ?? 0} / {CUPO_MAXIMO} con abono</span>
                <span className="text-[10px] text-gray-400">{porcentajeCupos.toFixed(0)}%</span>
              </div>
            </div>
          </button>
          {expandedCard === 'caminantes' && (
            <div className="border-t border-gray-50 px-5 pb-5 pt-4">
              <div className="grid grid-cols-2 gap-3">
                <StatMini label="Inscritos totales" value={data?.totalCaminantes ?? 0} sub="en la plataforma" color="text-gray-900" onClick={() => router.push('/dashboard/caminantes')} />
                <StatMini label="Pago completo" value={data?.caminantesPagoCompleto ?? 0} sub={`de ${CUPO_MAXIMO} cupos`} color="text-emerald-700" badge={{ text: `${((data?.caminantesPagoCompleto ?? 0) / CUPO_MAXIMO * 100).toFixed(0)}%`, color: 'bg-emerald-50 text-emerald-700' }} />
                <StatMini label="Correos enviados" value={data?.caminantesCorreoEnviado ?? 0} sub={`de ${data?.totalCaminantes ?? 0} inscritos`} color="text-blue-700" />
                <StatMini label="Con abono" value={data?.caminantesConAbono ?? 0} sub="bloquean cupo" color="text-amber-700" />
                <div className="col-span-2 bg-emerald-50/60 rounded-xl p-3 flex items-center justify-between">
                  <div>
                    <p className="text-xs font-semibold text-emerald-800">Total recaudado caminantes</p>
                    <p className="text-[11px] text-emerald-500 mt-0.5">{formatCOPFull(data?.totalPagadoCaminantes ?? 0)} pagados</p>
                  </div>
                  <div className="text-right">
                    <p className="text-xl font-bold text-emerald-700">{formatCOP(data?.totalPagadoCaminantes ?? 0)}</p>
                    <p className="text-[10px] text-emerald-400">recaudado</p>
                  </div>
                </div>
                <div className="col-span-2 bg-gray-50 rounded-xl p-3 flex items-center justify-between cursor-pointer hover:bg-gray-100 transition-colors" onClick={() => router.push('/dashboard/caminantes')}>
                  <div>
                    <p className="text-xs font-semibold text-gray-700">Cupos disponibles</p>
                    <p className="text-[11px] text-gray-400 mt-0.5">Se bloquea al llegar a {CUPO_MAXIMO} con abono</p>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-2xl font-bold text-gray-900">{data?.cuposDisponibles ?? 0}</span>
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#9ca3af" strokeWidth="2" strokeLinecap="round"><polyline points="9 18 15 12 9 6" /></svg>
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Tarjeta Servidores */}
        <div className="bg-white rounded-2xl mb-3 overflow-hidden shadow-sm border border-gray-100">
          <button onClick={() => setExpandedCard(expandedCard === 'servidores' ? null : 'servidores')} className="w-full text-left p-5">
            <div className="flex items-start justify-between">
              <div>
                <div className="flex items-center gap-2 mb-1">
                  <div className="w-1.5 h-1.5 rounded-full bg-violet-500" />
                  <p className="text-[11px] font-semibold text-gray-400 uppercase tracking-wider">Servidores</p>
                </div>
                <p className="text-4xl font-bold text-gray-900 tracking-tight leading-none">{data?.servidoresConAbono ?? 0}</p>
                <p className="text-sm text-gray-400 mt-1">con abono registrado</p>
              </div>
              <div className="flex flex-col items-end gap-2">
                <div className={`flex items-center justify-center w-7 h-7 rounded-full transition-all duration-200 ${expandedCard === 'servidores' ? 'bg-gray-100 rotate-180' : 'bg-gray-50'}`}>
                  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="#6b7280" strokeWidth="2.5" strokeLinecap="round"><polyline points="6 9 12 15 18 9" /></svg>
                </div>
                <span className="text-xs font-medium px-2.5 py-1 rounded-full bg-violet-50 text-violet-700">
                  {data?.servidoresPagoCompleto ?? 0} pago completo
                </span>
              </div>
            </div>
            <div className="mt-4">
              <div className="h-1 bg-gray-100 rounded-full overflow-hidden">
                <div className="h-full bg-violet-400 rounded-full transition-all duration-700" style={{ width: `${metaServidores}%` }} />
              </div>
              <div className="flex justify-between mt-1">
                <span className="text-[10px] text-gray-400">Meta: {data?.servidoresPagoCompleto ?? 0} / {CUPO_MAXIMO} pagos completos</span>
                <span className="text-[10px] text-gray-400">{metaServidores.toFixed(0)}%</span>
              </div>
            </div>
          </button>
          {expandedCard === 'servidores' && (
            <div className="border-t border-gray-50 px-5 pb-5 pt-4">
              <div className="grid grid-cols-2 gap-3">
                <StatMini label="Pago completo" value={data?.servidoresPagoCompleto ?? 0} sub={`de ${CUPO_MAXIMO} × $380K`} color="text-violet-700" badge={{ text: `${metaServidores.toFixed(0)}%`, color: 'bg-violet-50 text-violet-700' }} onClick={() => router.push('/dashboard/servidores')} />
                <StatMini label="Con abono" value={data?.servidoresConAbono ?? 0} sub="han pagado algo" color="text-amber-700" onClick={() => router.push('/dashboard/servidores')} />
                <div className="col-span-2 bg-violet-50/60 rounded-xl p-3 flex items-center justify-between">
                  <div>
                    <p className="text-xs font-semibold text-violet-800">Meta de recolección servidores</p>
                    <p className="text-[11px] text-violet-500 mt-0.5">
                      {formatCOPFull((data?.servidoresPagoCompleto ?? 0) * 380_000)} de {formatCOPFull(CUPO_MAXIMO * 380_000)}
                    </p>
                  </div>
                  <div className="text-right">
                    <p className="text-xl font-bold text-violet-700">{metaServidores.toFixed(0)}%</p>
                    <p className="text-[10px] text-violet-400">completado</p>
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Accesos rápidos */}
        <div className="grid grid-cols-2 gap-3 mb-4 mt-1">

          <button onClick={() => router.push('/dashboard/reembolsos')} className="bg-white rounded-2xl p-4 shadow-sm border border-gray-100 text-left hover:shadow-md transition-shadow relative">
            <div className="flex items-center gap-2 mb-2">
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#0f1787" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/><polyline points="10 9 9 9 8 9"/>
              </svg>
              <span className="text-[11px] font-semibold text-gray-400 uppercase tracking-wider">Facturas</span>
            </div>
            <p className="text-sm text-gray-600 leading-tight">Facturas de servidores pendientes</p>
            {(data?.reembolsosPendientes ?? 0) > 0 && (
              <span className="absolute top-3 right-3 bg-red-500 text-white text-[10px] font-bold w-5 h-5 rounded-full flex items-center justify-center">
                {data?.reembolsosPendientes}
              </span>
            )}
          </button>

          <button onClick={() => router.push('/dashboard/reuniones')} className="bg-white rounded-2xl p-4 shadow-sm border border-gray-100 text-left hover:shadow-md transition-shadow">
            <div className="flex items-center gap-2 mb-2">
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#0f1787" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <rect x="3" y="4" width="18" height="18" rx="2" ry="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/>
              </svg>
              <span className="text-[11px] font-semibold text-gray-400 uppercase tracking-wider">Reuniones</span>
            </div>
            <p className="text-sm text-gray-600 leading-tight">Martes y días especiales</p>
          </button>

          <button onClick={() => router.push('/dashboard/tareas')} className="bg-white rounded-2xl p-4 shadow-sm border border-gray-100 text-left hover:shadow-md transition-shadow">
            <div className="flex items-center gap-2 mb-2">
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#0f1787" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M9 11l3 3L22 4"/><path d="M21 12v7a2 2 0 01-2 2H5a2 2 0 01-2-2V5a2 2 0 012-2h11"/>
              </svg>
              <span className="text-[11px] font-semibold text-gray-400 uppercase tracking-wider">To Do</span>
            </div>
            <p className="text-sm text-gray-600 leading-tight">Tareas pendientes del retiro</p>
          </button>

          <button onClick={() => router.push('/dashboard/asistencias')} className="bg-white rounded-2xl p-4 shadow-sm border border-gray-100 text-left hover:shadow-md transition-shadow relative">
            <div className="flex items-center gap-2 mb-2">
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#0f1787" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z"/><circle cx="12" cy="13" r="4"/>
              </svg>
              <span className="text-[11px] font-semibold text-gray-400 uppercase tracking-wider">Asistencias</span>
            </div>
            <p className="text-sm text-gray-600 leading-tight">Fotos y alertas fuera de horario</p>
            {(data?.alertasAsistencia ?? 0) > 0 && (
              <span className="absolute top-3 right-3 bg-amber-500 text-white text-[10px] font-bold w-5 h-5 rounded-full flex items-center justify-center">
                {data?.alertasAsistencia}
              </span>
            )}
          </button>

          <button onClick={() => router.push('/dashboard/palancas')} className="col-span-2 bg-white rounded-2xl p-4 shadow-sm border border-gray-100 text-left hover:shadow-md transition-shadow">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2 mb-2">
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#0f1787" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/>
                  <circle cx="9" cy="7" r="4"/>
                  <path d="M23 21v-2a4 4 0 0 0-3-3.87"/>
                  <path d="M16 3.13a4 4 0 0 1 0 7.75"/>
                </svg>
                <span className="text-[11px] font-semibold text-gray-400 uppercase tracking-wider">Grupo Palancas</span>
              </div>
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#d1d5db" strokeWidth="2" strokeLinecap="round"><polyline points="9 18 15 12 9 6"/></svg>
            </div>
            <p className="text-sm text-gray-600 leading-tight">Seguimiento de contacto con familias · {data ? 44 : '—'} caminantes asignados</p>
          </button>

          <button onClick={() => router.push('/dashboard/mensajes')} className="col-span-2 bg-white rounded-2xl p-4 shadow-sm border border-gray-100 text-left hover:shadow-md transition-shadow">
            <div className="flex items-center gap-2 mb-2">
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#0f1787" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/>
              </svg>
              <span className="text-[11px] font-semibold text-gray-400 uppercase tracking-wider">Mensajes</span>
            </div>
            <p className="text-sm text-gray-600 leading-tight">Enviar comunicados a servidores en tiempo real</p>
          </button>

        </div>

        {/* Indicador en tiempo real */}
        <div className="flex items-center justify-center gap-1.5 mt-4 mb-2">
          <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
          <span className="text-[11px] text-gray-400">Sincronizado en tiempo real</span>
        </div>

      </main>

      {/* Bottom Nav */}
      <nav className="fixed bottom-0 left-0 right-0 bg-white border-t border-gray-100 z-20">
        <div className="flex items-center max-w-2xl mx-auto px-2">
          {navTabs.map(item => {
            const active = pathname === item.href
            return (
              <button key={item.href} onClick={() => router.push(item.href)} className="flex-1 flex flex-col items-center gap-1 py-3 transition-colors">
                <NavIcon name={item.icon} active={active} />
                <span className={`text-[10px] font-medium ${active ? 'text-[#0f1787]' : 'text-gray-400'}`}>{item.label}</span>
              </button>
            )
          })}
        </div>
      </nav>

    </div>
  )
}

function StatMini({ label, value, sub, color, badge, onClick }: {
  label: string; value: number; sub: string; color: string
  badge?: { text: string; color: string }; onClick?: () => void
}) {
  return (
    <div className={`bg-gray-50 rounded-xl p-3 ${onClick ? 'cursor-pointer hover:bg-gray-100 transition-colors' : ''}`} onClick={onClick}>
      <p className="text-[10px] font-semibold text-gray-400 uppercase tracking-wide mb-1">{label}</p>
      <p className={`text-2xl font-bold ${color} leading-none`}>{value}</p>
      <p className="text-[10px] text-gray-400 mt-1">{sub}</p>
      {badge && (
        <span className={`inline-block text-[10px] font-semibold px-1.5 py-0.5 rounded-full mt-1.5 ${badge.color}`}>
          {badge.text}
        </span>
      )}
    </div>
  )
}

function NavIcon({ name, active }: { name: string; active: boolean }) {
  const color = active ? '#0f1787' : '#9ca3af'
  const w = 20
  const icons: Record<string, ReactElement> = {
    home: (
      <svg width={w} height={w} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth={active ? 2.2 : 1.8} strokeLinecap="round" strokeLinejoin="round">
        <path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z" />
        <polyline points="9 22 9 12 15 12 15 22" />
      </svg>
    ),
    users: (
      <svg width={w} height={w} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth={active ? 2.2 : 1.8} strokeLinecap="round" strokeLinejoin="round">
        <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" /><circle cx="9" cy="7" r="4" />
        <path d="M23 21v-2a4 4 0 0 0-3-3.87" /><path d="M16 3.13a4 4 0 0 1 0 7.75" />
      </svg>
    ),
    'bar-chart': (
      <svg width={w} height={w} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth={active ? 2.2 : 1.8} strokeLinecap="round" strokeLinejoin="round">
        <line x1="12" y1="20" x2="12" y2="10" /><line x1="18" y1="20" x2="18" y2="4" /><line x1="6" y1="20" x2="6" y2="16" />
      </svg>
    ),
    cross: (
      <svg width={w} height={w} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth={active ? 2.2 : 1.8} strokeLinecap="round" strokeLinejoin="round">
        <path d="M12 2v20M2 12h20" />
      </svg>
    ),
    settings: (
      <svg width={w} height={w} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth={active ? 2.2 : 1.8} strokeLinecap="round" strokeLinejoin="round">
        <circle cx="12" cy="12" r="3" />
        <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z" />
      </svg>
    ),
  }
  return icons[name] ?? null
}
