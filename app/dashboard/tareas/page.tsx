'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'

const RETIRO_ID = '21da7588-f7d9-4bf8-a6f6-ae6c8258c00e'

type Estado = 'pendiente' | 'en_progreso' | 'completada' | 'no_realizada'
type Prioridad = 'alta' | 'media' | 'baja'
type Filtro = 'todas' | Estado

interface Tarea {
  id: string
  titulo: string
  descripcion: string | null
  estado: Estado
  prioridad: Prioridad
  creado_por: string | null
  created_at: string
}

const ESTADOS: { id: Estado; label: string; color: string; bg: string; icon: string }[] = [
  { id: 'pendiente',    label: 'Pendiente',    color: '#d97706', bg: '#fef3c7', icon: '○' },
  { id: 'en_progreso',  label: 'En progreso',  color: '#2563eb', bg: '#eff6ff', icon: '◑' },
  { id: 'completada',   label: 'Completada',   color: '#16a34a', bg: '#f0fdf4', icon: '●' },
  { id: 'no_realizada', label: 'No realizada', color: '#6b7280', bg: '#f3f4f6', icon: '✕' },
]

const PRIORIDADES: { id: Prioridad; label: string; color: string }[] = [
  { id: 'alta',  label: 'Alta',  color: '#dc2626' },
  { id: 'media', label: 'Media', color: '#d97706' },
  { id: 'baja',  label: 'Baja',  color: '#16a34a' },
]

