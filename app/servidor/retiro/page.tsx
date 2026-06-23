'use client'

import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'

interface RolRetiro {
  rol: string
  categoria: string
  encargados: string[]
}

interface ServidorInfo {
  roles: RolRetiro[]
  mesa?: number
  esLiderDeMesa?: boolean
}

const MESAS: Record<number, { adulto: string; lideres: string[] }> = {
  1:  { adulto: 'Meliii',   lideres: ['Santiago Ruiz', 'Isabella Moncada'] },
  2:  { adulto: 'Diego',    lideres: ['David Sarmiento', 'Laura Camacho'] },
  3:  { adulto: 'Richy',    lideres: ['Juan Pablo León', 'Valery Cardona'] },
  4:  { adulto: 'Vichita',  lideres: ['Paula Sofía Ortiz', 'Judith Neira'] },
  5:  { adulto: 'Angelita', lideres: ['Natalia Cupitra', 'Eddy Carvajal'] },
  6:  { adulto: 'Jorge',    lideres: ['Santiago Castañeda', 'Laura Ramírez'] },
  7:  { adulto: 'Meli',     lideres: ['Mariana Serrano', 'Andres Noel'] },
  8:  { adulto: 'Diego',    lideres: ['Natalia Linares', 'Daniel Villabón'] },
  9:  { adulto: 'Rich',     lideres: ['Juan Pablo Cardona', 'Carolina Bucheli'] },
  10: { adulto: 'Vichita',  lideres: ['Juan Pablo Bedoya', 'Maria Alejandra Sierra'] },
}

