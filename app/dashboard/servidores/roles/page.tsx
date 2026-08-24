'use client'
import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'
import { useRetiroActual } from '@/lib/retiro-context'
import { ChevronLeft, Plus, Trash2, Pencil, X, Check } from 'lucide-react'

type ServidorMini = { id: string; nombre: string }

type RolPreRetiro = {
  id: string
  nombre: string
  instrucciones: string | null
  asignados: ServidorMini[]
}

function iniciales(nombre: string) {
  return nombre.split(' ').slice(0, 2).map(n => n[0]).join('').toUpperCase()
}

export default function RolesPreRetiroPage() {
  const router = useRouter()
  const { id: RETIRO_ID } = useRetiroActual()

  const [servidores, setServidores] = useState<ServidorMini[]>([])
  const [roles, setRoles] = useState<RolPreRetiro[]>([])
  const [loading, setLoading] = useState(true)

  const [mostrarForm, setMostrarForm] = useState(false)
  const [nombreNuevo, setNombreNuevo] = useState('')
  const [instruccionesNuevo, setInstruccionesNuevo] = useState('')
  const [seleccionados, setSeleccionados] = useState<string[]>([])
  const [guardando, setGuardando] = useState(false)

  const [editandoId, setEditandoId] = useState<string | null>(null)
  const [editNombre, setEditNombre] = useState('')
  const [editInstrucciones, setEditInstrucciones] = useState('')
  const [busquedaAsignar, setBusquedaAsignar] = useState<Record<string, string>>({})

  useEffect(() => { cargar() }, [])

  async function cargar() {
    setLoading(true)

    const { data: srvs } = await supabase
      .from('servidores_inscripcion')
      .select('id, nombre')
      .eq('retiro_id', RETIRO_ID)
      .order('nombre')
    setServidores(srvs || [])

    const { data: rolesData } = await supabase
      .from('roles_pre_retiro')
      .select('id, nombre, instrucciones, roles_pre_retiro_asignaciones(servidor_inscripcion_id, servidores_inscripcion(id, nombre))')
      .eq('retiro_id', RETIRO_ID)
      .order('created_at')

    const rolesFormateados: RolPreRetiro[] = (rolesData || []).map((r: any) => ({
      id: r.id,
      nombre: r.nombre,
      instrucciones: r.instrucciones,
      asignados: (r.roles_pre_retiro_asignaciones || [])
        .map((a: any) => a.servidores_inscripcion)
        .filter(Boolean),
    }))
    setRoles(rolesFormateados)
    setLoading(false)
  }

  async function crearRol() {
    if (!nombreNuevo.trim()) return
    setGuardando(true)
    try {
      const { data: rol, error } = await supabase
        .from('roles_pre_retiro')
        .insert({ retiro_id: RETIRO_ID, nombre: nombreNuevo.trim(), instrucciones: instruccionesNuevo.trim() || null })
        .select('id')
        .single()

      if (error || !rol) throw new Error(error?.message)

      if (seleccionados.length > 0) {
        await supabase.from('roles_pre_retiro_asignaciones').insert(
          seleccionados.map(servidorId => ({ rol_id: rol.id, servidor_inscripcion_id: servidorId }))
        )
      }

      setNombreNuevo(''); setInstruccionesNuevo(''); setSeleccionados([]); setMostrarForm(false)
      await cargar()
    } catch (err: any) {
      alert('Error creando rol: ' + (err.message || 'desconocido'))
    } finally {
      setGuardando(false)
    }
  }

  async function guardarEdicion(rolId: string) {
    setGuardando(true)
    try {
      await supabase
        .from('roles_pre_retiro')
        .update({ nombre: editNombre.trim(), instrucciones: editInstrucciones.trim() || null })
        .eq('id', rolId)
      setEditandoId(null)
      await cargar()
    } finally {
      setGuardando(false)
    }
  }

  async function eliminarRol(rolId: string) {
    if (!confirm('¿Eliminar este rol y todas sus asignaciones?')) return
    await supabase.from('roles_pre_retiro').delete().eq('id', rolId)
    await cargar()
  }

  async function toggleAsignacion(rol: RolPreRetiro, servidor: ServidorMini) {
    const yaAsignado = rol.asignados.some(a => a.id === servidor.id)
    if (yaAsignado) {
      await supabase
        .from('roles_pre_retiro_asignaciones')
        .delete()
        .eq('rol_id', rol.id)
        .eq('servidor_inscripcion_id', servidor.id)
    } else {
      await supabase
        .from('roles_pre_retiro_asignaciones')
        .insert({ rol_id: rol.id, servidor_inscripcion_id: servidor.id })
    }
    await cargar()
  }

  if (loading) return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: '100vh', background: '#f7f8fc' }}>
      <div style={{ color: '#9ca3af', fontSize: 14 }}>Cargando...</div>
    </div>
  )

  return (
    <div style={{ background: '#f7f8fc', minHeight: '100vh', paddingBottom: 100 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '18px 20px 14px' }}>
        <button onClick={() => router.push('/dashboard/servidores')} style={{ width: 34, height: 34, borderRadius: '50%', background: '#fff', border: '0.5px solid #e5e7eb', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer' }}>
          <ChevronLeft size={18} color="#6b7280" />
        </button>
        <div style={{ fontSize: 17, fontWeight: 500, color: '#0d0d14' }}>Roles pre-retiro</div>
      </div>

      <div style={{ padding: '0 20px 14px' }}>
        <p style={{ fontSize: 12, color: '#9ca3af', margin: 0 }}>
          Roles y responsabilidades que se asignan antes del retiro (distintos a los roles del fin de semana). Cada servidor ve, en su propia app, el rol que le asignes aquí y sus instrucciones.
        </p>
      </div>

      <div style={{ padding: '0 20px 14px' }}>
        {!mostrarForm ? (
          <button onClick={() => setMostrarForm(true)}
            style={{ width: '100%', padding: 14, borderRadius: 14, border: '1.5px dashed #c7d2fe', background: '#f0f2ff', color: '#0f1787', fontSize: 14, fontWeight: 600, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8 }}>
            <Plus size={18} /> Crear rol nuevo
          </button>
        ) : (
          <div style={{ background: '#fff', borderRadius: 14, padding: 16, border: '0.5px solid #e5e7eb', display: 'flex', flexDirection: 'column', gap: 10 }}>
            <div>
              <label style={{ fontSize: 12, color: '#6b7280', display: 'block', marginBottom: 4 }}>Nombre del rol</label>
              <input value={nombreNuevo} onChange={e => setNombreNuevo(e.target.value)} placeholder="Ej: Encargado de música"
                style={{ width: '100%', padding: '10px 12px', borderRadius: 10, border: '0.5px solid #e5e7eb', fontSize: 14, boxSizing: 'border-box' }} />
            </div>
            <div>
              <label style={{ fontSize: 12, color: '#6b7280', display: 'block', marginBottom: 4 }}>Instrucciones</label>
              <textarea value={instruccionesNuevo} onChange={e => setInstruccionesNuevo(e.target.value)} rows={3} placeholder="Qué debe hacer, cuándo, con quién coordinar..."
                style={{ width: '100%', padding: '10px 12px', borderRadius: 10, border: '0.5px solid #e5e7eb', fontSize: 14, boxSizing: 'border-box', resize: 'vertical', fontFamily: 'inherit' }} />
            </div>
            <div>
              <label style={{ fontSize: 12, color: '#6b7280', display: 'block', marginBottom: 6 }}>Asignar a ({seleccionados.length} seleccionados)</label>
              <div style={{ maxHeight: 220, overflowY: 'auto', border: '0.5px solid #e5e7eb', borderRadius: 10, padding: 6 }}>
                {servidores.map(s => {
                  const marcado = seleccionados.includes(s.id)
                  return (
                    <button key={s.id} type="button"
                      onClick={() => setSeleccionados(prev => marcado ? prev.filter(id => id !== s.id) : [...prev, s.id])}
                      style={{ width: '100%', display: 'flex', alignItems: 'center', gap: 8, padding: '8px 10px', borderRadius: 8, background: marcado ? '#eef0ff' : 'transparent', border: 'none', cursor: 'pointer', textAlign: 'left' }}>
                      <div style={{ width: 18, height: 18, borderRadius: 4, border: `1.5px solid ${marcado ? '#0f1787' : '#d1d5db'}`, background: marcado ? '#0f1787' : 'transparent', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                        {marcado && <Check size={12} color="#fff" />}
                      </div>
                      <span style={{ fontSize: 13, color: '#111827' }}>{s.nombre}</span>
                    </button>
                  )
                })}
                {servidores.length === 0 && <p style={{ fontSize: 12, color: '#9ca3af', padding: 8, margin: 0 }}>No hay servidores inscritos todavía.</p>}
              </div>
            </div>
            <div style={{ display: 'flex', gap: 8 }}>
              <button onClick={() => { setMostrarForm(false); setNombreNuevo(''); setInstruccionesNuevo(''); setSeleccionados([]) }}
                style={{ flex: 1, padding: 12, borderRadius: 10, border: '0.5px solid #e5e7eb', background: '#fff', color: '#6b7280', fontSize: 14, cursor: 'pointer' }}>
                Cancelar
              </button>
              <button onClick={crearRol} disabled={guardando || !nombreNuevo.trim()}
                style={{ flex: 2, padding: 12, borderRadius: 10, border: 'none', background: !nombreNuevo.trim() ? '#e5e7eb' : '#0f1787', color: !nombreNuevo.trim() ? '#9ca3af' : '#fff', fontSize: 14, fontWeight: 600, cursor: !nombreNuevo.trim() ? 'not-allowed' : 'pointer' }}>
                {guardando ? 'Creando...' : 'Crear rol'}
              </button>
            </div>
          </div>
        )}
      </div>

      <div style={{ padding: '0 20px', display: 'flex', flexDirection: 'column', gap: 10 }}>
        {roles.length === 0 && (
          <div style={{ textAlign: 'center', color: '#9ca3af', fontSize: 14, padding: 40 }}>
            Todavía no hay roles pre-retiro creados.
          </div>
        )}

        {roles.map(rol => {
          const editando = editandoId === rol.id
          const busq = (busquedaAsignar[rol.id] || '').toLowerCase()
          const candidatos = busq.length > 0 ? servidores.filter(s => s.nombre.toLowerCase().includes(busq)) : []

          return (
            <div key={rol.id} style={{ background: '#fff', borderRadius: 14, padding: 16, border: '0.5px solid #e5e7eb' }}>
              {editando ? (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginBottom: 12 }}>
                  <input value={editNombre} onChange={e => setEditNombre(e.target.value)}
                    style={{ width: '100%', padding: '8px 10px', borderRadius: 8, border: '0.5px solid #e5e7eb', fontSize: 14, fontWeight: 600, boxSizing: 'border-box' }} />
                  <textarea value={editInstrucciones} onChange={e => setEditInstrucciones(e.target.value)} rows={3}
                    style={{ width: '100%', padding: '8px 10px', borderRadius: 8, border: '0.5px solid #e5e7eb', fontSize: 13, boxSizing: 'border-box', resize: 'vertical', fontFamily: 'inherit' }} />
                  <div style={{ display: 'flex', gap: 8 }}>
                    <button onClick={() => setEditandoId(null)} style={{ flex: 1, padding: 8, borderRadius: 8, border: '0.5px solid #e5e7eb', background: '#fff', color: '#6b7280', fontSize: 13, cursor: 'pointer' }}>Cancelar</button>
                    <button onClick={() => guardarEdicion(rol.id)} disabled={guardando} style={{ flex: 1, padding: 8, borderRadius: 8, border: 'none', background: '#0f1787', color: '#fff', fontSize: 13, fontWeight: 600, cursor: 'pointer' }}>Guardar</button>
                  </div>
                </div>
              ) : (
                <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 8 }}>
                  <div>
                    <div style={{ fontSize: 15, fontWeight: 600, color: '#111827' }}>{rol.nombre}</div>
                    {rol.instrucciones && <p style={{ fontSize: 13, color: '#6b7280', margin: '4px 0 0', whiteSpace: 'pre-wrap' }}>{rol.instrucciones}</p>}
                  </div>
                  <div style={{ display: 'flex', gap: 6, flexShrink: 0 }}>
                    <button onClick={() => { setEditandoId(rol.id); setEditNombre(rol.nombre); setEditInstrucciones(rol.instrucciones || '') }}
                      style={{ width: 30, height: 30, borderRadius: 8, border: '0.5px solid #e5e7eb', background: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer' }}>
                      <Pencil size={14} color="#6b7280" />
                    </button>
                    <button onClick={() => eliminarRol(rol.id)}
                      style={{ width: 30, height: 30, borderRadius: 8, border: '0.5px solid #fecaca', background: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer' }}>
                      <Trash2 size={14} color="#dc2626" />
                    </button>
                  </div>
                </div>
              )}

              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginBottom: 10 }}>
                {rol.asignados.map(s => (
                  <span key={s.id} style={{ fontSize: 12, background: '#eef0ff', color: '#0f1787', padding: '4px 10px', borderRadius: 20, display: 'flex', alignItems: 'center', gap: 6 }}>
                    {iniciales(s.nombre)} · {s.nombre.split(' ')[0]}
                    <button onClick={() => toggleAsignacion(rol, s)} style={{ background: 'none', border: 'none', cursor: 'pointer', display: 'flex', color: '#0f1787' }}>
                      <X size={12} />
                    </button>
                  </span>
                ))}
                {rol.asignados.length === 0 && <span style={{ fontSize: 12, color: '#9ca3af' }}>Sin nadie asignado todavía</span>}
              </div>

              <div style={{ position: 'relative' }}>
                <input
                  value={busquedaAsignar[rol.id] || ''}
                  onChange={e => setBusquedaAsignar(prev => ({ ...prev, [rol.id]: e.target.value }))}
                  placeholder="Buscar servidor para asignar..."
                  style={{ width: '100%', padding: '8px 10px', borderRadius: 8, border: '0.5px solid #e5e7eb', fontSize: 13, boxSizing: 'border-box' }}
                />
                {candidatos.length > 0 && (
                  <div style={{ marginTop: 4, border: '0.5px solid #e5e7eb', borderRadius: 8, maxHeight: 160, overflowY: 'auto' }}>
                    {candidatos.map(s => {
                      const yaAsignado = rol.asignados.some(a => a.id === s.id)
                      return (
                        <button key={s.id} onClick={() => { toggleAsignacion(rol, s); setBusquedaAsignar(prev => ({ ...prev, [rol.id]: '' })) }}
                          disabled={yaAsignado}
                          style={{ width: '100%', textAlign: 'left', padding: '8px 10px', fontSize: 13, background: 'none', border: 'none', cursor: yaAsignado ? 'default' : 'pointer', color: yaAsignado ? '#d1d5db' : '#111827' }}>
                          {s.nombre} {yaAsignado ? '(ya asignado)' : ''}
                        </button>
                      )
                    })}
                  </div>
                )}
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}
