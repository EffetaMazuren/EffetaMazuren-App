'use client'

import { useEffect, useState, useCallback } from 'react'
import { supabase } from '@/lib/supabase'

const RETIRO_ID = '21da7588-f7d9-4bf8-a6f6-ae6c8258c00e'

interface RolRetiro {
  rol: string
  categoria: string
  encargados: string[]
}

interface MesaDB {
  numero: number
  adulto: string
  lider: string
  colider: string
}

interface ContactoEmergencia {
  nombre: string
  parentesco: string | null
  celular: string | null
}

interface CaminanteMesa {
  id: string
  asignacion_id: string
  nombre: string
  celular: string
  edad: number | null
  es_sorpresa: boolean
  alergias: string | null
  restricciones_alimentarias: string | null
  medicamentos: string | null
  contacto_emergencia?: ContactoEmergencia | null
}

interface ServidorInfo {
  roles: RolRetiro[]
  mesa?: MesaDB
  esLiderDeMesa?: boolean
  caminantes: CaminanteMesa[]
}

const COLOR_ROL: Record<string, { bg: string; dot: string; text: string }> = {
  'Música':                       { bg: '#ede9fe', dot: '#7c3aed', text: '#5b21b6' },
  '¿Por qué oramos cantando?':    { bg: '#ede9fe', dot: '#7c3aed', text: '#5b21b6' },
  'Palancas':                     { bg: '#fce7f3', dot: '#db2777', text: '#9d174d' },
  'Mantelitos':                   { bg: '#fce7f3', dot: '#db2777', text: '#9d174d' },
  'Snacks':                       { bg: '#fef3c7', dot: '#d97706', text: '#92400e' },
  'Pastillero':                   { bg: '#d1fae5', dot: '#059669', text: '#065f46' },
  'Bendición de alimentos':       { bg: '#d1fae5', dot: '#059669', text: '#065f46' },
  'Explicación Santísimo':        { bg: '#dbeafe', dot: '#2563eb', text: '#1e40af' },
  'Santísimo':                    { bg: '#dbeafe', dot: '#2563eb', text: '#1e40af' },
  'Turnos Santísimo y Angelitos': { bg: '#dbeafe', dot: '#2563eb', text: '#1e40af' },
  'Explicación Palanquitas':      { bg: '#fce7f3', dot: '#db2777', text: '#9d174d' },
  'Guachafita':                   { bg: '#fef9c3', dot: '#ca8a04', text: '#713f12' },
  'Bienvenida':                   { bg: '#e0f2fe', dot: '#0284c7', text: '#075985' },
  'Recepción':                    { bg: '#e0f2fe', dot: '#0284c7', text: '#075985' },
  'Lobby':                        { bg: '#e0f2fe', dot: '#0284c7', text: '#075985' },
  'Maleteros':                    { bg: '#f3f4f6', dot: '#6b7280', text: '#374151' },
  'Despertar Caminantes':         { bg: '#fef3c7', dot: '#d97706', text: '#92400e' },
  'Despertar Sábado':             { bg: '#fef3c7', dot: '#d97706', text: '#92400e' },
  'Resumen Viernes':              { bg: '#dcfce7', dot: '#16a34a', text: '#14532d' },
  'Resumen Sábado':               { bg: '#dcfce7', dot: '#16a34a', text: '#14532d' },
  'Oración Sábado':               { bg: '#f5f3ff', dot: '#7c3aed', text: '#5b21b6' },
  'Oración Domingo':              { bg: '#f5f3ff', dot: '#7c3aed', text: '#5b21b6' },
  'Rosario Sábado':               { bg: '#fce7f3', dot: '#db2777', text: '#9d174d' },
  'Rosario Domingo':              { bg: '#fce7f3', dot: '#db2777', text: '#9d174d' },
  'Cartas de Jesús':              { bg: '#fdf2f8', dot: '#be185d', text: '#831843' },
  'Máscaras':                     { bg: '#f5f3ff', dot: '#6d28d9', text: '#6d28d9' },
  'Sanando mi Alma':              { bg: '#fff1f2', dot: '#e11d48', text: '#9f1239' },
  'Acomodar en paredes':          { bg: '#f0f9ff', dot: '#0369a1', text: '#0c4a6e' },
  'Pared a Confesiones':          { bg: '#ecfdf5', dot: '#059669', text: '#065f46' },
  'Confesiones a Palancas':       { bg: '#ecfdf5', dot: '#059669', text: '#065f46' },
  'Palancas a Rumba':             { bg: '#ecfdf5', dot: '#059669', text: '#065f46' },
  'Recepción de Rumba':           { bg: '#ecfdf5', dot: '#059669', text: '#065f46' },
}

