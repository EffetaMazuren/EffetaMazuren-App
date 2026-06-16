'use client'

import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'

// ─── TIPOS ────────────────────────────────────────────────────────────────

interface ServidorInfo {
  roles: string[]
  mesa?: number
  esLiderDeMesa?: boolean
}

// ─── MAPA DE ROLES POR NOMBRE (coincide con columna "nombre" del CSV) ─────
// Claves: nombres EXACTOS del CSV. Si hay variación menor, el fuzzy matching lo resuelve al final.

const ROLES_POR_NOMBRE: Record<string, ServidorInfo> = {
  // ── MÚSICA ──
  'Mariana Rodríguez Zúñiga':        { roles: ['Música', '¿Por qué oramos cantando?'] },
  'Daniela Alcázar':                  { roles: ['Música', 'Rosario Domingo'] },

  // ── PALANCAS ──
  'Lucía Cuéllar':                    { roles: ['Palancas', 'Rosario Domingo'] },
  'David Martinez Rincon':            { roles: ['Palancas', 'Maleteros'] },
  'María Paula Rodríguez Zúñiga':     { roles: ['Palancas', 'Despertar Caminantes'] },
  'Paula Agudelo':                    { roles: ['Palancas', 'Rosario Domingo'] },

  // ── SNACKS ──
  'Allison Valeria Torres Rodriguez': { roles: ['Snacks', 'Lobby'] },
  'Catalina Ocampo':                  { roles: ['Snacks', 'Lobby', 'Cartas de Jesús'] },
  'Mariana Isabella Quintero Rincón': { roles: ['Snacks', 'Despertar Caminantes'] },
  'Valentina Mirque Lucio':           { roles: ['Snacks', 'Despertar Caminantes', 'Palancas a Rumba'] },

  // ── PASTILLERO / ORACIÓN DOMINGO ──
  'Angela Rocio Chaparro Vargas':     { roles: ['Pastillero', 'Oración Domingo', 'Acomodar en paredes'], mesa: 5, esLiderDeMesa: true },

  // ── BENDICIÓN DE ALIMENTOS ──
  'Andrés Muñoz':                     { roles: ['Bendición de alimentos', 'Lobby'] },
  'Angela Maria Picón Chaparro':      { roles: ['Bendición de alimentos', 'Rosario Sábado', 'Acomodar en paredes'], mesa: 6, esLiderDeMesa: true },
  'María Camila Cardenas Cuello':     { roles: ['Bendición de alimentos', 'Despertar Caminantes'] },
  'Natalia Isabel Cupitra Carmona':   { roles: ['Bendición de alimentos', 'Despertar Caminantes'], mesa: 5, esLiderDeMesa: true },
  'Ana María Jaramillo':              { roles: ['Bendición de alimentos', 'Lobby'] },

  // ── SANTÍSIMO / TURNOS ──
  'Natalia Jaramillo Benavides':      { roles: ['Explicación Santísimo', 'Santísimo', 'Turnos Santísimo y Angelitos'] },
  'Gabriela Ramírez':                 { roles: ['Santísimo', 'Turnos Santísimo y Angelitos', 'Despertar Caminantes'] },
  'Isabella Moncada Cardozo':         { roles: ['Santísimo', 'Explicación Palanquitas', 'Bienvenida', 'Recepción de Rumba', 'Acomodar en paredes'], mesa: 1, esLiderDeMesa: true },
  'Laura Camacho':                    { roles: ['Santísimo', 'Rosario Sábado', 'Pared a Confesiones', 'Acomodar en paredes'], mesa: 2, esLiderDeMesa: true },

  // ── GUACHAFITA ──
  'Juan Pablo Bedoya':                { roles: ['Guachafita', 'Maleteros', 'Recepción de Rumba', 'Acomodar en paredes'], mesa: 10, esLiderDeMesa: true },
  'Eddy Carvajal':                    { roles: ['Guachafita', 'Maleteros', 'Recepción de Rumba', 'Acomodar en paredes'], mesa: 5, esLiderDeMesa: true },
  'Andres David Noel Mulett':         { roles: ['Guachafita', 'Bienvenida', 'Recepción de Rumba', 'Acomodar en paredes'], mesa: 7, esLiderDeMesa: true },

  // ── BIENVENIDA / LOBBY / RECEPCIÓN ──
  'Carolina Bucheli':                 { roles: ['Bienvenida', 'Máscaras', 'Confesiones a Palancas'], mesa: 9, esLiderDeMesa: true },
  'Mariana Serrano Pérez':            { roles: ['Bienvenida', 'Máscaras', 'Recepción de Rumba', 'Acomodar en paredes'], mesa: 7, esLiderDeMesa: true },
  'Paula Sofía Ortiz Mahecha':        { roles: ['Bienvenida', 'Máscaras', 'Confesiones a Palancas', 'Acomodar en paredes'], mesa: 4, esLiderDeMesa: true },
  'Santiago Ruiz Cardozo':            { roles: ['Bienvenida', 'Lobby', 'Confesiones a Palancas', 'Acomodar en paredes'], mesa: 1, esLiderDeMesa: true },
  'Juan Pablo Leon Samper':           { roles: ['Bienvenida', 'Pared a Confesiones', 'Máscaras', 'Acomodar en paredes'], mesa: 3, esLiderDeMesa: true },

  'Valery Cardona Muñoz':             { roles: ['Recepción', 'Rosario Sábado', 'Palancas a Rumba', 'Acomodar en paredes'], mesa: 3, esLiderDeMesa: true },
  'Natalia Linares Sandoval':         { roles: ['Recepción', 'Máscaras', 'Palancas a Rumba', 'Acomodar en paredes'], mesa: 8, esLiderDeMesa: true },
  'Maria Alejandra Sierra Cabezas':   { roles: ['Recepción', 'Sanando mi Alma', 'Confesiones a Palancas', 'Acomodar en paredes'], mesa: 9, esLiderDeMesa: true },
  'Daniel Steeven Chaparro Villabón': { roles: ['Recepción', 'Máscaras', 'Acomodar en paredes'], mesa: 8, esLiderDeMesa: true },

  'Santiago Rodriguez Buitrago':      { roles: ['Lobby', 'Oración Sábado', 'Pared a Confesiones'] },
  'David Fernando Sarmiento Grisales':{ roles: ['Lobby', 'Pared a Confesiones', 'Palancas a Rumba', 'Acomodar en paredes'], mesa: 2, esLiderDeMesa: true },

  // ── MALETEROS ──
  'Santiago Castañeda Carreño':       { roles: ['Maleteros', 'Máscaras', 'Acomodar en paredes'], mesa: 6, esLiderDeMesa: true },
  'Juan Jose Álvarez Romero':         { roles: ['Maleteros', 'Cartas de Jesús', 'Sanando mi Alma'] },

  // ── RESUMEN ──
  'Diego Urrego Fonseca':             { roles: ['Resumen Viernes', 'Acomodar en paredes'], mesa: 2, esLiderDeMesa: true },
  'Judith Neira':                     { roles: ['Resumen Sábado', 'Acomodar en paredes'], mesa: 4, esLiderDeMesa: true },

  // ── CARTAS DE JESÚS ──
  'María Paula Tenorio':              { roles: ['Cartas de Jesús', 'Pared a Confesiones'] },

  // ── MÁSCARAS / MURO ──
  'Laura Ramírez':                    { roles: ['Máscaras', 'Confesiones a Palancas', 'Palancas a Rumba', 'Acomodar en paredes'], mesa: 6, esLiderDeMesa: true },

  // ── PARED CONFESIONES ──
  'Juan Pablo Cardona Muñoz':         { roles: ['Pared a Confesiones', 'Recepción de Rumba', 'Acomodar en paredes'], mesa: 9, esLiderDeMesa: true },

  // ── ADULTOS LÍDERES (con cuenta de servidor) ──
  'Ricardo Torres Sabogal':           { roles: ['Acomodar en paredes'], mesa: 3, esLiderDeMesa: false },
  'Jorge Picón Gaitán':               { roles: ['Acomodar en paredes'], mesa: 6, esLiderDeMesa: false },

  // ── ORGANIZADORAS ──
  'Antonia Rivera':                   { roles: ['Acomodar en paredes'] },
  'Daniel Cuellar':                   { roles: ['Acomodar en paredes'] },
}

