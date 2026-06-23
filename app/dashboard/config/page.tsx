'use client'
import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'
import BottomNav from '@/components/BottomNav'
import {
  User, Bell, Shield, Download, RefreshCw, UserPlus,
  ChevronRight, LogOut, Info, Database, Moon, Globe,
  AlertTriangle, Check, Users, Lock
} from 'lucide-react'

type Toast = { msg: string; tipo: 'ok' | 'error' } | null

interface ServidorInscripcion {
  id: string
  nombre: string
  grupo: string | null
}

function Seccion({ titulo, children }: { titulo: string; children: React.ReactNode }) {
  return (
    <div style={{ marginBottom: 8 }}>
      <div style={{ fontSize: 11, fontWeight: 600, color: '#9ca3af', letterSpacing: '0.08em', textTransform: 'uppercase', padding: '0 20px', marginBottom: 6 }}>
        {titulo}
      </div>
      <div style={{ background: '#fff', border: '0.5px solid #e5e7eb', borderRadius: 16, overflow: 'hidden', margin: '0 20px' }}>
        {children}
      </div>
    </div>
  )
}

function Fila({
  icon: Icon, label, sublabel, color = '#6b7280', onClick, peligro, toggle, toggleValue, chevron = true, ultimo = false
}: {
  icon: React.ElementType; label: string; sublabel?: string; color?: string
  onClick?: () => void; peligro?: boolean; toggle?: boolean; toggleValue?: boolean
  chevron?: boolean; ultimo?: boolean
}) {
  return (
    <button
      onClick={onClick}
      style={{
        width: '100%', display: 'flex', alignItems: 'center', gap: 14,
        padding: '14px 16px', background: 'transparent', border: 'none',
        borderBottom: ultimo ? 'none' : '0.5px solid #f3f4f6',
        cursor: onClick ? 'pointer' : 'default', textAlign: 'left',
      }}
    >
      <div style={{ width: 34, height: 34, borderRadius: 10, background: peligro ? '#fee2e2' : '#f0f1ff', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
        <Icon size={17} color={peligro ? '#dc2626' : color} />
      </div>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontSize: 14, fontWeight: 500, color: peligro ? '#dc2626' : '#0d0d14' }}>{label}</div>
        {sublabel && <div style={{ fontSize: 12, color: '#9ca3af', marginTop: 2 }}>{sublabel}</div>}
      </div>
      {toggle !== undefined ? (
        <div style={{ width: 44, height: 26, borderRadius: 13, background: toggleValue ? '#0f1787' : '#e5e7eb', position: 'relative', transition: 'background 0.2s', flexShrink: 0 }}>
          <div style={{ position: 'absolute', top: 3, left: toggleValue ? 21 : 3, width: 20, height: 20, borderRadius: '50%', background: '#fff', transition: 'left 0.2s', boxShadow: '0 1px 3px rgba(0,0,0,0.2)' }} />
        </div>
      ) : chevron ? (
        <ChevronRight size={16} color="#d1d5db" />
      ) : null}
    </button>
  )
}

function Modal({ titulo, mensaje, confirmLabel, onConfirm, onCancel, peligro }: {
  titulo: string; mensaje: string; confirmLabel: string
  onConfirm: () => void; onCancel: () => void; peligro?: boolean
}) {
  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', zIndex: 200, display: 'flex', alignItems: 'flex-end', padding: '0 0 20px' }}>
      <div style={{ background: '#fff', borderRadius: 20, margin: '0 16px', width: 'calc(100% - 32px)', padding: 24 }}>
        <div style={{ fontSize: 16, fontWeight: 600, color: '#0d0d14', marginBottom: 8 }}>{titulo}</div>
        <div style={{ fontSize: 14, color: '#6b7280', lineHeight: 1.6, marginBottom: 24 }}>{mensaje}</div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          <button onClick={onConfirm} style={{ width: '100%', padding: 14, borderRadius: 12, border: 'none', background: peligro ? '#dc2626' : '#0f1787', color: '#fff', fontSize: 15, fontWeight: 600, cursor: 'pointer' }}>
            {confirmLabel}
          </button>
          <button onClick={onCancel} style={{ width: '100%', padding: 14, borderRadius: 12, border: '0.5px solid #e5e7eb', background: '#fff', color: '#6b7280', fontSize: 15, cursor: 'pointer' }}>
            Cancelar
          </button>
        </div>
      </div>
    </div>
  )
}

