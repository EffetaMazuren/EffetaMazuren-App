'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'

const RETIRO_ID = '21da7588-f7d9-4bf8-a6f6-ae6c8258c00e'

type Tab = 'minutominuto' | 'roles' | 'manual'
type Dia = 'viernes' | 'sabado' | 'domingo'

interface RolRetiro {
  id: string
  categoria: string
  rol: string
  encargados: string[]
  orden: number
}

interface Actividad {
  hora: string
  actividad: string
  encargado: string
  detalle?: string
  tipo?: 'charla' | 'actividad' | 'comida' | 'logistica' | 'espiritual'
}

const MINUTO_MINUTO: Record<Dia, { bloques: { titulo: string; camiseta?: string; items: Actividad[] }[] }> = {
  viernes: {
    bloques: [
      {
        titulo: 'Pre-retiro',
        items: [
          { hora: '9:30 AM', actividad: 'Llegada a la casa de retiros', encargado: 'Equipo de servidores', tipo: 'logistica' },
          { hora: '10:00 AM', actividad: 'Primera reunión de coordinación', encargado: 'Líder joven y adulto de logística', detalle: 'Colgar cuadro de equipos y minuto a minuto. Colgar pendones en salón de conferencias. Organizar salón de logística con materiales separados por día y cuarto de palancas.', tipo: 'logistica' },
          { hora: '11:00 AM', actividad: 'Equipos se dividen para organizar la casa', encargado: 'Cada equipo asignado', detalle: 'Llevar parlantes pequeños para sonido permanente en el Santísimo.', tipo: 'logistica' },
          { hora: '12:00 PM', actividad: 'Almuerzo', encargado: 'Todos los servidores', tipo: 'comida' },
          { hora: '1:00 PM', actividad: 'Revisión actividad Camino de la Vida', encargado: 'Equipo camino de la vida', detalle: 'Revisar terreno y dónde se enredarán las cuerdas.', tipo: 'actividad' },
          { hora: '1:00 PM', actividad: 'Alistar mesas de llegada', encargado: 'Equipo de recepción', detalle: 'Dos mesas: hombres y mujeres. Escarapelas listas, bolsas ziploc con etiquetas para celulares y relojes. Lista de caminantes lista.', tipo: 'logistica' },
          { hora: '1:15 PM', actividad: 'Llamar a caminantes', encargado: 'Servidores de mesa', detalle: 'Última bienvenida, resolver dudas y recordarles invitar familia el domingo a la misa.', tipo: 'logistica' },
          { hora: '2:30 PM', actividad: 'Confesiones del sacerdote', encargado: 'Sacerdote', tipo: 'espiritual' },
          { hora: '3:30 PM', actividad: 'Exposición del Santísimo', encargado: 'Sacerdote / Ministro', detalle: 'Nunca solo. Música sacra. Entregar invitaciones al Santísimo a cada servidor.', tipo: 'espiritual' },
          { hora: '3:50 PM', actividad: 'Preparación para recibir caminantes', encargado: 'Equipo de maleteros', detalle: 'Identificar maletas con sticker: nombre + habitación.', tipo: 'logistica' },
          { hora: '5:30 PM', actividad: 'Recepción de caminantes', encargado: 'Equipo de recepción', tipo: 'logistica' },
          { hora: '5:30 PM', actividad: 'Picadita de recepción', encargado: 'Equipo de snacks', tipo: 'comida' },
        ]
      },
      {
        titulo: 'Noche',
        camiseta: 'Saco de Effetá — todo el equipo',
        items: [
          { hora: '6:15 PM', actividad: 'Tocar la campana', encargado: 'Campanero', tipo: 'logistica' },
          { hora: '6:20 PM', actividad: 'Bienvenida y explicación del retiro', encargado: 'Joven y adulto', tipo: 'espiritual' },
          { hora: '6:30 PM', actividad: 'Explicación de la campana', encargado: 'Campanero', tipo: 'logistica' },
          { hora: '7:37 PM', actividad: 'Reglas del retiro', encargado: 'Coordinador Joven', tipo: 'logistica' },
          { hora: '7:40 PM', actividad: 'Explicación de la confidencialidad', encargado: 'Adulto', tipo: 'espiritual' },
          { hora: '7:43 PM', actividad: 'Lectura completa del pasaje de Effetá', encargado: 'Adulto encargado', detalle: 'Marcos 7, 31-37.', tipo: 'espiritual' },
          { hora: '7:50 PM', actividad: 'Asignación de mesas', encargado: 'Coordinador Logístico', tipo: 'logistica' },
          { hora: '8:10 PM', actividad: 'Ejercicio de la luz — Enciende una luz', encargado: 'Encargado + líderes de mesa', detalle: 'Apagar luces. Velas. Canción: "Enciende una luz". Reflexión breve.', tipo: 'actividad' },
          { hora: '8:15 PM', actividad: 'Cena — Bendición de alimentos', encargado: 'Servidor Joven', tipo: 'comida' },
          { hora: '8:50 PM', actividad: 'Presentaciones individuales por mesas', encargado: 'Líderes y co-líderes de mesa', tipo: 'espiritual' },
          { hora: '9:40 PM', actividad: 'Break', encargado: 'Adulto', tipo: 'logistica' },
          { hora: '9:50 PM', actividad: 'Explicación de palanquitas', encargado: 'Servidor Joven', tipo: 'espiritual' },
          { hora: '9:55 PM', actividad: 'CHARLA 1: Autosuficiencia', encargado: 'Encargado del testimonio', tipo: 'charla' },
          { hora: '10:35 PM', actividad: 'Lectura 1 del pasaje de Effetá', encargado: 'Adulto encargado', tipo: 'espiritual' },
          { hora: '10:50 PM', actividad: 'Ejercicio: Camino de la Vida', encargado: 'Equipo camino de la vida', detalle: '10 ponen blinds / 2 sacan del salón / 10 en la ruta / resto reciben en fogata.', tipo: 'actividad' },
          { hora: '11:15 PM', actividad: 'Compartir en fogata', encargado: 'Servidor Joven', tipo: 'espiritual' },
          { hora: '11:35 PM', actividad: 'Reglas de la noche e invitación al silencio', encargado: 'Servidor Joven', tipo: 'logistica' },
          { hora: '12:00 AM', actividad: 'Reunión de servidores', encargado: 'Coordinador joven y logística', tipo: 'logistica' },
          { hora: '12:30 AM', actividad: 'Práctica actividad de máscaras', encargado: '4H + 4M + adulto + 2 lectores', tipo: 'actividad' },
        ]
      }
    ]
  },
  sabado: {
    bloques: [
      {
        titulo: 'Mañana',
        camiseta: 'Camiseta roja — Esperanza y amor',
        items: [
          { hora: '6:30 AM', actividad: 'Santo Rosario', encargado: 'Servidor adulto/joven', tipo: 'espiritual' },
          { hora: '7:30 AM', actividad: 'Música para despertar caminantes', encargado: 'Equipo música', detalle: 'Canción: "No tengo miedo".', tipo: 'logistica' },
          { hora: '8:10 AM', actividad: 'Oración para comenzar el día', encargado: 'Servidor Joven', tipo: 'espiritual' },
          { hora: '8:15 AM', actividad: 'Explicación del Santísimo', encargado: 'Servidor Adulto', tipo: 'espiritual' },
          { hora: '8:30 AM', actividad: 'Desayuno', encargado: '', tipo: 'comida' },
          { hora: '9:15 AM', actividad: 'Foto grupal', encargado: 'Fotógrafo / Coordinador logística', tipo: 'logistica' },
          { hora: '9:55 AM', actividad: 'Ejercicio de máscaras', encargado: 'Equipo máscaras', tipo: 'actividad' },
          { hora: '10:15 AM', actividad: 'CHARLA 2: Descubriéndome', encargado: 'Encargado del testimonio', tipo: 'charla' },
          { hora: '11:10 AM', actividad: 'Actividad: Quitarse las máscaras', encargado: 'Servidores de mesa', tipo: 'actividad' },
          { hora: '12:15 PM', actividad: 'CHARLA 3: Mi primer llamado', encargado: 'Encargado del testimonio', tipo: 'charla' },
          { hora: '1:20 PM', actividad: 'Almuerzo', encargado: 'Servidor Joven', tipo: 'comida' },
        ]
      },
      {
        titulo: 'Tarde y Noche',
        items: [
          { hora: '2:10 PM', actividad: 'CHARLA 4: El templo del alma', encargado: 'Encargado del testimonio', tipo: 'charla' },
          { hora: '2:55 PM', actividad: 'Ejercicio: El perdón pasivo', encargado: 'Equipo del perdón', detalle: 'Orden: amigo(a), novio(a), hermano, hermana, papá, mamá. Canción: Tilma de Guadalupe.', tipo: 'actividad' },
          { hora: '3:15 PM', actividad: 'Ejercicio: El perdón activo', encargado: 'Equipo del perdón', tipo: 'actividad' },
          { hora: '3:30 PM', actividad: 'Oración de sanación', encargado: 'Sacerdote', tipo: 'espiritual' },
          { hora: '3:55 PM', actividad: 'Actividad: Sanando mi alma', encargado: '2 servidores jóvenes', detalle: 'Preguntas de examen de conciencia. Respuestas en papel confidencial que se guarda.', tipo: 'actividad' },
          { hora: '4:25 PM', actividad: 'CHARLA 5: Significado de los Sacramentos', encargado: 'Sacerdote', tipo: 'charla' },
          { hora: '5:20 PM', actividad: 'Lectio Divina — Hijo Pródigo', encargado: 'Coordinador logística', tipo: 'espiritual' },
          { hora: '6:05 PM', actividad: 'Cena', encargado: 'Campanero', tipo: 'comida' },
          { hora: '6:50 PM', actividad: 'CHARLA 6: En Ti confío', encargado: 'Encargado del testimonio', tipo: 'charla' },
          { hora: '7:30 PM', actividad: 'Actividad: El muro y el nudo', encargado: 'Equipo muro y nudo', detalle: '8 ponen blinds. 1 adulto dice a quién sacar. 1 muestra dónde parar. Llevan a confesiones → palancas → fogata.', tipo: 'actividad' },
          { hora: '8:30 PM', actividad: 'Palancas — lectura de cartas', encargado: 'Equipo de palancas', tipo: 'espiritual' },
          { hora: '9:30 PM', actividad: 'Fogata', encargado: 'Equipo música + servidores', detalle: 'Quemar papeles de pecados. Oración de agradecimiento.', tipo: 'espiritual' },
          { hora: '11:00 PM', actividad: 'Selección de mantelitos', encargado: 'Servidores', tipo: 'logistica' },
        ]
      }
    ]
  },
  domingo: {
    bloques: [
      {
        titulo: 'Mañana',
        camiseta: 'Camiseta blanca',
        items: [
          { hora: '6:30 AM', actividad: 'Rosario', encargado: 'Servidor adulto y joven', tipo: 'espiritual' },
          { hora: '7:30 AM', actividad: 'Despertar caminantes', encargado: 'Equipo música', detalle: 'Canción: "Ángeles".', tipo: 'logistica' },
          { hora: '8:40 AM', actividad: 'Desayuno', encargado: '', tipo: 'comida' },
          { hora: '9:10 AM', actividad: 'Actividad: Mantelitos', encargado: 'Servidor Joven', detalle: 'Servidor comparte primero. "Dios tiene un mensaje personal para nosotros."', tipo: 'actividad' },
          { hora: '10:20 AM', actividad: 'CHARLA 7: Sed de Dios', encargado: 'Encargado del testimonio', tipo: 'charla' },
          { hora: '11:10 AM', actividad: 'CHARLA 8: Mi Effetá y el servicio', encargado: 'Encargado del testimonio', tipo: 'charla' },
          { hora: '11:50 AM', actividad: 'Ejercicio: Carta de Jesús', encargado: 'Equipo palanquitas', detalle: 'Oración primero. Sobre con nombre y dirección. Se envía meses después.', tipo: 'actividad' },
          { hora: '1:35 PM', actividad: 'Almuerzo', encargado: 'Sacerdote', tipo: 'comida' },
        ]
      },
      {
        titulo: 'Tarde — Cierre',
        items: [
          { hora: '2:15 PM', actividad: 'Lectura 4 del pasaje de Effetá', encargado: 'Adulto encargado', tipo: 'espiritual' },
          { hora: '2:30 PM', actividad: 'Oración de intercesión por mesas', encargado: 'Coordinadores de mesa', tipo: 'espiritual' },
          { hora: '3:45 PM', actividad: 'Se guarda el Santísimo', encargado: 'Sacerdote', tipo: 'espiritual' },
          { hora: '3:50 PM', actividad: 'Dinámica del perdón de servidores', encargado: 'Todos los servidores', detalle: '7 representantes piden perdón por errores reales cometidos durante el retiro.', tipo: 'espiritual' },
          { hora: '4:00 PM', actividad: 'Preparación de la misa', encargado: 'Ministro', detalle: 'Escoger 3 lectores. Practicar "No tengo miedo". 4 servidores para ofrendas.', tipo: 'logistica' },
          { hora: '4:10 PM', actividad: 'Santa Misa de cierre', encargado: 'Sacerdote', tipo: 'espiritual' },
          { hora: '5:00 PM', actividad: 'Despedida', encargado: 'Todos', tipo: 'comida' },
        ]
      }
    ]
  }
}