export default function TareasPage() {
  const router = useRouter()
  const [tareas, setTareas] = useState<Tarea[]>([])
  const [loading, setLoading] = useState(true)
  const [filtro, setFiltro] = useState<Filtro>('todas')
  const [mostrarForm, setMostrarForm] = useState(false)
  const [guardando, setGuardando] = useState(false)
  const [nombreUsuario, setNombreUsuario] = useState('')

  // Form nueva tarea
  const [nuevoTitulo, setNuevoTitulo] = useState('')
  const [nuevoDesc, setNuevoDesc] = useState('')
  const [nuevaPrioridad, setNuevaPrioridad] = useState<Prioridad>('media')

  // Edición de estado inline
  const [cambiandoId, setCambiandoId] = useState<string | null>(null)

  useEffect(() => {
    supabase.auth.getUser().then(({ data: { user } }) => {
      if (user) {
        supabase.from('usuarios').select('nombre').eq('id', user.id).single()
          .then(({ data }) => { if (data?.nombre) setNombreUsuario(data.nombre.split(' ')[0]) })
      }
    })
    cargarTareas()

    const channel = supabase
      .channel('tareas-realtime')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'tareas_retiro' }, cargarTareas)
      .subscribe()

    return () => { supabase.removeChannel(channel) }
  }, [])

  const cargarTareas = async () => {
    const { data } = await supabase
      .from('tareas_retiro')
      .select('*')
      .eq('retiro_id', RETIRO_ID)
      .order('created_at', { ascending: false })
    setTareas(data ?? [])
    setLoading(false)
  }

  const crearTarea = async () => {
    if (!nuevoTitulo.trim()) return
    setGuardando(true)
    await supabase.from('tareas_retiro').insert({
      retiro_id: RETIRO_ID,
      titulo: nuevoTitulo.trim(),
      descripcion: nuevoDesc.trim() || null,
      estado: 'pendiente',
      prioridad: nuevaPrioridad,
      creado_por: nombreUsuario || 'Líder',
    })
    setNuevoTitulo('')
    setNuevoDesc('')
    setNuevaPrioridad('media')
    setMostrarForm(false)
    setGuardando(false)
  }

  const cambiarEstado = async (id: string, estado: Estado) => {
    setCambiandoId(null)
    await supabase.from('tareas_retiro').update({ estado, updated_at: new Date().toISOString() }).eq('id', id)
  }

  const eliminarTarea = async (id: string) => {
    if (!confirm('¿Eliminar esta tarea?')) return
    await supabase.from('tareas_retiro').delete().eq('id', id)
  }

  const tareasFiltradas = filtro === 'todas' ? tareas : tareas.filter(t => t.estado === filtro)

  const conteo = {
    todas: tareas.length,
    pendiente: tareas.filter(t => t.estado === 'pendiente').length,
    en_progreso: tareas.filter(t => t.estado === 'en_progreso').length,
    completada: tareas.filter(t => t.estado === 'completada').length,
    no_realizada: tareas.filter(t => t.estado === 'no_realizada').length,
  }

  const getEstado = (id: Estado) => ESTADOS.find(e => e.id === id)!
  const getPrioridad = (id: Prioridad) => PRIORIDADES.find(p => p.id === id)!

  if (loading) return (
    <div style={{ display: 'flex', justifyContent: 'center', padding: 60 }}>
      <div style={{ width: 32, height: 32, border: '3px solid #e2e4f0', borderTopColor: '#0f1787', borderRadius: '50%', animation: 'spin 0.8s linear infinite' }} />
      <style>{`@keyframes spin{to{transform:rotate(360deg)}}`}</style>
    </div>
  )

  return (
    <div style={{ padding: '24px 16px', maxWidth: 600, margin: '0 auto', paddingBottom: 40 }}>

      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 24 }}>
        <div>
          <h1 style={{ fontSize: 20, fontWeight: 700, color: '#111827', margin: '0 0 4px' }}>To Do List</h1>
          <p style={{ fontSize: 13, color: '#6b7280', margin: 0 }}>{tareas.length} tareas · {conteo.completada} completadas</p>
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          <button
            onClick={() => router.push('/dashboard')}
            style={{ background: '#f3f4f6', border: 'none', borderRadius: 8, padding: '8px 14px', fontSize: 13, cursor: 'pointer', color: '#374151' }}
          >← Dashboard</button>
          <button
            onClick={() => setMostrarForm(!mostrarForm)}
            style={{ background: '#0f1787', border: 'none', borderRadius: 8, padding: '8px 14px', fontSize: 13, cursor: 'pointer', color: 'white', fontWeight: 600 }}
          >+ Nueva</button>
        </div>
      </div>

      {/* Formulario nueva tarea */}
      {mostrarForm && (
        <div style={{ background: 'white', border: '1.5px solid #e8eaf0', borderRadius: 14, padding: '18px', marginBottom: 20 }}>
          <p style={{ fontSize: 14, fontWeight: 700, color: '#111827', margin: '0 0 14px' }}>Nueva tarea</p>

          <div style={{ marginBottom: 12 }}>
            <label style={{ fontSize: 11, fontWeight: 600, color: '#6b7280', display: 'block', marginBottom: 4 }}>TAREA</label>
            <input
              type="text"
              placeholder="¿Qué hay que hacer?"
              value={nuevoTitulo}
              onChange={e => setNuevoTitulo(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && crearTarea()}
              style={{ width: '100%', padding: '10px 12px', border: '1.5px solid #e8eaf0', borderRadius: 10, fontSize: 14, outline: 'none', boxSizing: 'border-box', fontFamily: 'inherit' }}
            />
          </div>

          <div style={{ marginBottom: 12 }}>
            <label style={{ fontSize: 11, fontWeight: 600, color: '#6b7280', display: 'block', marginBottom: 4 }}>DESCRIPCIÓN (opcional)</label>
            <textarea
              placeholder="Detalles adicionales..."
              value={nuevoDesc}
              onChange={e => setNuevoDesc(e.target.value)}
              rows={2}
              style={{ width: '100%', padding: '10px 12px', border: '1.5px solid #e8eaf0', borderRadius: 10, fontSize: 13, outline: 'none', boxSizing: 'border-box', fontFamily: 'inherit', resize: 'none' }}
            />
          </div>

          <div style={{ marginBottom: 16 }}>
            <label style={{ fontSize: 11, fontWeight: 600, color: '#6b7280', display: 'block', marginBottom: 6 }}>PRIORIDAD</label>
            <div style={{ display: 'flex', gap: 8 }}>
              {PRIORIDADES.map(p => (
                <button
                  key={p.id}
                  onClick={() => setNuevaPrioridad(p.id)}
                  style={{
                    flex: 1, padding: '7px', border: 'none', borderRadius: 8, fontSize: 12, fontWeight: 600,
                    cursor: 'pointer',
                    background: nuevaPrioridad === p.id ? p.color : '#f3f4f6',
                    color: nuevaPrioridad === p.id ? 'white' : '#6b7280',
                  }}
                >{p.label}</button>
              ))}
            </div>
          </div>

          <div style={{ display: 'flex', gap: 8 }}>
            <button
              onClick={crearTarea}
              disabled={guardando || !nuevoTitulo.trim()}
              style={{ flex: 1, padding: '10px', background: !nuevoTitulo.trim() ? '#e5e7eb' : '#0f1787', color: !nuevoTitulo.trim() ? '#9ca3af' : 'white', border: 'none', borderRadius: 10, fontSize: 14, fontWeight: 600, cursor: !nuevoTitulo.trim() ? 'not-allowed' : 'pointer' }}
            >{guardando ? 'Guardando...' : 'Crear tarea'}</button>
            <button
              onClick={() => setMostrarForm(false)}
              style={{ padding: '10px 16px', background: '#f3f4f6', color: '#374151', border: 'none', borderRadius: 10, fontSize: 14, cursor: 'pointer' }}
            >Cancelar</button>
          </div>
        </div>
      )}

      {/* Filtros */}
      <div style={{ display: 'flex', gap: 6, marginBottom: 20, overflowX: 'auto', paddingBottom: 4 }}>
        {[
          { id: 'todas' as Filtro, label: 'Todas', count: conteo.todas, color: '#0f1787', bg: '#f0f2ff' },
          ...ESTADOS.map(e => ({ id: e.id as Filtro, label: e.label, count: conteo[e.id], color: e.color, bg: e.bg }))
        ].map(f => (
          <button
            key={f.id}
            onClick={() => setFiltro(f.id)}
            style={{
              padding: '6px 12px', border: 'none', borderRadius: 20, fontSize: 12, fontWeight: 600,
              cursor: 'pointer', flexShrink: 0, display: 'flex', alignItems: 'center', gap: 5,
              background: filtro === f.id ? f.color : '#f3f4f6',
              color: filtro === f.id ? 'white' : '#6b7280',
            }}
          >
            {f.label}
            <span style={{
              background: filtro === f.id ? 'rgba(255,255,255,0.25)' : '#e5e7eb',
              color: filtro === f.id ? 'white' : '#6b7280',
              borderRadius: 20, padding: '0 6px', fontSize: 11, fontWeight: 700,
            }}>{f.count}</span>
          </button>
        ))}
      </div>

      {/* Lista de tareas */}
      {tareasFiltradas.length === 0 ? (
        <div style={{ textAlign: 'center', padding: '40px 20px', color: '#9ca3af' }}>
          <div style={{ fontSize: 32, marginBottom: 8 }}>
            {filtro === 'completada' ? '✓' : filtro === 'pendiente' ? '○' : '·'}
          </div>
          <p style={{ margin: 0, fontSize: 14 }}>
            {filtro === 'todas' ? 'No hay tareas aún. Crea la primera.' : `No hay tareas ${ESTADOS.find(e => e.id === filtro)?.label.toLowerCase()}`}
          </p>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {tareasFiltradas.map(tarea => {
            const estado = getEstado(tarea.estado)
            const prioridad = getPrioridad(tarea.prioridad)
            const estaAbierto = cambiandoId === tarea.id

            return (
              <div
                key={tarea.id}
                style={{
                  background: 'white', border: '1.5px solid #e8eaf0', borderRadius: 12,
                  opacity: tarea.estado === 'no_realizada' ? 0.6 : 1,
                  overflow: 'hidden',
                }}
              >
                <div style={{ padding: '12px 14px' }}>
                  <div style={{ display: 'flex', alignItems: 'flex-start', gap: 10 }}>

                    {/* Botón de estado */}
                    <button
                      onClick={() => setCambiandoId(estaAbierto ? null : tarea.id)}
                      style={{
                        width: 28, height: 28, borderRadius: '50%', flexShrink: 0,
                        background: estado.bg, border: `2px solid ${estado.color}`,
                        cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center',
                        fontSize: 12, color: estado.color, fontWeight: 700, marginTop: 1,
                      }}
                    >{estado.icon}</button>

                    {/* Contenido */}
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <p style={{
                        fontSize: 14, fontWeight: 600, color: '#111827', margin: '0 0 2px',
                        textDecoration: tarea.estado === 'completada' ? 'line-through' : 'none',
                        opacity: tarea.estado === 'completada' ? 0.6 : 1,
                      }}>{tarea.titulo}</p>
                      {tarea.descripcion && (
                        <p style={{ fontSize: 12, color: '#6b7280', margin: '0 0 6px', lineHeight: 1.4 }}>
                          {tarea.descripcion}
                        </p>
                      )}
                      <div style={{ display: 'flex', gap: 6, alignItems: 'center', flexWrap: 'wrap' }}>
                        <span style={{ fontSize: 10, background: estado.bg, color: estado.color, padding: '2px 7px', borderRadius: 20, fontWeight: 600 }}>
                          {estado.label}
                        </span>
                        <span style={{ fontSize: 10, color: prioridad.color, fontWeight: 600 }}>
                          {prioridad.label}
                        </span>
                        {tarea.creado_por && (
                          <span style={{ fontSize: 10, color: '#9ca3af' }}>por {tarea.creado_por}</span>
                        )}
                      </div>
                    </div>

                    {/* Eliminar */}
                    <button
                      onClick={() => eliminarTarea(tarea.id)}
                      style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#d1d5db', fontSize: 16, padding: '2px 4px', flexShrink: 0 }}
                    >✕</button>
                  </div>

                  {/* Selector de estado inline */}
                  {estaAbierto && (
                    <div style={{ marginTop: 10, paddingTop: 10, borderTop: '1px solid #f3f4f6', display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                      <p style={{ fontSize: 11, fontWeight: 600, color: '#6b7280', width: '100%', margin: '0 0 6px' }}>CAMBIAR ESTADO</p>
                      {ESTADOS.map(e => (
                        <button
                          key={e.id}
                          onClick={() => cambiarEstado(tarea.id, e.id)}
                          style={{
                            padding: '5px 10px', border: 'none', borderRadius: 20, fontSize: 11, fontWeight: 600,
                            cursor: 'pointer',
                            background: tarea.estado === e.id ? e.color : e.bg,
                            color: tarea.estado === e.id ? 'white' : e.color,
                          }}
                        >{e.icon} {e.label}</button>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            )
          })}
        </div>
      )}

      {/* Progreso */}
      {tareas.length > 0 && (
        <div style={{ marginTop: 20, background: 'white', border: '1.5px solid #e8eaf0', borderRadius: 12, padding: '14px 16px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 8 }}>
            <span style={{ fontSize: 12, color: '#6b7280', fontWeight: 500 }}>Progreso general</span>
            <span style={{ fontSize: 12, fontWeight: 700, color: '#16a34a' }}>
              {Math.round((conteo.completada / tareas.length) * 100)}%
            </span>
          </div>
          <div style={{ height: 6, background: '#f3f4f6', borderRadius: 6, overflow: 'hidden' }}>
            <div style={{ height: '100%', width: `${(conteo.completada / tareas.length) * 100}%`, background: '#16a34a', borderRadius: 6, transition: 'width 0.5s' }} />
          </div>
          <p style={{ fontSize: 11, color: '#9ca3af', margin: '6px 0 0' }}>
            {conteo.completada} completadas · {conteo.en_progreso} en progreso · {conteo.pendiente} pendientes
          </p>
        </div>
      )}
    </div>
  )
}
