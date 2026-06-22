'use client'
import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'
import BottomNav from '@/components/BottomNav'
import {
  User, Bell, Shield, Download, RefreshCw, UserPlus,
  ChevronRight, LogOut, Info, Database, Moon, Globe,
  AlertTriangle, Check
} from 'lucide-react'

type Toast = { msg: string; tipo: 'ok' | 'error' } | null

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

export default function ConfigPage() {
  const router = useRouter()
  const [notifPagos, setNotifPagos] = useState(true)
  const [notifInscritos, setNotifInscritos] = useState(true)
  const [modal, setModal] = useState<'cerrar_sesion' | 'sync' | null>(null)
  const [toast, setToast] = useState<Toast>(null)
  const [sincronizando, setSincronizando] = useState(false)

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
      // Refrescar caché tocando Supabase
      const { error } = await supabase.from('retiros').select('id').eq('estado', 'activo').single()
      if (error) throw error
      mostrarToast('Datos sincronizados correctamente', 'ok')
    } catch {
      mostrarToast('Error al sincronizar', 'error')
    } finally {
      setSincronizando(false)
    }
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