const colorTipo: Record<string, { bg: string; color: string; label: string }> = {
  charla:    { bg: '#dc2626', color: 'white', label: 'Charla' },
  actividad: { bg: '#7c3aed', color: 'white', label: 'Actividad' },
  comida:    { bg: '#16a34a', color: 'white', label: 'Comida' },
  logistica: { bg: '#6b7280', color: 'white', label: 'Logística' },
  espiritual:{ bg: '#d97706', color: 'white', label: 'Espiritual' },
}

const CATEGORIAS_COLOR: Record<string, { border: string; badge: string; text: string }> = {
  'General':              { border: '#0f1787', badge: '#f0f2ff', text: '#0f1787' },
  'Actividades Generales':{ border: '#7c3aed', badge: '#faf5ff', text: '#7c3aed' },
  'Muro y Nudo':          { border: '#dc2626', badge: '#fef2f2', text: '#dc2626' },
}

export default function RetiroDashboard() {
  const router = useRouter()
  const [tab, setTab] = useState<Tab>('minutominuto')
  const [diaActivo, setDiaActivo] = useState<Dia>('viernes')
  const [expandido, setExpandido] = useState<string | null>(null)

  // Roles
  const [roles, setRoles] = useState<RolRetiro[]>([])
  const [loadingRoles, setLoadingRoles] = useState(false)
  const [busqueda, setBusqueda] = useState('')
  const [editandoId, setEditandoId] = useState<string | null>(null)
  const [editEncargados, setEditEncargados] = useState('')
  const [editRol, setEditRol] = useState('')
  const [guardando, setGuardando] = useState(false)
  const [exito, setExito] = useState('')

  useEffect(() => {
    if (tab === 'roles') cargarRoles()
  }, [tab])

  const cargarRoles = async () => {
    setLoadingRoles(true)
    const { data } = await supabase
      .from('roles_retiro')
      .select('*')
      .eq('retiro_id', RETIRO_ID)
      .order('orden')
    setRoles(data ?? [])
    setLoadingRoles(false)
  }

  const iniciarEdicion = (rol: RolRetiro) => {
    setEditandoId(rol.id)
    setEditRol(rol.rol)
    setEditEncargados(rol.encargados.join(', '))
  }

  const guardarEdicion = async (id: string) => {
    setGuardando(true)
    const nuevosEncargados = editEncargados
      .split(',')
      .map(e => e.trim())
      .filter(e => e.length > 0)

    const { error } = await supabase
      .from('roles_retiro')
      .update({ rol: editRol, encargados: nuevosEncargados })
      .eq('id', id)

    if (!error) {
      setExito('Guardado')
      await cargarRoles()
      setEditandoId(null)
      setTimeout(() => setExito(''), 2000)
    }
    setGuardando(false)
  }

  // Búsqueda: buscar servidor en todos los roles
  const busquedaLower = busqueda.toLowerCase()
  const resultadosBusqueda = busqueda.length > 1
    ? roles.filter(r => r.encargados.some(e => e.toLowerCase().includes(busquedaLower)))
    : []

  // Agrupar roles por categoría
  const categorias = [...new Set(roles.map(r => r.categoria))]
  const rolesFiltrados = busqueda.length > 1 ? resultadosBusqueda : roles

  const tabs: { id: Tab; label: string }[] = [
    { id: 'minutominuto', label: 'Minuto a Minuto' },
    { id: 'roles', label: 'Roles' },
    { id: 'manual', label: 'Manual' },
  ]

  const dias: { id: Dia; label: string; fecha: string }[] = [
    { id: 'viernes', label: 'Viernes', fecha: '3 Jul' },
    { id: 'sabado', label: 'Sábado', fecha: '4 Jul' },
    { id: 'domingo', label: 'Domingo', fecha: '5 Jul' },
  ]

  return (
    <div style={{ padding: '24px 16px', maxWidth: 700, margin: '0 auto', paddingBottom: 40 }}>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 24 }}>
        <div>
          <h1 style={{ fontSize: 20, fontWeight: 700, color: '#111827', margin: '0 0 4px' }}>
            IX Retiro Effeta Mazuren
          </h1>
          <p style={{ fontSize: 13, color: '#6b7280', margin: 0 }}>3, 4 y 5 de julio de 2026</p>
        </div>
        <button
          onClick={() => router.push('/dashboard')}
          style={{ background: '#f3f4f6', border: 'none', borderRadius: 8, padding: '8px 14px', fontSize: 13, cursor: 'pointer', color: '#374151' }}
        >← Dashboard</button>
      </div>

      {/* Tabs */}
      <div style={{ display: 'flex', gap: 6, marginBottom: 24, background: '#f3f4f6', borderRadius: 10, padding: 4 }}>
        {tabs.map(t => (
          <button key={t.id} onClick={() => setTab(t.id)} style={{
            flex: 1, padding: '8px 4px', border: 'none', borderRadius: 8, fontSize: 13, fontWeight: 600,
            cursor: 'pointer', background: tab === t.id ? '#0f1787' : 'transparent',
            color: tab === t.id ? 'white' : '#6b7280',
          }}>{t.label}</button>
        ))}
      </div>

      {/* ── MINUTO A MINUTO ── */}
      {tab === 'minutominuto' && (
        <div>
          <div style={{ display: 'flex', gap: 8, marginBottom: 20 }}>
            {dias.map(d => (
              <button key={d.id} onClick={() => setDiaActivo(d.id)} style={{
                flex: 1, padding: '10px 8px', border: 'none', borderRadius: 10, cursor: 'pointer',
                background: diaActivo === d.id ? '#0f1787' : 'white',
                color: diaActivo === d.id ? 'white' : '#374151',
                outline: diaActivo === d.id ? 'none' : '1.5px solid #e8eaf0',
                fontWeight: 600, fontSize: 12,
              }}>
                <div>{d.label}</div>
                <div style={{ fontSize: 11, opacity: 0.7, fontWeight: 400 }}>{d.fecha}</div>
              </button>
            ))}
          </div>

          {MINUTO_MINUTO[diaActivo].bloques.map((bloque, bi) => (
            <div key={bi} style={{ marginBottom: 24 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 10 }}>
                <h3 style={{ fontSize: 13, fontWeight: 700, color: '#0f1787', margin: 0, textTransform: 'uppercase', letterSpacing: 1 }}>
                  {bloque.titulo}
                </h3>
                {bloque.camiseta && (
                  <span style={{ fontSize: 11, background: '#fef3c7', color: '#92400e', padding: '2px 8px', borderRadius: 20 }}>
                    {bloque.camiseta}
                  </span>
                )}
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                {bloque.items.map((item, idx) => {
                  const key = `${bi}-${idx}`
                  const abierto = expandido === key
                  const colores = item.tipo ? colorTipo[item.tipo] : colorTipo.logistica
                  const esCharla = item.tipo === 'charla'
                  return (
                    <div key={idx} style={{
                      background: 'white', border: esCharla ? '2px solid #dc2626' : '1.5px solid #e8eaf0',
                      borderRadius: 10, overflow: 'hidden',
                    }}>
                      <button onClick={() => setExpandido(abierto ? null : key)} style={{
                        width: '100%', display: 'flex', alignItems: 'center', gap: 10,
                        padding: '10px 12px', background: 'none', border: 'none', cursor: 'pointer', textAlign: 'left',
                      }}>
                        <span style={{ fontSize: 12, fontWeight: 700, color: '#0f1787', minWidth: 64, flexShrink: 0 }}>{item.hora}</span>
                        <span style={{ fontSize: 13, fontWeight: esCharla ? 700 : 500, color: '#111827', flex: 1 }}>{item.actividad}</span>
                        {item.tipo && (
                          <span style={{ fontSize: 10, padding: '2px 7px', borderRadius: 20, fontWeight: 600, flexShrink: 0, background: colores.bg, color: colores.color }}>
                            {colores.label}
                          </span>
                        )}
                        <span style={{ fontSize: 12, color: '#9ca3af', flexShrink: 0 }}>{abierto ? '▲' : '▼'}</span>
                      </button>
                      {abierto && (
                        <div style={{ padding: '0 12px 12px', borderTop: '1px solid #f3f4f6' }}>
                          {item.encargado && <p style={{ fontSize: 12, color: '#0f1787', fontWeight: 600, margin: '8px 0 4px' }}>Encargado: {item.encargado}</p>}
                          {item.detalle && <p style={{ fontSize: 12, color: '#374151', margin: 0, lineHeight: 1.6 }}>{item.detalle}</p>}
                        </div>
                      )}
                    </div>
                  )
                })}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* ── ROLES ── */}
      {tab === 'roles' && (
        <div>
          {exito && (
            <div style={{ background: '#f0fdf4', border: '1px solid #bbf7d0', borderRadius: 8, padding: '8px 14px', marginBottom: 12, fontSize: 13, color: '#16a34a' }}>
              Guardado correctamente
            </div>
          )}

          {/* Barra de búsqueda */}
          <div style={{ position: 'relative', marginBottom: 20 }}>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#9ca3af" strokeWidth="2" strokeLinecap="round" style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)' }}>
              <circle cx="11" cy="11" r="8"/><path d="m21 21-4.35-4.35"/>
            </svg>
            <input
              type="text"
              placeholder="Buscar servidor por nombre..."
              value={busqueda}
              onChange={e => setBusqueda(e.target.value)}
              style={{
                width: '100%', padding: '10px 12px 10px 36px', border: '1.5px solid #e8eaf0',
                borderRadius: 10, fontSize: 14, outline: 'none', boxSizing: 'border-box',
                background: 'white', fontFamily: 'inherit',
              }}
            />
            {busqueda && (
              <button onClick={() => setBusqueda('')} style={{ position: 'absolute', right: 10, top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', cursor: 'pointer', color: '#9ca3af', fontSize: 16 }}>
                ✕
              </button>
            )}
          </div>

          {/* Resultados de búsqueda */}
          {busqueda.length > 1 && (
            <div style={{ marginBottom: 20 }}>
              {resultadosBusqueda.length === 0 ? (
                <div style={{ background: 'white', border: '1.5px solid #e8eaf0', borderRadius: 10, padding: '20px', textAlign: 'center', color: '#9ca3af', fontSize: 13 }}>
                  No se encontró ningún servidor con ese nombre
                </div>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                  <p style={{ fontSize: 12, fontWeight: 600, color: '#6b7280', margin: '0 0 6px', textTransform: 'uppercase', letterSpacing: 1 }}>
                    {resultadosBusqueda.length} resultado{resultadosBusqueda.length !== 1 ? 's' : ''}
                  </p>
                  {resultadosBusqueda.map(r => {
                    const c = CATEGORIAS_COLOR[r.categoria] ?? { border: '#6b7280', badge: '#f3f4f6', text: '#374151' }
                    const encargadosMatch = r.encargados.filter(e => e.toLowerCase().includes(busquedaLower))
                    return (
                      <div key={r.id} style={{ background: 'white', border: '1.5px solid #e8eaf0', borderRadius: 10, padding: '12px 14px', borderLeft: `3px solid ${c.border}` }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 8 }}>
                          <div>
                            <span style={{ fontSize: 10, background: c.badge, color: c.text, padding: '2px 7px', borderRadius: 20, fontWeight: 600 }}>{r.categoria}</span>
                            <p style={{ fontSize: 13, fontWeight: 700, color: '#111827', margin: '4px 0 6px' }}>{r.rol}</p>
                            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4 }}>
                              {encargadosMatch.map((e, i) => (
                                <span key={i} style={{ fontSize: 11, background: '#fef3c7', color: '#92400e', padding: '2px 8px', borderRadius: 20, fontWeight: 600 }}>
                                  {e}
                                </span>
                              ))}
                            </div>
                          </div>
                        </div>
                      </div>
                    )
                  })}
                </div>
              )}
            </div>
          )}

          {/* Lista completa por categoría */}
          {busqueda.length <= 1 && (
            loadingRoles ? (
              <div style={{ display: 'flex', justifyContent: 'center', padding: 40 }}>
                <div style={{ width: 28, height: 28, border: '3px solid #e2e4f0', borderTopColor: '#0f1787', borderRadius: '50%', animation: 'spin 0.8s linear infinite' }} />
                <style>{`@keyframes spin{to{transform:rotate(360deg)}}`}</style>
              </div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
                {categorias.map(cat => {
                  const c = CATEGORIAS_COLOR[cat] ?? { border: '#6b7280', badge: '#f3f4f6', text: '#374151' }
                  const rolesCategoria = roles.filter(r => r.categoria === cat)
                  return (
                    <div key={cat}>
                      <h3 style={{ fontSize: 12, fontWeight: 700, textTransform: 'uppercase', letterSpacing: 1, color: c.text, margin: '0 0 10px' }}>
                        {cat}
                      </h3>
                      <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                        {rolesCategoria.map(rol => (
                          <div key={rol.id} style={{ background: 'white', border: '1.5px solid #e8eaf0', borderRadius: 10, overflow: 'hidden', borderLeft: `3px solid ${c.border}` }}>
                            {editandoId === rol.id ? (
                              <div style={{ padding: '14px' }}>
                                <div style={{ marginBottom: 10 }}>
                                  <label style={{ fontSize: 11, fontWeight: 600, color: '#6b7280', display: 'block', marginBottom: 4 }}>NOMBRE DEL ROL</label>
                                  <input
                                    value={editRol}
                                    onChange={e => setEditRol(e.target.value)}
                                    style={{ width: '100%', padding: '8px 10px', border: '1.5px solid #e8eaf0', borderRadius: 8, fontSize: 13, outline: 'none', boxSizing: 'border-box', fontFamily: 'inherit' }}
                                  />
                                </div>
                                <div style={{ marginBottom: 12 }}>
                                  <label style={{ fontSize: 11, fontWeight: 600, color: '#6b7280', display: 'block', marginBottom: 4 }}>ENCARGADOS (separados por coma)</label>
                                  <textarea
                                    value={editEncargados}
                                    onChange={e => setEditEncargados(e.target.value)}
                                    rows={3}
                                    style={{ width: '100%', padding: '8px 10px', border: '1.5px solid #e8eaf0', borderRadius: 8, fontSize: 13, outline: 'none', boxSizing: 'border-box', fontFamily: 'inherit', resize: 'vertical' }}
                                  />
                                </div>
                                <div style={{ display: 'flex', gap: 8 }}>
                                  <button
                                    onClick={() => guardarEdicion(rol.id)}
                                    disabled={guardando}
                                    style={{ flex: 1, padding: '8px', background: guardando ? '#9ca3af' : '#0f1787', color: 'white', border: 'none', borderRadius: 8, fontSize: 13, fontWeight: 600, cursor: 'pointer' }}
                                  >{guardando ? 'Guardando...' : 'Guardar'}</button>
                                  <button
                                    onClick={() => setEditandoId(null)}
                                    style={{ padding: '8px 14px', background: '#f3f4f6', color: '#374151', border: 'none', borderRadius: 8, fontSize: 13, cursor: 'pointer' }}
                                  >Cancelar</button>
                                </div>
                              </div>
                            ) : (
                              <div style={{ padding: '12px 14px', display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 10 }}>
                                <div style={{ flex: 1 }}>
                                  <p style={{ fontSize: 13, fontWeight: 700, color: '#111827', margin: '0 0 6px' }}>{rol.rol}</p>
                                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4 }}>
                                    {rol.encargados.map((e, i) => (
                                      <span key={i} style={{ fontSize: 11, background: '#f3f4f6', color: '#374151', padding: '2px 8px', borderRadius: 20 }}>{e}</span>
                                    ))}
                                  </div>
                                </div>
                                <button
                                  onClick={() => iniciarEdicion(rol)}
                                  style={{ padding: '6px 10px', background: '#f0f2ff', color: '#0f1787', border: 'none', borderRadius: 8, fontSize: 11, fontWeight: 600, cursor: 'pointer', flexShrink: 0 }}
                                >Editar</button>
                              </div>
                            )}
                          </div>
                        ))}
                      </div>
                    </div>
                  )
                })}
              </div>
            )
          )}
        </div>
      )}

      {/* ── MANUAL ── */}
      {tab === 'manual' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          <div style={{ background: 'white', border: '1.5px solid #e8eaf0', borderRadius: 14, padding: '20px' }}>
            <div style={{ display: 'flex', gap: 14, alignItems: 'flex-start', marginBottom: 16 }}>
              <div style={{ width: 48, height: 48, background: '#0f1787', borderRadius: 12, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                <svg width="24" height="24" fill="none" viewBox="0 0 24 24">
                  <path d="M9 12h6M9 16h6M7 3H5a2 2 0 00-2 2v14a2 2 0 002 2h14a2 2 0 002-2V8l-5-5H7z" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                  <path d="M14 3v5h5" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                </svg>
              </div>
              <div>
                <p style={{ fontSize: 16, fontWeight: 700, color: '#111827', margin: '0 0 4px' }}>Manual Effeta Mazuren</p>
                <p style={{ fontSize: 13, color: '#6b7280', margin: 0 }}>Documento oficial con todas las instrucciones, actividades, guiones y protocolos.</p>
              </div>
            </div>
            <button
              onClick={() => window.open('https://docs.google.com/document/d/1lB2M0-FyRe6Eu-2HjcLcnI96jfEqgikC71TWzuhNUR4/edit', '_blank')}
              style={{ width: '100%', padding: '12px', background: '#0f1787', color: 'white', border: 'none', borderRadius: 10, fontSize: 14, fontWeight: 600, cursor: 'pointer' }}
            >
              Abrir Manual
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