// ─── MESAS ────────────────────────────────────────────────────────────────

const MESAS: Record<number, { adulto: string; lideres: string[] }> = {
  1:  { adulto: 'Meliii',   lideres: ['Santiago Ruiz', 'Isabella Moncada'] },
  2:  { adulto: 'Diego',    lideres: ['David Sarmiento', 'Laura Camacho'] },
  3:  { adulto: 'Richy',    lideres: ['Juan Pablo León', 'Valery Cardona'] },
  4:  { adulto: 'Vichita',  lideres: ['Santiago Rodríguez', 'Paula Sofía Ortiz'] },
  5:  { adulto: 'Angelita', lideres: ['Natalia Cupitra', 'Eddy Carvajal'] },
  6:  { adulto: 'Jorge',    lideres: ['Santiago Castañeda', 'Laura Ramírez'] },
  7:  { adulto: 'Meli',     lideres: ['Mariana Serrano', 'Andres Noel'] },
  8:  { adulto: 'Diego',    lideres: ['Natalia Linares', 'Daniel Villabón'] },
  9:  { adulto: 'Rich',     lideres: ['Juan Pablo Cardona', 'Carolina Bucheli'] },
  10: { adulto: 'Vichita',  lideres: ['Juan Pablo Bedoya', 'Maria Alejandra Sierra'] },
}