function getColor(rol: string) {
  return COLOR_ROL[rol] ?? { bg: '#f3f4f6', dot: '#9ca3af', text: '#374151' }
}

function norm(s: string): string {
  return s.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').trim()
}

function tokensOf(s: string): string[] {
  return norm(s).split(/\s+/).filter(t => t.length > 1)
}

function nombreMatch(a: string, b: string): boolean {
  const nA = norm(a), nB = norm(b)
  if (nA === nB) return true
  if (nA.includes(nB) || nB.includes(nA)) return true
  const tA = tokensOf(a)
  const tB = tokensOf(b)
  if (tA.length < 2 || tB.length < 2) return false
  if (tA[0] !== tB[0]) return false
  const segundoCompartido = tA.length > 2 && tB.length > 2 && tA[1] === tB[1]
  const desdeA = segundoCompartido ? 2 : 1
  const desdeB = segundoCompartido ? 2 : 1
  const apellidosA = tA.slice(desdeA)
  const apellidosB = tB.slice(desdeB)
  return apellidosA.filter(ap => apellidosB.includes(ap)).length >= 1
}

function nombreEnLista(nombreServidor: string, encargados: string[]): boolean {
  return encargados.some(enc => nombreMatch(nombreServidor, enc))
}

function buscarMesaParaServidor(nombre: string, mesas: MesaDB[]): { mesa: MesaDB; esLider: boolean } | null {
  for (const mesa of mesas) {
    const lideres = [mesa.lider, mesa.colider].filter(Boolean)
    if (nombreEnLista(nombre, lideres)) return { mesa, esLider: true }
    if (nombreEnLista(nombre, [mesa.adulto])) return { mesa, esLider: false }
  }
  return null
}

// Chips de info médica: alergia=rojo, restricción=ámbar, medicamento=morado
const INFO_MEDICA = [
  { key: 'alergias' as const,                   label: 'Alergia',      bg: '#fef2f2', color: '#dc2626', border: '#fca5a5' },
  { key: 'restricciones_alimentarias' as const,  label: 'Restricción',  bg: '#fffbeb', color: '#d97706', border: '#fcd34d' },
  { key: 'medicamentos' as const,                label: 'Medicamento',  bg: '#faf5ff', color: '#7c3aed', border: '#c4b5fd' },
]

function InfoMedicaChips({ cam }: { cam: CaminanteMesa }) {
  const items = INFO_MEDICA.filter(m => cam[m.key] && cam[m.key]!.trim() !== '')
  if (items.length === 0) return null
  return (
    <div style={{ marginTop: 7, display: 'flex', flexDirection: 'column', gap: 5 }}>
      {items.map(({ key, label, bg, color, border }) => (
        <div key={key} style={{
          display: 'flex', gap: 6, alignItems: 'flex-start',
          background: bg, border: `1px solid ${border}`,
          borderRadius: 8, padding: '5px 9px',
        }}>
          <span style={{
            fontSize: 9, fontWeight: 700, color, letterSpacing: 0.5,
            textTransform: 'uppercase', paddingTop: 1, flexShrink: 0,
            minWidth: 68,
          }}>
            {label}
          </span>
          <span style={{ fontSize: 12, color: '#374151', lineHeight: 1.4 }}>
            {cam[key]}
          </span>
        </div>
      ))}
    </div>
  )
}