const RETIRO_ID = '21da7588-f7d9-4bf8-a6f6-ae6c8258c00e'

export default function ConfigPage() {
  const router = useRouter()
  const [notifPagos, setNotifPagos] = useState(true)
  const [notifInscritos, setNotifInscritos] = useState(true)
  const [modal, setModal] = useState<'cerrar_sesion' | 'sync' | null>(null)
  const [toast, setToast] = useState<Toast>(null)
  const [sincronizando, setSincronizando] = useState(false)

  // Palancas accesos
  const [mostrarPalancas, setMostrarPalancas] = useState(false)
  const [servidores, setServidores] = useState<ServidorInscripcion[]>([])
  const [cargandoSrvs, setCargandoSrvs] = useState(false)
  const [guardandoId, setGuardandoId] = useState<string | null>(null)

  function mostrarToast(msg: string, tipo: 'ok' | 'error') {
    setToast({ msg, tipo })
    setTimeout(() => setToast(null), 3000)
  }

  async function cerrarSesion() {
    await supabase.auth.signOut()
    router.push('/login')
  }

  async function sincronizarDatos() {
    setSincronizando(true)
    setModal(null)
    try {
      const { error } = await supabase.from('retiros').select('id').eq('estado', 'activo').single()
      if (error) throw error
      mostrarToast('Datos sincronizados correctamente', 'ok')
    } catch {
      mostrarToast('Error al sincronizar', 'error')
    } finally {
      setSincronizando(false)
    }
  }

  async function cargarServidoresPalancas() {
    setCargandoSrvs(true)
    const { data } = await supabase
      .from('servidores_inscripcion')
      .select('id, nombre, grupo')
      .eq('retiro_id', RETIRO_ID)
      .order('nombre')
    setServidores(data || [])
    setCargandoSrvs(false)
  }

  async function toggleGrupo(srv: ServidorInscripcion, nuevoGrupo: string | null) {
    setGuardandoId(srv.id)
    const { error } = await supabase
      .from('servidores_inscripcion')
      .update({ grupo: nuevoGrupo })
      .eq('id', srv.id)
    if (error) {
      mostrarToast('Error al guardar', 'error')
    } else {
      setServidores(prev => prev.map(s => s.id === srv.id ? { ...s, grupo: nuevoGrupo } : s))
      mostrarToast('Acceso actualizado', 'ok')
    }
    setGuardandoId(null)
  }

  useEffect(() => {
    if (mostrarPalancas) cargarServidoresPalancas()
  }, [mostrarPalancas])

  const grupoLabel: Record<string, string> = {
    'palancas': 'Hace seguimiento',
    'palancas_lider': 'Ve dashboard',
  }

  const grupoColor: Record<string, { bg: string; text: string }> = {
    'palancas': { bg: '#f0fdf4', text: '#15803d' },
    'palancas_lider': { bg: '#eef0ff', text: '#0f1787' },
  }

  return (
    <div style={{ background: '#f7f8fc', minHeight: '100vh', paddingBottom: 100 }}>

      {/* Header */}
      <div style={{ padding: '18px 20px 20px' }}>
        <div style={{ fontSize: 17, fontWeight: 500, color: '#0d0d14' }}>Configuración</div>
        <div style={{ fontSize: 13, color: '#9ca3af', marginTop: 2 }}>IX Retiro Effetá Mazuren · 3–5 julio 2026</div>
      </div>

      {/* Perfil card */}
      <div style={{ margin: '0 20px 20px', background: 'linear-gradient(135deg, #0f1787 0%, #1a23b8 100%)', borderRadius: 18, padding: '20px 18px', display: 'flex', alignItems: 'center', gap: 14 }}>
        <div style={{ width: 50, height: 50, borderRadius: '50%', background: 'rgba(255,255,255,0.15)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
          <User size={24} color="#fff" />
        </div>
        <div style={{ flex: 1 }}>
          <div style={{ fontSize: 15, fontWeight: 600, color: '#fff' }}>Líder</div>
          <div style={{ fontSize: 12, color: 'rgba(255,255,255,0.6)', marginTop: 2 }}>Effetá Mazuren</div>
        </div>
        <div style={{ fontSize: 10, fontWeight: 600, padding: '4px 10px', borderRadius: 20, background: 'rgba(255,255,255,0.15)', color: '#fff', letterSpacing: '0.05em' }}>
          LÍDER
        </div>
      </div>

      {/* NOTIFICACIONES */}
      <Seccion titulo="Notificaciones">
        <Fila
          icon={Bell} label="Nuevos pagos" color="#0f1787"
          sublabel="Alerta cuando un caminante paga"
          toggle toggleValue={notifPagos}
          onClick={() => setNotifPagos(v => !v)}
          chevron={false}
        />
        <Fila
          icon={Bell} label="Nuevos inscritos" color="#0f1787"
          sublabel="Alerta cuando alguien llena el formulario"
          toggle toggleValue={notifInscritos}
          onClick={() => setNotifInscritos(v => !v)}
          chevron={false} ultimo
        />
      </Seccion>

      {/* PALANCAS — GESTIÓN DE ACCESOS */}
      <div style={{ marginTop: 20 }} />
      <Seccion titulo="Grupo Palancas">
        <Fila
          icon={Users} label="Gestionar accesos de palancas" color="#0f1787"
          sublabel="Asignar quién hace seguimiento y quién ve el dashboard"
          onClick={() => setMostrarPalancas(v => !v)}
          chevron={!mostrarPalancas}
          ultimo={!mostrarPalancas}
        />

        {mostrarPalancas && (
          <div style={{ borderTop: '0.5px solid #f3f4f6' }}>

            {/* Leyenda */}
            <div style={{ padding: '12px 16px', display: 'flex', gap: 8, flexWrap: 'wrap', borderBottom: '0.5px solid #f3f4f6' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                <div style={{ width: 10, height: 10, borderRadius: 2, background: '#16a34a' }} />
                <span style={{ fontSize: 11, color: '#6b7280' }}>Hace seguimiento (app del servidor)</span>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                <div style={{ width: 10, height: 10, borderRadius: 2, background: '#0f1787' }} />
                <span style={{ fontSize: 11, color: '#6b7280' }}>Ve dashboard modo líder</span>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                <div style={{ width: 10, height: 10, borderRadius: 2, background: '#e5e7eb' }} />
                <span style={{ fontSize: 11, color: '#6b7280' }}>Sin acceso a palancas</span>
              </div>
            </div>

            {/* Nota líderes automáticos */}
            <div style={{ padding: '10px 16px', background: '#eef0ff', borderBottom: '0.5px solid #e0e4ff' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <Lock size={13} color="#0f1787" />
                <span style={{ fontSize: 12, color: '#0f1787', fontWeight: 500 }}>
                  Los líderes (Antonia, Daniel, Sofía) siempre tienen acceso al dashboard.
                </span>
              </div>
            </div>

            {cargandoSrvs ? (
              <div style={{ padding: '20px 16px', textAlign: 'center' }}>
                <p style={{ fontSize: 13, color: '#9ca3af', margin: 0 }}>Cargando servidores...</p>
              </div>
            ) : (
              <div>
                {servidores.map((srv, idx) => {
                  const esPalancas = srv.grupo === 'palancas'
                  const esPalancasLider = srv.grupo === 'palancas_lider'
                  const colorInfo = srv.grupo ? grupoColor[srv.grupo] : null
                  const esUltimo = idx === servidores.length - 1

                  return (
                    <div key={srv.id} style={{
                      padding: '12px 16px',
                      borderBottom: esUltimo ? 'none' : '0.5px solid #f3f4f6',
                      display: 'flex', alignItems: 'center', gap: 12,
                    }}>
                      {/* Nombre */}
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <p style={{ fontSize: 13, fontWeight: 500, color: '#0d0d14', margin: '0 0 4px', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                          {srv.nombre}
                        </p>
                        {srv.grupo && colorInfo ? (
                          <span style={{ fontSize: 10, fontWeight: 600, padding: '2px 8px', borderRadius: 10, background: colorInfo.bg, color: colorInfo.text }}>
                            {grupoLabel[srv.grupo] || srv.grupo}
                          </span>
                        ) : (
                          <span style={{ fontSize: 10, color: '#d1d5db' }}>Sin acceso</span>
                        )}
                      </div>

                      {/* Controles */}
                      <div style={{ display: 'flex', gap: 6, flexShrink: 0 }}>
                        {/* Toggle: hace seguimiento */}
                        <button
                          disabled={guardandoId === srv.id}
                          onClick={() => toggleGrupo(srv, esPalancas ? null : 'palancas')}
                          title="Hace seguimiento"
                          style={{
                            width: 34, height: 34, borderRadius: 8, border: '0.5px solid',
                            cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center',
                            background: esPalancas ? '#f0fdf4' : '#f9fafb',
                            borderColor: esPalancas ? '#86efac' : '#e5e7eb',
                            opacity: guardandoId === srv.id ? 0.5 : 1,
                          }}
                        >
                          <Users size={15} color={esPalancas ? '#16a34a' : '#d1d5db'} />
                        </button>

                        {/* Toggle: ve dashboard */}
                        <button
                          disabled={guardandoId === srv.id}
                          onClick={() => toggleGrupo(srv, esPalancasLider ? null : 'palancas_lider')}
                          title="Ve dashboard modo líder"
                          style={{
                            width: 34, height: 34, borderRadius: 8, border: '0.5px solid',
                            cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center',
                            background: esPalancasLider ? '#eef0ff' : '#f9fafb',
                            borderColor: esPalancasLider ? '#c7d0ff' : '#e5e7eb',
                            opacity: guardandoId === srv.id ? 0.5 : 1,
                          }}
                        >
                          <Shield size={15} color={esPalancasLider ? '#0f1787' : '#d1d5db'} />
                        </button>
                      </div>
                    </div>
                  )
                })}
              </div>
            )}
          </div>
        )}
      </Seccion>

      {/* DATOS */}
      <div style={{ marginTop: 20 }} />
      <Seccion titulo="Datos y sincronización">
        <Fila
          icon={sincronizando ? RefreshCw : Database}
          label={sincronizando ? 'Sincronizando…' : 'Sincronizar datos'}
          sublabel="Fuerza una actualización desde Supabase"
          color="#0f1787"
          onClick={() => !sincronizando && setModal('sync')}
        />
        <Fila
          icon={Download} label="Exportar caminantes" color="#0f1787"
          sublabel="Descarga la lista en CSV"
          onClick={async () => {
            const { data: r } = await supabase.from('retiros').select('id').eq('estado', 'activo').single()
            if (!r) { mostrarToast('No hay retiro activo', 'error'); return }
            const { data } = await supabase
              .from('vista_pagos_caminantes')
              .select('nombre, numero_documento, celular, correo, estado_pago, total_pagado')
              .eq('retiro_id', r.id)
            if (!data) { mostrarToast('Error al exportar', 'error'); return }
            const headers = ['Nombre', 'Documento', 'Celular', 'Correo', 'Estado pago', 'Total pagado']
            const rows = data.map(c => [c.nombre, c.numero_documento, c.celular, c.correo, c.estado_pago, c.total_pagado].join(','))
            const csv = [headers.join(','), ...rows].join('\n')
            const blob = new Blob([csv], { type: 'text/csv' })
            const url = URL.createObjectURL(blob)
            const a = document.createElement('a')
            a.href = url; a.download = 'caminantes-effeta.csv'; a.click()
            URL.revokeObjectURL(url)
            mostrarToast('CSV descargado', 'ok')
          }}
          ultimo
        />
      </Seccion>

      {/* APP */}
      <div style={{ marginTop: 20 }} />
      <Seccion titulo="Aplicación">
        <Fila
          icon={Globe} label="Abrir formulario de inscripción" color="#0f1787"
          sublabel="Link público del Google Form"
          onClick={() => window.open('https://docs.google.com/forms/d/1jLFD4BZingfwg_-OKGY0DYokFqMH-9eQr8GqlSAGuTM', '_blank')}
        />
        <Fila
          icon={Moon} label="Modo oscuro" color="#0f1787"
          sublabel="Próximamente"
          onClick={() => mostrarToast('Próximamente disponible', 'ok')}
        />
        <Fila
          icon={Shield} label="Privacidad y permisos" color="#0f1787"
          sublabel="Datos almacenados en Supabase · Colombia"
          onClick={() => mostrarToast('Todos los datos se almacenan de forma segura en Supabase', 'ok')}
          ultimo
        />
      </Seccion>

      {/* ACERCA DE */}
      <div style={{ marginTop: 20 }} />
      <Seccion titulo="Acerca de">
        <Fila
          icon={Info} label="Versión de la app" color="#6b7280"
          sublabel="v1.0 · IX Retiro Effetá Mazuren 2026"
          chevron={false}
        />
        <Fila
          icon={Globe} label="Effetá Mazuren en Instagram" color="#6b7280"
          sublabel="@effetamazuren"
          onClick={() => window.open('https://instagram.com/effetamazuren', '_blank')}
          ultimo
        />
      </Seccion>

      {/* SESIÓN */}
      <div style={{ marginTop: 20 }} />
      <Seccion titulo="Sesión">
        <Fila
          icon={LogOut} label="Cerrar sesión" peligro
          onClick={() => setModal('cerrar_sesion')}
          ultimo
        />
      </Seccion>

      <div style={{ height: 20 }} />

      {/* MODALES */}
      {modal === 'cerrar_sesion' && (
        <Modal
          titulo="¿Cerrar sesión?"
          mensaje="Se cerrará tu sesión como líder. Tendrás que volver a iniciar sesión para acceder al dashboard."
          confirmLabel="Cerrar sesión"
          peligro
          onConfirm={cerrarSesion}
          onCancel={() => setModal(null)}
        />
      )}
      {modal === 'sync' && (
        <Modal
          titulo="Sincronizar datos"
          mensaje="Esto forzará una actualización de los datos desde Supabase. Úsalo si ves información desactualizada en el dashboard."
          confirmLabel="Sincronizar ahora"
          onConfirm={sincronizarDatos}
          onCancel={() => setModal(null)}
        />
      )}

      {/* TOAST */}
      {toast && (
        <div style={{
          position: 'fixed', bottom: 90, left: 20, right: 20, zIndex: 300,
          background: toast.tipo === 'ok' ? '#0f1787' : '#dc2626',
          color: '#fff', borderRadius: 14, padding: '14px 18px',
          display: 'flex', alignItems: 'center', gap: 10,
          boxShadow: '0 8px 24px rgba(0,0,0,0.15)',
          animation: 'fadeUp 0.25s ease',
        }}>
          {toast.tipo === 'ok'
            ? <Check size={16} color="#fff" />
            : <AlertTriangle size={16} color="#fff" />}
          <span style={{ fontSize: 14, fontWeight: 500 }}>{toast.msg}</span>
        </div>
      )}

      <style>{`@keyframes fadeUp { from { opacity:0; transform:translateY(12px) } to { opacity:1; transform:translateY(0) } }`}</style>

      <BottomNav />
    </div>
  )
}