// ─── COLORES POR ROL ─────────────────────────────────────────────────────

const COLOR_ROL: Record<string, { bg: string; dot: string; text: string }> = {
  'Música':                       { bg: '#ede9fe', dot: '#7c3aed', text: '#5b21b6' },
  '¿Por qué oramos cantando?':    { bg: '#ede9fe', dot: '#7c3aed', text: '#5b21b6' },
  'Palancas':                     { bg: '#fce7f3', dot: '#db2777', text: '#9d174d' },
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

// ─── FUZZY MATCH (fallback) ───────────────────────────────────────────────

function norm(s: string) {
  return s.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[^a-z0-9 ]/g, '')
}

function findServidorInfo(csvNombre: string): ServidorInfo | null {
  // 1. Exact match
  if (ROLES_POR_NOMBRE[csvNombre]) return ROLES_POR_NOMBRE[csvNombre]

  // 2. Fuzzy match by token overlap
  const tokens = norm(csvNombre).split(' ').filter(t => t.length > 2)
  let best: { info: ServidorInfo; score: number } | null = null

  for (const [key, info] of Object.entries(ROLES_POR_NOMBRE)) {
    const keyTokens = norm(key).split(' ').filter(t => t.length > 2)
    const matches = tokens.filter(t => keyTokens.includes(t)).length
    if (matches >= 2 && (!best || matches > best.score)) {
      best = { info, score: matches }
    }
  }
  return best?.info ?? null
}

// ─── PÁGINA ───────────────────────────────────────────────────────────────