interface Seguimiento {
  id?: string
  asignacion_mesa_id: string
  llamado: boolean
  contesto: boolean
}

export default function RetiroPage() {
  const [info, setInfo] = useState<ServidorInfo | null>(null)
  const [loading, setLoading] = useState(true)
  const [nombreServidor, setNombreServidor] = useState('')
  const [actualizado, setActualizado] = useState(false)
  const [camExpandido, setCamExpandido] = useState<string | null>(null)
  const [seguimientos, setSeguimientos] = useState<Record<string, Seguimiento>>({})

  const cargarDatos = useCallback(async (nombre: string) => {
    const [rolesRes, mesasRes] = await Promise.all([
      supabase
        .from('roles_retiro')
        .select('rol, categoria, encargados')
        .eq('retiro_id', RETIRO_ID)
        .order('orden'),
      supabase
        .from('mesas')
        .select('numero, adulto, lider, colider')
        .eq('retiro_id', RETIRO_ID)
        .order('numero'),
    ])

    const misRoles: RolRetiro[] = (rolesRes.data || []).filter(r =>
      nombreEnLista(nombre, r.encargados || [])
    )

    const todasMesas: MesaDB[] = mesasRes.data ?? []
    const mesaEncontrada = buscarMesaParaServidor(nombre, todasMesas)

    let caminantes: CaminanteMesa[] = []
    if (mesaEncontrada) {
      const mesaNum = mesaEncontrada.mesa.numero

      const { data: mesaRow } = await supabase
        .from('mesas')
        .select('id')
        .eq('retiro_id', RETIRO_ID)
        .eq('numero', mesaNum)
        .single()

      if (mesaRow) {
        const { data: asigData } = await supabase
          .from('asignaciones_mesa')
          .select('id, caminante_id, confirmado_por_lider')
          .eq('mesa_id', mesaRow.id)
          .eq('confirmado_por_lider', true)

        const asigMap: Record<string, string> = {}
        ;(asigData ?? []).forEach((a: any) => { asigMap[a.caminante_id] = a.id })
        const ids = (asigData ?? []).map((a: any) => a.caminante_id)

        if (ids.length > 0) {
          // ── CAMBIO: se agregan alergias, restricciones_alimentarias, medicamentos ──
          const { data: camData } = await supabase
            .from('caminantes')
            .select('id, nombre, celular, edad, es_sorpresa, alergias, restricciones_alimentarias, medicamentos')
            .in('id', ids)

          const camList = (camData ?? []) as (Omit<CaminanteMesa, 'asignacion_id' | 'contacto_emergencia'> & { asignacion_id?: string; contacto_emergencia?: ContactoEmergencia | null })[]

          const sorpresas = camList.filter(c => c.es_sorpresa)
          const contactosMap: Record<string, ContactoEmergencia> = {}

          for (const s of sorpresas) {
            const { data: contactos } = await supabase
              .from('contactos_emergencia')
              .select('nombre, parentesco, celular')
              .eq('persona_id', s.id)
              .eq('tipo_persona', 'caminante')
              .order('orden')
              .limit(1)

            if (contactos && contactos.length > 0) {
              contactosMap[s.id] = contactos[0]
            }
          }

          caminantes = camList.map(c => ({
            ...c,
            asignacion_id: asigMap[c.id] ?? '',
            contacto_emergencia: c.es_sorpresa ? (contactosMap[c.id] ?? null) : null,
          }))

          const { data: asigIds } = await supabase
            .from('asignaciones_mesa')
            .select('id')
            .eq('mesa_id', mesaRow.id)
            .eq('confirmado_por_lider', true)
          if (asigIds && asigIds.length > 0) {
            const { data: segData } = await supabase
              .from('seguimiento_caminantes')
              .select('id, asignacion_mesa_id, llamado, contesto')
              .in('asignacion_mesa_id', asigIds.map((a: any) => a.id))
            const segMap: Record<string, Seguimiento> = {}
            ;(segData ?? []).forEach((s: any) => { segMap[s.asignacion_mesa_id] = s })
            setSeguimientos(segMap)
          }
        }
      }
    }

    setInfo({
      roles: misRoles,
      mesa: mesaEncontrada?.mesa,
      esLiderDeMesa: mesaEncontrada?.esLider,
      caminantes,
    })
  }, [])

  useEffect(() => {
    const init = async () => {
      const { data: { session } } = await supabase.auth.getSession()
      if (!session) { setLoading(false); return }

      const userId = session.user.id
      const inscripcionId = session.user.user_metadata?.servidor_inscripcion_id

      let csvNombre = ''
      if (inscripcionId) {
        const { data: srv } = await supabase
          .from('servidores_inscripcion')
          .select('nombre')
          .eq('id', inscripcionId)
          .single()
        csvNombre = srv?.nombre ?? ''
      } else {
        const { data: srv } = await supabase
          .from('servidores_inscripcion')
          .select('nombre')
          .eq('usuario_id', userId)
          .eq('retiro_id', RETIRO_ID)
          .single()
        csvNombre = srv?.nombre ?? ''
      }

      if (!csvNombre) { setLoading(false); return }

      setNombreServidor(csvNombre)
      await cargarDatos(csvNombre)
      setLoading(false)
    }
    init()
  }, [cargarDatos])

  useEffect(() => {
    if (!nombreServidor) return

    const channel = supabase
      .channel('retiro-cambios')
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'mesas', filter: `retiro_id=eq.${RETIRO_ID}` }, () => {
        cargarDatos(nombreServidor)
        setActualizado(true)
        setTimeout(() => setActualizado(false), 3000)
      })
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'roles_retiro', filter: `retiro_id=eq.${RETIRO_ID}` }, () => {
        cargarDatos(nombreServidor)
        setActualizado(true)
        setTimeout(() => setActualizado(false), 3000)
      })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'asignaciones_mesa' }, () => {
        cargarDatos(nombreServidor)
        setActualizado(true)
        setTimeout(() => setActualizado(false), 3000)
      })
      .subscribe()

    return () => { supabase.removeChannel(channel) }
  }, [nombreServidor, cargarDatos])

  const toggleSeguimiento = async (asignacionMesaId: string, campo: 'llamado' | 'contesto') => {
    const actual = seguimientos[asignacionMesaId] ?? { llamado: false, contesto: false }
    const nuevo = { ...actual, [campo]: !actual[campo] }
    setSeguimientos(prev => ({ ...prev, [asignacionMesaId]: { ...nuevo, asignacion_mesa_id: asignacionMesaId } }))
    const { data: existing } = await supabase
      .from('seguimiento_caminantes')
      .select('id')
      .eq('asignacion_mesa_id', asignacionMesaId)
      .single()
    if (existing?.id) {
      await supabase.from('seguimiento_caminantes').update({ [campo]: nuevo[campo], updated_at: new Date().toISOString() }).eq('id', existing.id)
    } else {
      await supabase.from('seguimiento_caminantes').insert({ asignacion_mesa_id: asignacionMesaId, llamado: nuevo.llamado, contesto: nuevo.contesto })
    }
  }

  if (loading) {
    return (
      <div style={{ minHeight: '70vh', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <div style={{ textAlign: 'center' }}>
          <div style={{ width: 36, height: 36, border: '3px solid #e2e4f0', borderTopColor: '#0f1787', borderRadius: '50%', animation: 'spin 0.8s linear infinite', margin: '0 auto 12px' }} />
          <style>{`@keyframes spin { to { transform: rotate(360deg) } }`}</style>
          <p style={{ color: '#6b7280', fontSize: 14, margin: 0 }}>Cargando...</p>
        </div>
      </div>
    )
  }

  return (
    <div style={{ padding: '24px 16px 40px', maxWidth: 480, margin: '0 auto' }}>

      <div style={{ marginBottom: 24 }}>
        <h1 style={{ fontSize: 22, fontWeight: 700, color: '#0f1787', margin: '0 0 4px', fontFamily: 'Georgia, serif', letterSpacing: 1 }}>
          Mi Retiro
        </h1>
        <p style={{ fontSize: 13, color: '#9ca3af', margin: 0 }}>Retiro IX — Effetá Mazuren</p>
      </div>

      {actualizado && (
        <div style={{ background: '#f0fdf4', border: '1px solid #bbf7d0', borderRadius: 10, padding: '10px 14px', marginBottom: 14, fontSize: 13, color: '#16a34a', display: 'flex', alignItems: 'center', gap: 8 }}>
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#16a34a" strokeWidth={2.5} strokeLinecap="round" strokeLinejoin="round">
            <polyline points="20 6 9 17 4 12"/>
          </svg>
          Información actualizada
        </div>
      )}

      {/* ── MESA ── */}
      {info?.mesa && (
        <div style={{ background: 'linear-gradient(135deg, #0f1787 0%, #1e2fa8 100%)', borderRadius: 16, padding: '20px 22px', marginBottom: 14, color: 'white' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 14, marginBottom: 18 }}>
            <div style={{ width: 52, height: 52, flexShrink: 0, background: 'rgba(255,255,255,0.15)', borderRadius: 14, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <span style={{ fontSize: 24, fontWeight: 800, fontFamily: 'Georgia, serif' }}>{info.mesa.numero}</span>
            </div>
            <div>
              <p style={{ margin: '0 0 2px', fontSize: 11, color: 'rgba(255,255,255,0.55)', textTransform: 'uppercase', letterSpacing: 1 }}>
                {info.esLiderDeMesa ? 'Líder de Mesa' : 'Adulto Acompañante'}
              </p>
              <p style={{ margin: 0, fontSize: 19, fontWeight: 700 }}>Mesa {info.mesa.numero}</p>
            </div>
          </div>

          {info.mesa.adulto && (
            <div style={{ marginBottom: 14 }}>
              <p style={{ margin: '0 0 6px', fontSize: 11, color: 'rgba(255,255,255,0.55)', textTransform: 'uppercase', letterSpacing: 0.8 }}>Adulto acompañante</p>
              <div style={{ background: 'rgba(255,255,255,0.1)', borderRadius: 8, padding: '8px 12px', fontSize: 14, fontWeight: 600 }}>
                {info.mesa.adulto}
              </div>
            </div>
          )}

          <div>
            <p style={{ margin: '0 0 8px', fontSize: 11, color: 'rgba(255,255,255,0.55)', textTransform: 'uppercase', letterSpacing: 0.8 }}>Líderes de Mesa</p>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
              {[info.mesa.lider, info.mesa.colider].filter(Boolean).map((l, i) => (
                <div key={i} style={{ background: 'rgba(255,255,255,0.12)', borderRadius: 8, padding: '8px 12px', fontSize: 14, fontWeight: 500, display: 'flex', alignItems: 'center', gap: 8 }}>
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="rgba(255,255,255,0.6)" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
                    <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/>
                  </svg>
                  {l}
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* ── CAMINANTES DE LA MESA ── */}
      {info?.caminantes && info.caminantes.length > 0 && (
        <div style={{ background: 'white', borderRadius: 16, border: '0.5px solid #e8eaf0', padding: '20px 22px', marginBottom: 14 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 16 }}>
            <div style={{ width: 36, height: 36, background: '#fef3c7', borderRadius: 10, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#d97706" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
                <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/>
                <path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/>
              </svg>
            </div>
            <div>
              <p style={{ margin: 0, fontSize: 11, color: '#9ca3af', textTransform: 'uppercase', letterSpacing: 0.8 }}>Mis caminantes</p>
              <p style={{ margin: 0, fontSize: 15, fontWeight: 600, color: '#111827' }}>
                {info.caminantes.length} caminante{info.caminantes.length !== 1 ? 's' : ''} confirmado{info.caminantes.length !== 1 ? 's' : ''}
              </p>
            </div>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {info.caminantes.map((cam, i) => {
              const expandido = camExpandido === cam.id
              const tieneMedica = !!(cam.alergias || cam.restricciones_alimentarias || cam.medicamentos)
              return (
                <div key={cam.id} style={{
                  border: cam.es_sorpresa ? '1.5px solid #fca5a5' : '1px solid #f3f4f6',
                  borderRadius: 12,
                  overflow: 'hidden',
                  background: cam.es_sorpresa ? '#fff5f5' : '#fafafa',
                }}>
                  <button
                    onClick={() => setCamExpandido(expandido ? null : cam.id)}
                    style={{ width: '100%', display: 'flex', alignItems: 'flex-start', gap: 10, padding: '12px 14px', background: 'none', border: 'none', cursor: cam.es_sorpresa ? 'pointer' : 'default', textAlign: 'left' }}
                  >
                    <div style={{ width: 26, height: 26, borderRadius: 8, background: cam.es_sorpresa ? '#dc2626' : '#0f1787', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 12, fontWeight: 700, color: 'white', flexShrink: 0, marginTop: 1 }}>
                      {i + 1}
                    </div>

                    <div style={{ flex: 1 }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
                        <span style={{ fontSize: 13, fontWeight: 600, color: '#111827' }}>
                          {cam.nombre}
                        </span>
                        {cam.es_sorpresa && (
                          <span style={{ fontSize: 10, background: '#dc2626', color: 'white', padding: '1px 7px', borderRadius: 20, fontWeight: 700, letterSpacing: 0.5 }}>
                            SORPRESA
                          </span>
                        )}
                      </div>

                      {/* Edad + celular */}
                      <div style={{ fontSize: 11, color: '#9ca3af', marginTop: 2, display: 'flex', alignItems: 'center', gap: 4, flexWrap: 'wrap' }}>
                        {cam.edad ? `${cam.edad} años` : ''}
                        {!cam.es_sorpresa && cam.celular && (
                          <>
                            {cam.edad ? <span> · </span> : null}
                            <a href={`tel:${cam.celular}`} style={{ color: '#0f1787', fontWeight: 600, textDecoration: 'none', fontSize: 11 }}>
                              {cam.celular}
                            </a>
                          </>
                        )}
                      </div>

                      {/* Info médica — siempre visible si hay datos */}
                      {!cam.es_sorpresa && tieneMedica && (
                        <InfoMedicaChips cam={cam} />
                      )}

                      {/* Checkboxes llamado / contestó */}
                      {!cam.es_sorpresa && cam.asignacion_id && (
                        <div style={{ display: 'flex', gap: 6, marginTop: 8 }}>
                          {(['llamado', 'contesto'] as const).map(campo => {
                            const seg = seguimientos[cam.asignacion_id] ?? { llamado: false, contesto: false }
                            const activo = seg[campo]
                            const label = campo === 'llamado' ? 'Llamado' : 'Contestó'
                            return (
                              <button key={campo}
                                onClick={(ev) => { ev.stopPropagation(); toggleSeguimiento(cam.asignacion_id, campo) }}
                                style={{
                                  display: 'flex', alignItems: 'center', gap: 4,
                                  padding: '3px 8px', borderRadius: 20, border: 'none', cursor: 'pointer', fontSize: 10, fontWeight: 600,
                                  background: activo ? (campo === 'llamado' ? '#dcfce7' : '#eff6ff') : '#f3f4f6',
                                  color: activo ? (campo === 'llamado' ? '#16a34a' : '#0f1787') : '#6b7280',
                                }}
                              >
                                <div style={{ width: 10, height: 10, borderRadius: 3, flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'center',
                                  border: `1.5px solid ${activo ? (campo === 'llamado' ? '#16a34a' : '#0f1787') : '#9ca3af'}`,
                                  background: activo ? (campo === 'llamado' ? '#16a34a' : '#0f1787') : 'transparent',
                                }}>
                                  {activo && <svg width="7" height="7" viewBox="0 0 10 10"><polyline points="1.5,5 4,7.5 8.5,2" stroke="white" strokeWidth="1.5" fill="none" strokeLinecap="round"/></svg>}
                                </div>
                                {label}
                              </button>
                            )
                          })}
                        </div>
                      )}
                    </div>

                    {cam.es_sorpresa && (
                      <span style={{ fontSize: 11, color: '#dc2626', flexShrink: 0, paddingTop: 4 }}>{expandido ? '▲' : '▼'}</span>
                    )}
                  </button>

                  {/* ── DETALLE SORPRESA ── */}
                  {cam.es_sorpresa && expandido && (
                    <div style={{ padding: '0 14px 14px', borderTop: '1px solid #fca5a5' }}>
                      <p style={{ fontSize: 11, fontWeight: 700, color: '#dc2626', margin: '10px 0 6px', textTransform: 'uppercase', letterSpacing: 0.5 }}>
                        Caminante
                      </p>
                      <div style={{ background: 'white', borderRadius: 10, padding: '12px 14px', border: '1px solid #fca5a5', marginBottom: 10 }}>
                        <div style={{ fontSize: 13, fontWeight: 600, color: '#111827', marginBottom: 6 }}>
                          {cam.nombre}
                          {cam.edad ? <span style={{ fontSize: 11, color: '#6b7280', fontWeight: 400, marginLeft: 6 }}>{cam.edad} años</span> : null}
                        </div>
                        {cam.celular && (
                          <a
                            href={`tel:${cam.celular}`}
                            style={{ display: 'inline-flex', alignItems: 'center', gap: 6, fontSize: 13, color: '#0f1787', fontWeight: 600, textDecoration: 'none' }}
                          >
                            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="#0f1787" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
                              <path d="M22 16.92v3a2 2 0 01-2.18 2 19.79 19.79 0 01-8.63-3.07A19.5 19.5 0 013.07 9.81 19.79 19.79 0 01.01 1.18 2 2 0 012 0h3a2 2 0 012 1.72c.127.96.361 1.903.7 2.81a2 2 0 01-.45 2.11L6.09 7.91a16 16 0 006 6l1.27-1.27a2 2 0 012.11-.45c.907.339 1.85.573 2.81.7A2 2 0 0122 14.92v2z"/>
                            </svg>
                            {cam.celular}
                          </a>
                        )}
                        {/* Info médica dentro del panel sorpresa */}
                        {tieneMedica && <InfoMedicaChips cam={cam} />}
                      </div>

                      <p style={{ fontSize: 11, fontWeight: 700, color: '#dc2626', margin: '0 0 6px', textTransform: 'uppercase', letterSpacing: 0.5 }}>
                        Contacto para coordinar llegada
                      </p>
                      {cam.contacto_emergencia ? (
                        <div style={{ background: 'white', borderRadius: 10, padding: '12px 14px', border: '1px solid #fca5a5' }}>
                          <div style={{ fontSize: 13, fontWeight: 600, color: '#111827', marginBottom: 4 }}>
                            {cam.contacto_emergencia.nombre}
                            {cam.contacto_emergencia.parentesco && (
                              <span style={{ fontSize: 11, color: '#6b7280', fontWeight: 400, marginLeft: 6 }}>({cam.contacto_emergencia.parentesco})</span>
                            )}
                          </div>
                          {cam.contacto_emergencia.celular && (
                            <button
                              onClick={() => window.open(`https://wa.me/57${cam.contacto_emergencia!.celular!.replace(/\D/g, '')}`, '_blank')}
                              style={{ display: 'flex', alignItems: 'center', gap: 6, background: '#25d366', color: 'white', border: 'none', borderRadius: 8, padding: '8px 12px', fontSize: 13, fontWeight: 600, cursor: 'pointer', marginTop: 6 }}
                            >
                              <svg width="14" height="14" viewBox="0 0 24 24" fill="white">
                                <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z"/>
                              </svg>
                              {cam.contacto_emergencia.celular}
                            </button>
                          )}
                        </div>
                      ) : (
                        <p style={{ fontSize: 12, color: '#9ca3af', margin: 0 }}>Sin contacto registrado</p>
                      )}

                      <p style={{ fontSize: 11, color: '#dc2626', margin: '10px 0 0', lineHeight: 1.5 }}>
                        Este caminante no sabe que viene al retiro. Coordina la llegada con su contacto sin revelar el destino.
                      </p>
                    </div>
                  )}
                </div>
              )
            })}
          </div>
        </div>
      )}

      {info?.mesa && info.esLiderDeMesa && info.caminantes.length === 0 && (
        <div style={{ background: 'white', borderRadius: 16, border: '0.5px solid #e8eaf0', padding: '20px 22px', marginBottom: 14, textAlign: 'center' }}>
          <p style={{ fontSize: 13, color: '#9ca3af', margin: 0 }}>
            Los líderes aún no han confirmado la asignación de caminantes para tu mesa.
          </p>
        </div>
      )}

      {/* ── ROLES ── */}
      {info && info.roles.length > 0 && (
        <div style={{ background: 'white', borderRadius: 16, border: '0.5px solid #e8eaf0', padding: '20px 22px', marginBottom: 14 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 16 }}>
            <div style={{ width: 36, height: 36, background: '#eef0fb', borderRadius: 10, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#0f1787" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
                <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/>
              </svg>
            </div>
            <div>
              <p style={{ margin: 0, fontSize: 11, color: '#9ca3af', textTransform: 'uppercase', letterSpacing: 0.8 }}>Mis roles</p>
              <p style={{ margin: 0, fontSize: 15, fontWeight: 600, color: '#111827' }}>
                {info.roles.length} {info.roles.length === 1 ? 'rol asignado' : 'roles asignados'}
              </p>
            </div>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 7 }}>
            {info.roles.map((r, i) => {
              const c = getColor(r.rol)
              return (
                <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '10px 14px', background: c.bg, borderRadius: 10 }}>
                  <div style={{ width: 8, height: 8, borderRadius: '50%', background: c.dot, flexShrink: 0 }} />
                  <div style={{ flex: 1 }}>
                    <span style={{ fontSize: 14, fontWeight: 500, color: c.text, lineHeight: 1.3 }}>{r.rol}</span>
                    {r.categoria && (
                      <span style={{ fontSize: 11, color: c.dot, marginLeft: 8, opacity: 0.7 }}>{r.categoria}</span>
                    )}
                  </div>
                </div>
              )
            })}
          </div>
        </div>
      )}

      {(!info || (info.roles.length === 0 && !info.mesa)) && (
        <div style={{ background: 'white', borderRadius: 16, border: '0.5px solid #e8eaf0', padding: '32px 24px', textAlign: 'center', marginBottom: 14 }}>
          <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="#d1d5db" strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round" style={{ margin: '0 auto 14px', display: 'block' }}>
            <circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/>
          </svg>
          <p style={{ color: '#6b7280', fontSize: 14, margin: 0, lineHeight: 1.7 }}>
            Aún no tienes roles ni mesa asignados.<br />Pronto los líderes los configurarán.
          </p>
        </div>
      )}

      <div style={{ background: 'white', borderRadius: 16, border: '0.5px solid #e8eaf0', padding: '18px 22px' }}>
        <p style={{ margin: '0 0 12px', fontSize: 11, color: '#9ca3af', textTransform: 'uppercase', letterSpacing: 0.8, fontWeight: 600 }}>Información del retiro</p>
        {[
          { label: 'Retiro', value: 'IX Effetá Mazuren' },
          { label: 'Comunidad', value: 'Mazuren, Bogotá' },
          { label: 'Carácter', value: 'Servidor' },
        ].map((item, i) => (
          <div key={i} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', paddingBottom: i < 2 ? 10 : 0, marginBottom: i < 2 ? 10 : 0, borderBottom: i < 2 ? '0.5px solid #f3f4f6' : 'none' }}>
            <span style={{ fontSize: 13, color: '#6b7280' }}>{item.label}</span>
            <span style={{ fontSize: 13, fontWeight: 600, color: '#111827' }}>{item.value}</span>
          </div>
        ))}
      </div>

    </div>
  )
}