const MESA_POR_NOMBRE: Record<string, { mesa: number; esLider: boolean }> = {
  'Isabella Moncada Cardozo':          { mesa: 1,  esLider: true },
  'Laura Camacho':                     { mesa: 2,  esLider: true },
  'Juan Pablo Leon Samper':            { mesa: 3,  esLider: true },
  'Valery Cardona Muñoz':              { mesa: 3,  esLider: true },
  'Paula Sofía Ortiz Mahecha':         { mesa: 4,  esLider: true },
  'Judith Neira':                      { mesa: 4,  esLider: true },
  'Natalia Isabel Cupitra Carmona':    { mesa: 5,  esLider: true },
  'Eddy Carvajal':                     { mesa: 5,  esLider: true },
  'Angela Rocio Chaparro Vargas':      { mesa: 5,  esLider: true },
  'Angela Maria Picón Chaparro':       { mesa: 6,  esLider: true },
  'Santiago Castañeda Carreño':        { mesa: 6,  esLider: true },
  'Laura Ramírez':                     { mesa: 6,  esLider: true },
  'Mariana Serrano Pérez':             { mesa: 7,  esLider: true },
  'Andres David Noel Mulett':          { mesa: 7,  esLider: true },
  'Natalia Linares Sandoval':          { mesa: 8,  esLider: true },
  'Daniel Steeven Chaparro Villabón':  { mesa: 8,  esLider: true },
  'Carolina Bucheli':                  { mesa: 9,  esLider: true },
  'Juan Pablo Cardona Muñoz':          { mesa: 9,  esLider: true },
  'Maria Alejandra Sierra Cabezas':    { mesa: 9,  esLider: true },
  'Juan Pablo Bedoya':                 { mesa: 10, esLider: true },
  'Santiago Ruiz Cardozo':             { mesa: 1,  esLider: true },
  'David Fernando Sarmiento Grisales': { mesa: 2,  esLider: true },
  'Ricardo Torres Sabogal':            { mesa: 3,  esLider: false },
  'Jorge Picón Gaitán':                { mesa: 6,  esLider: false },
  'Diego Urrego Fonseca':              { mesa: 2,  esLider: true },
  'Juan Pablo Leon Samper':            { mesa: 3,  esLider: true },
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

function norm(s: string) {
  return s.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').trim()
}

function nombreEnLista(nombreServidor: string, encargados: string[]): boolean {
  const normServidor = norm(nombreServidor)
  const tokensServidor = normServidor.split(' ').filter(t => t.length > 2)

  for (const enc of encargados) {
    const normEnc = norm(enc)
    // Match exacto normalizado
    if (normEnc === normServidor) return true
    // Match por tokens (mínimo 2 tokens coinciden)
    const tokensEnc = normEnc.split(' ').filter(t => t.length > 2)
    const coincidencias = tokensServidor.filter(t => tokensEnc.includes(t)).length
    if (coincidencias >= 2) return true
    // Match apellido + primer nombre
    if (tokensServidor.length > 0 && tokensEnc.length > 0) {
      if (tokensEnc.includes(tokensServidor[0]) && tokensEnc.includes(tokensServidor[tokensServidor.length - 1])) return true
    }
  }
  return false
}

export default function RetiroPage() {
  const [info, setInfo] = useState<ServidorInfo | null>(null)
  const [loading, setLoading] = useState(true)
  const [nombreServidor, setNombreServidor] = useState('')

  useEffect(() => {
    const load = async () => {
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
          .eq('retiro_id', '21da7588-f7d9-4bf8-a6f6-ae6c8258c00e')
          .single()
        csvNombre = srv?.nombre ?? ''
      }

      if (!csvNombre) { setLoading(false); return }
      setNombreServidor(csvNombre)

      // Cargar roles desde Supabase
      const { data: rolesData } = await supabase
        .from('roles_retiro')
        .select('rol, categoria, encargados')
        .eq('retiro_id', '21da7588-f7d9-4bf8-a6f6-ae6c8258c00e')
        .order('orden')

      const misRoles: RolRetiro[] = (rolesData || []).filter(r =>
        nombreEnLista(csvNombre, r.encargados || [])
      )

      // Mesa desde hardcode
      const mesaInfo = MESA_POR_NOMBRE[csvNombre]

      setInfo({
        roles: misRoles,
        mesa: mesaInfo?.mesa,
        esLiderDeMesa: mesaInfo?.esLider,
      })

      setLoading(false)
    }
    load()
  }, [])

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

  const mesaData = info?.mesa ? MESAS[info.mesa] : null

  return (
    <div style={{ padding: '24px 16px 40px', maxWidth: 480, margin: '0 auto' }}>

      <div style={{ marginBottom: 24 }}>
        <h1 style={{ fontSize: 22, fontWeight: 700, color: '#0f1787', margin: '0 0 4px', fontFamily: 'Georgia, serif', letterSpacing: 1 }}>
          Mi Retiro
        </h1>
        <p style={{ fontSize: 13, color: '#9ca3af', margin: 0 }}>Retiro IX — Effetá Mazuren</p>
      </div>

      {(!info || info.roles.length === 0) && (
        <div style={{ background: 'white', borderRadius: 16, border: '0.5px solid #e8eaf0', padding: '32px 24px', textAlign: 'center' }}>
          <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="#d1d5db" strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round" style={{ margin: '0 auto 14px', display: 'block' }}>
            <circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/>
          </svg>
          <p style={{ color: '#6b7280', fontSize: 14, margin: 0, lineHeight: 1.7 }}>
            Aún no tienes roles asignados.<br />Pronto los líderes los configurarán.
          </p>
        </div>
      )}

      {info?.mesa && mesaData && (
        <div style={{ background: 'linear-gradient(135deg, #0f1787 0%, #1e2fa8 100%)', borderRadius: 16, padding: '20px 22px', marginBottom: 14, color: 'white' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 14, marginBottom: 18 }}>
            <div style={{ width: 52, height: 52, flexShrink: 0, background: 'rgba(255,255,255,0.15)', borderRadius: 14, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <span style={{ fontSize: 24, fontWeight: 800, fontFamily: 'Georgia, serif' }}>{info.mesa}</span>
            </div>
            <div>
              <p style={{ margin: '0 0 2px', fontSize: 11, color: 'rgba(255,255,255,0.55)', textTransform: 'uppercase', letterSpacing: 1 }}>
                {info.esLiderDeMesa ? 'Líder de Mesa' : 'Mi Mesa'}
              </p>
              <p style={{ margin: 0, fontSize: 19, fontWeight: 700 }}>Mesa {info.mesa}</p>
            </div>
          </div>
          <div style={{ marginBottom: 14 }}>
            <p style={{ margin: '0 0 6px', fontSize: 11, color: 'rgba(255,255,255,0.55)', textTransform: 'uppercase', letterSpacing: 0.8 }}>Adulto acompañante</p>
            <div style={{ background: 'rgba(255,255,255,0.1)', borderRadius: 8, padding: '8px 12px', fontSize: 14, fontWeight: 600 }}>{mesaData.adulto}</div>
          </div>
          <div>
            <p style={{ margin: '0 0 8px', fontSize: 11, color: 'rgba(255,255,255,0.55)', textTransform: 'uppercase', letterSpacing: 0.8 }}>Líderes de Mesa</p>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
              {mesaData.lideres.map((l, i) => (
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