export default function RetiroPage() {
  const [info, setInfo] = useState<ServidorInfo | null>(null)
  const [loading, setLoading] = useState(true)

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

      if (csvNombre) {
        const found = findServidorInfo(csvNombre)
        setInfo(found)
      }
      setLoading(false)
    }
    load()
  }, [])

  if (loading) {
    return (
      <div style={{ minHeight: '70vh', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <div style={{ textAlign: 'center' }}>
          <div style={{
            width: 36, height: 36,
            border: '3px solid #e2e4f0', borderTopColor: '#0f1787',
            borderRadius: '50%', animation: 'spin 0.8s linear infinite',
            margin: '0 auto 12px'
          }} />
          <style>{`@keyframes spin { to { transform: rotate(360deg) } }`}</style>
          <p style={{ color: '#6b7280', fontSize: 14, margin: 0 }}>Cargando...</p>
        </div>
      </div>
    )
  }

  const mesaData = info?.mesa ? MESAS[info.mesa] : null

  return (
    <div style={{ padding: '24px 16px 40px', maxWidth: 480, margin: '0 auto' }}>

      {/* Header */}
      <div style={{ marginBottom: 24 }}>
        <h1 style={{
          fontSize: 22, fontWeight: 700, color: '#0f1787', margin: '0 0 4px',
          fontFamily: 'Georgia, serif', letterSpacing: 1
        }}>
          Mi Retiro
        </h1>
        <p style={{ fontSize: 13, color: '#9ca3af', margin: 0 }}>
          Retiro IX — Effetá Mazuren
        </p>
      </div>

      {/* Sin roles */}
      {!info && (
        <div style={{
          background: 'white', borderRadius: 16, border: '0.5px solid #e8eaf0',
          padding: '32px 24px', textAlign: 'center'
        }}>
          <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="#d1d5db" strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round" style={{ margin: '0 auto 14px', display: 'block' }}>
            <circle cx="12" cy="12" r="10"/>
            <line x1="12" y1="8" x2="12" y2="12"/>
            <line x1="12" y1="16" x2="12.01" y2="16"/>
          </svg>
          <p style={{ color: '#6b7280', fontSize: 14, margin: 0, lineHeight: 1.7 }}>
            Aún no tienes roles asignados.<br />
            Pronto los líderes los configurarán.
          </p>
        </div>
      )}

      {/* Card Mesa */}
      {info?.mesa && mesaData && (
        <div style={{
          background: 'linear-gradient(135deg, #0f1787 0%, #1e2fa8 100%)',
          borderRadius: 16, padding: '20px 22px', marginBottom: 14, color: 'white'
        }}>

          {/* Número + título */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 14, marginBottom: 18 }}>
            <div style={{
              width: 52, height: 52, flexShrink: 0,
              background: 'rgba(255,255,255,0.15)', borderRadius: 14,
              display: 'flex', alignItems: 'center', justifyContent: 'center'
            }}>
              <span style={{ fontSize: 24, fontWeight: 800, fontFamily: 'Georgia, serif' }}>
                {info.mesa}
              </span>
            </div>
            <div>
              <p style={{ margin: '0 0 2px', fontSize: 11, color: 'rgba(255,255,255,0.55)', textTransform: 'uppercase', letterSpacing: 1 }}>
                {info.esLiderDeMesa ? 'Líder de Mesa' : 'Mi Mesa'}
              </p>
              <p style={{ margin: 0, fontSize: 19, fontWeight: 700 }}>Mesa {info.mesa}</p>
            </div>
          </div>

          {/* Adulto */}
          <div style={{ marginBottom: 14 }}>
            <p style={{ margin: '0 0 6px', fontSize: 11, color: 'rgba(255,255,255,0.55)', textTransform: 'uppercase', letterSpacing: 0.8 }}>
              Adulto acompañante
            </p>
            <div style={{
              background: 'rgba(255,255,255,0.1)',
              borderRadius: 8, padding: '8px 12px',
              fontSize: 14, fontWeight: 600
            }}>
              {mesaData.adulto}
            </div>
          </div>

          {/* Líderes */}
          <div>
            <p style={{ margin: '0 0 8px', fontSize: 11, color: 'rgba(255,255,255,0.55)', textTransform: 'uppercase', letterSpacing: 0.8 }}>
              Líderes de Mesa
            </p>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
              {mesaData.lideres.map((l, i) => (
                <div key={i} style={{
                  background: 'rgba(255,255,255,0.12)',
                  borderRadius: 8, padding: '8px 12px',
                  fontSize: 14, fontWeight: 500,
                  display: 'flex', alignItems: 'center', gap: 8
                }}>
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="rgba(255,255,255,0.6)" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
                    <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/>
                    <circle cx="12" cy="7" r="4"/>
                  </svg>
                  {l}
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Card Roles */}
      {info && info.roles.length > 0 && (
        <div style={{
          background: 'white', borderRadius: 16, border: '0.5px solid #e8eaf0',
          padding: '20px 22px', marginBottom: 14
        }}>

          {/* Header card */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 16 }}>
            <div style={{
              width: 36, height: 36, background: '#eef0fb',
              borderRadius: 10, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0
            }}>
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#0f1787" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
                <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/>
              </svg>
            </div>
            <div>
              <p style={{ margin: 0, fontSize: 11, color: '#9ca3af', textTransform: 'uppercase', letterSpacing: 0.8 }}>
                Mis roles
              </p>
              <p style={{ margin: 0, fontSize: 15, fontWeight: 600, color: '#111827' }}>
                {info.roles.length} {info.roles.length === 1 ? 'rol asignado' : 'roles asignados'}
              </p>
            </div>
          </div>

          {/* Lista de roles */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 7 }}>
            {info.roles.map((rol, i) => {
              const c = getColor(rol)
              return (
                <div key={i} style={{
                  display: 'flex', alignItems: 'center', gap: 10,
                  padding: '10px 14px',
                  background: c.bg, borderRadius: 10,
                }}>
                  <div style={{
                    width: 8, height: 8, borderRadius: '50%',
                    background: c.dot, flexShrink: 0
                  }} />
                  <span style={{ fontSize: 14, fontWeight: 500, color: c.text, lineHeight: 1.3 }}>
                    {rol}
                  </span>
                </div>
              )
            })}
          </div>
        </div>
      )}

      {/* Card info general */}
      <div style={{
        background: 'white', borderRadius: 16, border: '0.5px solid #e8eaf0',
        padding: '18px 22px'
      }}>
        <p style={{ margin: '0 0 12px', fontSize: 11, color: '#9ca3af', textTransform: 'uppercase', letterSpacing: 0.8, fontWeight: 600 }}>
          Información del retiro
        </p>
        {[
          { label: 'Retiro', value: 'IX Effetá Mazuren' },
          { label: 'Comunidad', value: 'Mazuren, Bogotá' },
          { label: 'Carácter', value: 'Servidor' },
        ].map((item, i) => (
          <div key={i} style={{
            display: 'flex', justifyContent: 'space-between', alignItems: 'center',
            paddingBottom: i < 2 ? 10 : 0,
            marginBottom: i < 2 ? 10 : 0,
            borderBottom: i < 2 ? '0.5px solid #f3f4f6' : 'none'
          }}>
            <span style={{ fontSize: 13, color: '#6b7280' }}>{item.label}</span>
            <span style={{ fontSize: 13, fontWeight: 600, color: '#111827' }}>{item.value}</span>
          </div>
        ))}
      </div>

    </div>
  )
}
