'use client'

import { useEffect, useState, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'

const RETIRO_ID = '21da7588-f7d9-4bf8-a6f6-ae6c8258c00e'
const APPS_SCRIPT_URL = 'https://script.google.com/macros/s/AKfycbxSBSMqBbLMjpjvwkGFYGOXN2Itnlk9ZMb5hxLaYiqhyDaily/exec'

type Tab = 'minutominuto' | 'roles' | 'mesas' | 'caminantes' | 'manual'
type Dia = 'viernes' | 'sabado' | 'domingo'

interface RolRetiro {
  id: string
  categoria: string
  rol: string
  encargados: string[]
  orden: number
}

interface Mesa {
  id: string
  numero: number
  adulto: string
  lider: string
  colider: string
}

interface Caminante {
  id: string
  nombre: string
  celular: string
  edad: number | null
}

interface Asignacion {
  id: string
  caminante_id: string
  mesa_id: string
  mesa_numero: number
  confirmado_por_lider: boolean
  caminante: Caminante
}

interface Seguimiento {
  id?: string
  asignacion_mesa_id: string
  llamado: boolean
  contesto: boolean
}

function SeguimientoBadges({ asignacionId, seguimientos, onToggle }: {
  asignacionId: string
  seguimientos: Record<string, Seguimiento>
  onToggle: (asignacionId: string, campo: 'llamado' | 'contesto') => void
}) {
  const seg = seguimientos[asignacionId] ?? { llamado: false, contesto: false }
  return (
    <div style={{ display: 'flex', gap: 6 }}>
      <button
        onClick={(e) => { e.stopPropagation(); onToggle(asignacionId, 'llamado') }}
        style={{
          display: 'flex', alignItems: 'center', gap: 4,
          padding: '3px 8px', borderRadius: 20, border: 'none', cursor: 'pointer', fontSize: 10, fontWeight: 600,
          background: seg.llamado ? '#dcfce7' : '#f3f4f6',
          color: seg.llamado ? '#16a34a' : '#6b7280',
        }}
      >
        <div style={{ width: 10, height: 10, borderRadius: 3, border: '1.5px solid ' + (seg.llamado ? '#16a34a' : '#9ca3af'), background: seg.llamado ? '#16a34a' : 'transparent', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
          {seg.llamado && <svg width="7" height="7" viewBox="0 0 10 10"><polyline points="1.5,5 4,7.5 8.5,2" stroke="white" strokeWidth="1.5" fill="none" strokeLinecap="round"/></svg>}
        </div>
        Llamado
      </button>
      <button
        onClick={(e) => { e.stopPropagation(); onToggle(asignacionId, 'contesto') }}
        style={{
          display: 'flex', alignItems: 'center', gap: 4,
          padding: '3px 8px', borderRadius: 20, border: 'none', cursor: 'pointer', fontSize: 10, fontWeight: 600,
          background: seg.contesto ? '#eff6ff' : '#f3f4f6',
          color: seg.contesto ? '#0f1787' : '#6b7280',
        }}
      >
        <div style={{ width: 10, height: 10, borderRadius: 3, border: '1.5px solid ' + (seg.contesto ? '#0f1787' : '#9ca3af'), background: seg.contesto ? '#0f1787' : 'transparent', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
          {seg.contesto && <svg width="7" height="7" viewBox="0 0 10 10"><polyline points="1.5,5 4,7.5 8.5,2" stroke="white" strokeWidth="1.5" fill="none" strokeLinecap="round"/></svg>}
        </div>
        Contestó
      </button>
    </div>
  )
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

// ── Sugerencia automática por edad ──
function sugerirAsignacion(caminantes: Caminante[], mesas: Mesa[]): { caminante_id: string; mesa_id: string; mesa_numero: number }[] {
  // Calcular edad promedio de líderes por mesa
  const mesasConEdad = mesas.map(m => {
    const edades: number[] = []
    const extraerEdad = (texto: string) => {
      const match = texto.match(/(\d+)\s*años?/i) || texto.match(/[-–]\s*(\d+)/)
      return match ? parseInt(match[1]) : null
    }
    const edLider = extraerEdad(m.lider)
    const edColider = extraerEdad(m.colider)
    if (edLider) edades.push(edLider)
    if (edColider) edades.push(edColider)
    const promedio = edades.length > 0 ? edades.reduce((a, b) => a + b, 0) / edades.length : 20
    return { ...m, edadPromedio: promedio }
  })

  // Ordenar mesas por edad promedio
  mesasConEdad.sort((a, b) => a.edadPromedio - b.edadPromedio)

  // Ordenar caminantes por edad
  const caminantesOrdenados = [...caminantes].sort((a, b) => (a.edad ?? 20) - (b.edad ?? 20))

  // Asignar 5 por mesa en orden de edad (snake draft para balancear)
  const asignaciones: { caminante_id: string; mesa_id: string; mesa_numero: number }[] = []
  const cuentaPorMesa: Record<string, number> = {}
  mesas.forEach(m => { cuentaPorMesa[m.id] = 0 })

  for (const cam of caminantesOrdenados) {
    // Buscar la mesa con menos caminantes que tenga edad más cercana
    let mejorMesa = mesasConEdad[0]
    let menorDiff = Infinity
    for (const m of mesasConEdad) {
      if (cuentaPorMesa[m.id] >= 5) continue
      const diff = Math.abs((cam.edad ?? 20) - m.edadPromedio)
      if (diff < menorDiff) {
        menorDiff = diff
        mejorMesa = m
      }
    }
    if (cuentaPorMesa[mejorMesa.id] < 5) {
      asignaciones.push({ caminante_id: cam.id, mesa_id: mejorMesa.id, mesa_numero: mejorMesa.numero })
      cuentaPorMesa[mejorMesa.id]++
    }
  }

  return asignaciones
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
  const [creandoRol, setCreandoRol] = useState(false)
  const [filtroRolesNum, setFiltroRolesNum] = useState<number | null>(null)
  const [filtroRolesModo, setFiltroRolesModo] = useState<'exacto' | 'mas' | 'menos'>('exacto')
  const [nuevoRolNombre, setNuevoRolNombre] = useState('')
  const [nuevoRolCategoria, setNuevoRolCategoria] = useState('General')
  const [nuevoRolEncargados, setNuevoRolEncargados] = useState('')
  const [guardandoNuevo, setGuardandoNuevo] = useState(false)

  // Mesas
  const [mesas, setMesas] = useState<Mesa[]>([])
  const [loadingMesas, setLoadingMesas] = useState(false)
  const [editandoMesaId, setEditandoMesaId] = useState<string | null>(null)
  const [editMesa, setEditMesa] = useState({ adulto: '', lider: '', colider: '' })
  const [guardandoMesa, setGuardandoMesa] = useState(false)
  const [exitoMesa, setExitoMesa] = useState('')

  // Caminantes
  const [asignaciones, setAsignaciones] = useState<Asignacion[]>([])
  const [loadingCam, setLoadingCam] = useState(false)
  const [generando, setGenerando] = useState(false)
  const [guardandoCam, setGuardandoCam] = useState(false)
  const [exitoCam, setExitoCam] = useState('')
  const [busquedaCam, setBusquedaCam] = useState('')
  const [mesaExpandida, setMesaExpandida] = useState<string | null>(null)
  const [editandoCamId, setEditandoCamId] = useState<string | null>(null) // asignacion.id
  const [mesasDisponibles, setMesasDisponibles] = useState<Mesa[]>([])
  const [nuevaMesaId, setNuevaMesaId] = useState('')
  const [sinAsignar, setSinAsignar] = useState<Caminante[]>([])
  const [caminantesSinMesa, setCaminantesSinMesa] = useState<Caminante[]>([])
  const [agregandoACaminante, setAgregandoACaminante] = useState<string | null>(null) // mesa_id
  const [camSeleccionado, setCamSeleccionado] = useState('')
  const [seguimientos, setSeguimientos] = useState<Record<string, Seguimiento>>({})

  useEffect(() => {
    if (tab === 'roles') cargarRoles()
    if (tab === 'mesas') cargarMesas()
    if (tab === 'caminantes') cargarCaminantes()
  }, [tab])

  const cargarRoles = async () => {
    setLoadingRoles(true)
    const { data } = await supabase.from('roles_retiro').select('*').eq('retiro_id', RETIRO_ID).order('orden')
    setRoles(data ?? [])
    setLoadingRoles(false)
  }

  const cargarMesas = async () => {
    setLoadingMesas(true)
    const { data } = await supabase.from('mesas').select('id, numero, adulto, lider, colider').eq('retiro_id', RETIRO_ID).order('numero')
    setMesas(data ?? [])
    setLoadingMesas(false)
  }

  const cargarCaminantes = useCallback(async () => {
    setLoadingCam(true)

    // Cargar mesas
    const { data: mesasData } = await supabase.from('mesas').select('id, numero, adulto, lider, colider').eq('retiro_id', RETIRO_ID).order('numero')
    const todasMesas: Mesa[] = mesasData ?? []
    setMesasDisponibles(todasMesas)

    // Cargar asignaciones existentes con datos del caminante
    const { data: asigData } = await supabase
      .from('asignaciones_mesa')
      .select('id, caminante_id, mesa_id, mesa_numero, confirmado_por_lider, caminantes(id, nombre, celular, edad)')
      .order('mesa_numero')

    const asigs: Asignacion[] = (asigData ?? []).map((a: any) => ({
      id: a.id,
      caminante_id: a.caminante_id,
      mesa_id: a.mesa_id,
      mesa_numero: a.mesa_numero,
      confirmado_por_lider: a.confirmado_por_lider,
      caminante: a.caminantes,
    })).filter((a: Asignacion) => a.caminante)

    setAsignaciones(asigs)

    // Cargar seguimientos
    if (asigs.length > 0) {
      const ids = asigs.map(a => a.id)
      const { data: segData } = await supabase
        .from('seguimiento_caminantes')
        .select('id, asignacion_mesa_id, llamado, contesto')
        .in('asignacion_mesa_id', ids)
      const segMap: Record<string, Seguimiento> = {}
      ;(segData ?? []).forEach((s: any) => { segMap[s.asignacion_mesa_id] = s })
      setSeguimientos(segMap)
    }

    // Caminantes con pago confirmado sin asignar
    const { data: pagados } = await supabase
      .from('pagos')
      .select('persona_id')
      .eq('retiro_id', RETIRO_ID)
      .eq('tipo_persona', 'caminante')
      .eq('estado', 'confirmado')

    const idsPagados = [...new Set((pagados ?? []).map((p: any) => p.persona_id))]
    const idsAsignados = new Set(asigs.map(a => a.caminante_id))

    if (idsPagados.length > 0) {
      const { data: camData } = await supabase
        .from('caminantes')
        .select('id, nombre, celular, edad')
        .in('id', idsPagados)
        .eq('retiro_id', RETIRO_ID)
        .order('edad')

      const todos: Caminante[] = camData ?? []
      setSinAsignar(todos.filter(c => !idsAsignados.has(c.id)))
      setCaminantesSinMesa(todos.filter(c => !idsAsignados.has(c.id)))
    } else {
      setSinAsignar([])
      setCaminantesSinMesa([])
    }

    setLoadingCam(false)
  }, [])

  const generarSugerencia = async () => {
    setGenerando(true)
    try {
      // Obtener caminantes pagados
      const { data: pagados } = await supabase
        .from('pagos')
        .select('persona_id')
        .eq('retiro_id', RETIRO_ID)
        .eq('tipo_persona', 'caminante')
        .eq('estado', 'confirmado')

      const idsPagados = [...new Set((pagados ?? []).map((p: any) => p.persona_id))]
      if (idsPagados.length === 0) { setGenerando(false); return }

      const { data: camData } = await supabase
        .from('caminantes')
        .select('id, nombre, celular, edad')
        .in('id', idsPagados)
        .eq('retiro_id', RETIRO_ID)

      const caminantes: Caminante[] = camData ?? []
      const sugeridas = sugerirAsignacion(caminantes, mesasDisponibles)

      // Borrar asignaciones anteriores e insertar nuevas
      await supabase.from('asignaciones_mesa').delete().neq('id', '00000000-0000-0000-0000-000000000000')

      if (sugeridas.length > 0) {
        await supabase.from('asignaciones_mesa').insert(
          sugeridas.map(s => ({
            caminante_id: s.caminante_id,
            mesa_id: s.mesa_id,
            mesa_numero: s.mesa_numero,
            sugerido_por_sistema: true,
            confirmado_por_lider: false,
          }))
        )
      }

      await cargarCaminantes()
      await sincronizarSheets()
    } finally {
      setGenerando(false)
    }
  }

  const confirmarTodas = async () => {
    setGuardandoCam(true)
    await supabase.from('asignaciones_mesa').update({ confirmado_por_lider: true }).eq('confirmado_por_lider', false)
    await cargarCaminantes()
    await sincronizarSheets()
    setExitoCam('Todas confirmadas')
    setTimeout(() => setExitoCam(''), 2500)
    setGuardandoCam(false)
  }

  const desconfirmarTodas = async () => {
    setGuardandoCam(true)
    await supabase.from('asignaciones_mesa').update({ confirmado_por_lider: false }).eq('confirmado_por_lider', true)
    await cargarCaminantes()
    setExitoCam('Asignaciones desconfirmadas — ya no son visibles para los líderes')
    setTimeout(() => setExitoCam(''), 3000)
    setGuardandoCam(false)
  }

  const cambiarMesaCaminante = async (asignacionId: string, nuevaMesa: Mesa) => {
    setGuardandoCam(true)
    await supabase.from('asignaciones_mesa')
      .update({ mesa_id: nuevaMesa.id, mesa_numero: nuevaMesa.numero, confirmado_por_lider: true })
      .eq('id', asignacionId)
    setEditandoCamId(null)
    await cargarCaminantes()
    await sincronizarSheets()
    setGuardandoCam(false)
  }

  const quitarCaminante = async (asignacionId: string) => {
    await supabase.from('asignaciones_mesa').delete().eq('id', asignacionId)
    await cargarCaminantes()
    await sincronizarSheets()
  }

  const toggleSeguimiento = async (asignacionId: string, campo: 'llamado' | 'contesto') => {
    const actual = seguimientos[asignacionId] ?? { llamado: false, contesto: false }
    const nuevo = { ...actual, [campo]: !actual[campo] }
    // Optimistic update
    setSeguimientos(prev => ({ ...prev, [asignacionId]: { ...nuevo, asignacion_mesa_id: asignacionId } }))
    // Upsert en Supabase
    const { data: existing } = await supabase
      .from('seguimiento_caminantes')
      .select('id')
      .eq('asignacion_mesa_id', asignacionId)
      .single()
    if (existing?.id) {
      await supabase.from('seguimiento_caminantes').update({ [campo]: nuevo[campo], updated_at: new Date().toISOString() }).eq('id', existing.id)
    } else {
      await supabase.from('seguimiento_caminantes').insert({ asignacion_mesa_id: asignacionId, llamado: nuevo.llamado, contesto: nuevo.contesto })
    }
  }

  const agregarCaminanteAMesa = async (mesaId: string, mesaNumero: number, caminanteId: string) => {
    if (!caminanteId) return
    setGuardandoCam(true)
    await supabase.from('asignaciones_mesa').insert({
      caminante_id: caminanteId,
      mesa_id: mesaId,
      mesa_numero: mesaNumero,
      sugerido_por_sistema: false,
      confirmado_por_lider: true,
    })
    setAgregandoACaminante(null)
    setCamSeleccionado('')
    await cargarCaminantes()
    await sincronizarSheets()
    setGuardandoCam(false)
  }

  const sincronizarSheets = async () => {
    try {
      // Recargar datos frescos para el sheet
      const { data: asigData } = await supabase
        .from('asignaciones_mesa')
        .select('mesa_numero, mesa_id, caminantes(nombre, celular, edad)')
        .order('mesa_numero')

      const { data: mesasData } = await supabase
        .from('mesas')
        .select('id, numero, adulto, lider, colider')
        .eq('retiro_id', RETIRO_ID)
        .order('numero')

      const mesasMap: Record<string, Mesa> = {}
      ;(mesasData ?? []).forEach((m: Mesa) => { mesasMap[m.id] = m })

      // Agrupar por mesa
      const porMesa: Record<number, { mesa: Mesa; caminantes: { nombre: string; celular: string; edad: number | null }[] }> = {}
      ;(asigData ?? []).forEach((a: any) => {
        if (!a.caminantes) return
        const num = a.mesa_numero
        if (!porMesa[num]) {
          porMesa[num] = { mesa: mesasMap[a.mesa_id] ?? { numero: num, adulto: '', lider: '', colider: '', id: '' }, caminantes: [] }
        }
        porMesa[num].caminantes.push({ nombre: a.caminantes.nombre, celular: a.caminantes.celular, edad: a.caminantes.edad })
      })

      await fetch(APPS_SCRIPT_URL, {
        method: 'POST',
        body: JSON.stringify({ tipo: 'actualizar_hoja_mesas', mesas: Object.values(porMesa) }),
      })
    } catch (e) {
      console.error('Error sync sheets:', e)
    }
  }

  // ── Roles helpers ──
  const iniciarEdicion = (rol: RolRetiro) => {
    setEditandoId(rol.id)
    setEditRol(rol.rol)
    setEditEncargados(rol.encargados.join(', '))
  }

  const guardarEdicion = async (id: string) => {
    setGuardando(true)
    const nuevosEncargados = editEncargados.split(',').map(e => e.trim()).filter(e => e.length > 0)
    const { error } = await supabase.from('roles_retiro').update({ rol: editRol, encargados: nuevosEncargados }).eq('id', id)
    if (!error) { setExito('Guardado'); await cargarRoles(); setEditandoId(null); setTimeout(() => setExito(''), 2000) }
    setGuardando(false)
  }

  const crearRol = async () => {
    if (!nuevoRolNombre.trim()) return
    setGuardandoNuevo(true)
    const encargados = nuevoRolEncargados.split(',').map(e => e.trim()).filter(e => e.length > 0)
    const maxOrden = roles.length > 0 ? Math.max(...roles.map(r => r.orden)) : 0
    const { error } = await supabase.from('roles_retiro').insert({
      retiro_id: RETIRO_ID,
      categoria: nuevoRolCategoria,
      rol: nuevoRolNombre.trim(),
      encargados,
      orden: maxOrden + 1,
    })
    if (!error) {
      await cargarRoles()
      setCreandoRol(false)
      setNuevoRolNombre('')
      setNuevoRolEncargados('')
      setNuevoRolCategoria('General')
      setExito('Rol creado')
      setTimeout(() => setExito(''), 2000)
    }
    setGuardandoNuevo(false)
  }

  // ── Mesas helpers ──
  const iniciarEdicionMesa = (mesa: Mesa) => {
    setEditandoMesaId(mesa.id)
    setEditMesa({ adulto: mesa.adulto ?? '', lider: mesa.lider ?? '', colider: mesa.colider ?? '' })
  }

  const guardarMesa = async (id: string) => {
    setGuardandoMesa(true)
    const { error } = await supabase.from('mesas').update({ adulto: editMesa.adulto.trim(), lider: editMesa.lider.trim(), colider: editMesa.colider.trim() }).eq('id', id)
    if (!error) { setExitoMesa('Guardado'); await cargarMesas(); setEditandoMesaId(null); setTimeout(() => setExitoMesa(''), 2500) }
    setGuardandoMesa(false)
  }

  const busquedaLower = busqueda.toLowerCase()
  const resultadosBusqueda = busqueda.length > 1 ? roles.filter(r => r.encargados.some(e => e.toLowerCase().includes(busquedaLower))) : []
  const categorias = [...new Set(roles.map(r => r.categoria))]

  // Filtrar caminantes por búsqueda
  // Mapa: nombre -> cantidad de roles
  const rolesPorPersona: Record<string, number> = {}
  roles.forEach(r => {
    r.encargados.forEach(e => {
      rolesPorPersona[e] = (rolesPorPersona[e] ?? 0) + 1
    })
  })

  // Personas filtradas por cantidad de roles
  const personasFiltradas = filtroRolesNum !== null
    ? Object.entries(rolesPorPersona).filter(([, count]) => {
        if (filtroRolesModo === 'exacto') return count === filtroRolesNum
        if (filtroRolesModo === 'mas') return count >= filtroRolesNum!
        if (filtroRolesModo === 'menos') return count <= filtroRolesNum!
        return true
      }).sort((a, b) => b[1] - a[1])
    : []

  const busquedaCamLower = busquedaCam.toLowerCase()
  const asignacionesFiltradas = busquedaCam.length > 1
    ? asignaciones.filter(a => a.caminante?.nombre?.toLowerCase().includes(busquedaCamLower))
    : asignaciones

  const tabs: { id: Tab; label: string }[] = [
    { id: 'minutominuto', label: 'Minuto a Minuto' },
    { id: 'roles', label: 'Roles' },
    { id: 'mesas', label: 'Mesas' },
    { id: 'caminantes', label: 'Caminantes' },
    { id: 'manual', label: 'Manual' },
  ]

  const dias: { id: Dia; label: string; fecha: string }[] = [
    { id: 'viernes', label: 'Viernes', fecha: '3 Jul' },
    { id: 'sabado', label: 'Sábado', fecha: '4 Jul' },
    { id: 'domingo', label: 'Domingo', fecha: '5 Jul' },
  ]

  // Agrupar asignaciones por mesa
  const asignacionesPorMesa: Record<number, Asignacion[]> = {}
  asignacionesFiltradas.forEach(a => {
    if (!asignacionesPorMesa[a.mesa_numero]) asignacionesPorMesa[a.mesa_numero] = []
    asignacionesPorMesa[a.mesa_numero].push(a)
  })

  return (
    <div style={{ padding: '24px 16px', maxWidth: 700, margin: '0 auto', paddingBottom: 40 }}>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 24 }}>
        <div>
          <h1 style={{ fontSize: 20, fontWeight: 700, color: '#111827', margin: '0 0 4px' }}>IX Retiro Effeta Mazuren</h1>
          <p style={{ fontSize: 13, color: '#6b7280', margin: 0 }}>3, 4 y 5 de julio de 2026</p>
        </div>
        <button onClick={() => router.push('/dashboard')} style={{ background: '#f3f4f6', border: 'none', borderRadius: 8, padding: '8px 14px', fontSize: 13, cursor: 'pointer', color: '#374151' }}>← Dashboard</button>
      </div>

      {/* Tabs */}
      <div style={{ display: 'flex', gap: 4, marginBottom: 24, background: '#f3f4f6', borderRadius: 10, padding: 4, overflowX: 'auto' }}>
        {tabs.map(t => (
          <button key={t.id} onClick={() => setTab(t.id)} style={{
            flex: 1, minWidth: 72, padding: '8px 4px', border: 'none', borderRadius: 8, fontSize: 11, fontWeight: 600,
            cursor: 'pointer', background: tab === t.id ? '#0f1787' : 'transparent',
            color: tab === t.id ? 'white' : '#6b7280', whiteSpace: 'nowrap',
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
                <h3 style={{ fontSize: 13, fontWeight: 700, color: '#0f1787', margin: 0, textTransform: 'uppercase', letterSpacing: 1 }}>{bloque.titulo}</h3>
                {bloque.camiseta && <span style={{ fontSize: 11, background: '#fef3c7', color: '#92400e', padding: '2px 8px', borderRadius: 20 }}>{bloque.camiseta}</span>}
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                {bloque.items.map((item, idx) => {
                  const key = `${bi}-${idx}`
                  const abierto = expandido === key
                  const colores = item.tipo ? colorTipo[item.tipo] : colorTipo.logistica
                  const esCharla = item.tipo === 'charla'
                  return (
                    <div key={idx} style={{ background: 'white', border: esCharla ? '2px solid #dc2626' : '1.5px solid #e8eaf0', borderRadius: 10, overflow: 'hidden' }}>
                      <button onClick={() => setExpandido(abierto ? null : key)} style={{ width: '100%', display: 'flex', alignItems: 'center', gap: 10, padding: '10px 12px', background: 'none', border: 'none', cursor: 'pointer', textAlign: 'left' }}>
                        <span style={{ fontSize: 12, fontWeight: 700, color: '#0f1787', minWidth: 64, flexShrink: 0 }}>{item.hora}</span>
                        <span style={{ fontSize: 13, fontWeight: esCharla ? 700 : 500, color: '#111827', flex: 1 }}>{item.actividad}</span>
                        {item.tipo && <span style={{ fontSize: 10, padding: '2px 7px', borderRadius: 20, fontWeight: 600, flexShrink: 0, background: colores.bg, color: colores.color }}>{colores.label}</span>}
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
          {exito && <div style={{ background: '#f0fdf4', border: '1px solid #bbf7d0', borderRadius: 8, padding: '8px 14px', marginBottom: 12, fontSize: 13, color: '#16a34a' }}>✓ {exito}</div>}

          {/* Botón nuevo rol */}
          {!creandoRol && (
            <button onClick={() => setCreandoRol(true)} style={{ width: '100%', padding: '10px', background: '#f0f2ff', color: '#0f1787', border: '1.5px dashed #c7d0ff', borderRadius: 10, fontSize: 13, fontWeight: 600, cursor: 'pointer', marginBottom: 16 }}>
              + Nuevo rol
            </button>
          )}

          {/* Formulario nuevo rol */}
          {creandoRol && (
            <div style={{ background: 'white', border: '1.5px solid #c7d0ff', borderRadius: 12, padding: '16px', marginBottom: 16 }}>
              <p style={{ fontSize: 13, fontWeight: 700, color: '#0f1787', margin: '0 0 14px' }}>Nuevo rol</p>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 10, marginBottom: 14 }}>
                <div>
                  <label style={{ fontSize: 11, fontWeight: 600, color: '#6b7280', display: 'block', marginBottom: 4 }}>CATEGORÍA</label>
                  <select value={nuevoRolCategoria} onChange={e => setNuevoRolCategoria(e.target.value)}
                    style={{ width: '100%', padding: '8px 10px', border: '1.5px solid #e8eaf0', borderRadius: 8, fontSize: 13, outline: 'none', boxSizing: 'border-box', fontFamily: 'inherit', background: 'white' }}>
                    <option value="General">General</option>
                    <option value="Actividades Generales">Actividades Generales</option>
                    <option value="Muro y Nudo">Muro y Nudo</option>
                  </select>
                </div>
                <div>
                  <label style={{ fontSize: 11, fontWeight: 600, color: '#6b7280', display: 'block', marginBottom: 4 }}>NOMBRE DEL ROL</label>
                  <input value={nuevoRolNombre} onChange={e => setNuevoRolNombre(e.target.value)} placeholder="Ej: Campanero"
                    style={{ width: '100%', padding: '8px 10px', border: '1.5px solid #e8eaf0', borderRadius: 8, fontSize: 13, outline: 'none', boxSizing: 'border-box', fontFamily: 'inherit' }} />
                </div>
                <div>
                  <label style={{ fontSize: 11, fontWeight: 600, color: '#6b7280', display: 'block', marginBottom: 4 }}>ENCARGADOS (separados por coma)</label>
                  <textarea value={nuevoRolEncargados} onChange={e => setNuevoRolEncargados(e.target.value)} rows={3} placeholder="Ej: Juan Pérez, María García"
                    style={{ width: '100%', padding: '8px 10px', border: '1.5px solid #e8eaf0', borderRadius: 8, fontSize: 13, outline: 'none', boxSizing: 'border-box', fontFamily: 'inherit', resize: 'vertical' }} />
                </div>
              </div>
              <div style={{ display: 'flex', gap: 8 }}>
                <button onClick={crearRol} disabled={guardandoNuevo || !nuevoRolNombre.trim()}
                  style={{ flex: 1, padding: '9px', background: guardandoNuevo || !nuevoRolNombre.trim() ? '#9ca3af' : '#0f1787', color: 'white', border: 'none', borderRadius: 8, fontSize: 13, fontWeight: 600, cursor: 'pointer' }}>
                  {guardandoNuevo ? 'Guardando...' : 'Crear rol'}
                </button>
                <button onClick={() => { setCreandoRol(false); setNuevoRolNombre(''); setNuevoRolEncargados('') }}
                  style={{ padding: '9px 14px', background: '#f3f4f6', color: '#374151', border: 'none', borderRadius: 8, fontSize: 13, cursor: 'pointer' }}>
                  Cancelar
                </button>
              </div>
            </div>
          )}

          {/* Filtro por cantidad de roles */}
          <div style={{ background: 'white', border: '1.5px solid #e8eaf0', borderRadius: 12, padding: '14px', marginBottom: 16 }}>
            <p style={{ fontSize: 11, fontWeight: 700, color: '#6b7280', margin: '0 0 10px', textTransform: 'uppercase', letterSpacing: 0.5 }}>Filtrar por cantidad de roles</p>
            <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginBottom: 10 }}>
              {(['exacto', 'mas', 'menos'] as const).map(modo => (
                <button key={modo} onClick={() => setFiltroRolesModo(modo)}
                  style={{ padding: '4px 10px', borderRadius: 20, border: 'none', cursor: 'pointer', fontSize: 11, fontWeight: 600,
                    background: filtroRolesModo === modo ? '#0f1787' : '#f3f4f6',
                    color: filtroRolesModo === modo ? 'white' : '#6b7280' }}>
                  {modo === 'exacto' ? 'Exactamente' : modo === 'mas' ? 'Al menos' : 'Máximo'}
                </button>
              ))}
            </div>
            <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
              <input type="number" min={1} max={20} value={filtroRolesNum ?? ''} placeholder="# roles"
                onChange={e => setFiltroRolesNum(e.target.value ? parseInt(e.target.value) : null)}
                style={{ width: 80, padding: '7px 10px', border: '1.5px solid #e8eaf0', borderRadius: 8, fontSize: 13, outline: 'none', fontFamily: 'inherit' }} />
              <span style={{ fontSize: 13, color: '#6b7280' }}>roles</span>
              {filtroRolesNum !== null && (
                <button onClick={() => setFiltroRolesNum(null)}
                  style={{ marginLeft: 'auto', padding: '4px 10px', background: '#f3f4f6', color: '#6b7280', border: 'none', borderRadius: 8, fontSize: 11, cursor: 'pointer' }}>
                  Limpiar
                </button>
              )}
            </div>

            {/* Resultados del filtro */}
            {filtroRolesNum !== null && (
              <div style={{ marginTop: 12 }}>
                {personasFiltradas.length === 0 ? (
                  <p style={{ fontSize: 13, color: '#9ca3af', margin: 0, fontStyle: 'italic' }}>Nadie tiene ese número de roles</p>
                ) : (
                  <>
                    <p style={{ fontSize: 11, color: '#6b7280', margin: '0 0 8px', fontWeight: 600 }}>{personasFiltradas.length} persona{personasFiltradas.length !== 1 ? 's' : ''}</p>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                      {personasFiltradas.map(([nombre, count]) => {
                        const susRoles = roles.filter(r => r.encargados.includes(nombre))
                        return (
                          <div key={nombre} style={{ background: '#f7f8fc', borderRadius: 8, padding: '8px 12px' }}>
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 }}>
                              <span style={{ fontSize: 13, fontWeight: 600, color: '#111827' }}>{nombre}</span>
                              <span style={{ fontSize: 11, background: '#0f1787', color: 'white', padding: '2px 8px', borderRadius: 20, fontWeight: 700 }}>{count} roles</span>
                            </div>
                            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4 }}>
                              {susRoles.map((r, i) => (
                                <span key={i} style={{ fontSize: 10, background: '#e8eaf0', color: '#374151', padding: '1px 7px', borderRadius: 20 }}>{r.rol}</span>
                              ))}
                            </div>
                          </div>
                        )
                      })}
                    </div>
                  </>
                )}
              </div>
            )}
          </div>

          <div style={{ position: 'relative', marginBottom: 20 }}>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#9ca3af" strokeWidth="2" strokeLinecap="round" style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)' }}>
              <circle cx="11" cy="11" r="8"/><path d="m21 21-4.35-4.35"/>
            </svg>
            <input type="text" placeholder="Buscar servidor por nombre..." value={busqueda} onChange={e => setBusqueda(e.target.value)}
              style={{ width: '100%', padding: '10px 12px 10px 36px', border: '1.5px solid #e8eaf0', borderRadius: 10, fontSize: 14, outline: 'none', boxSizing: 'border-box', background: 'white', fontFamily: 'inherit' }} />
            {busqueda && <button onClick={() => setBusqueda('')} style={{ position: 'absolute', right: 10, top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', cursor: 'pointer', color: '#9ca3af', fontSize: 16 }}>✕</button>}
          </div>
          {busqueda.length > 1 && (
            <div style={{ marginBottom: 20 }}>
              {resultadosBusqueda.length === 0 ? (
                <div style={{ background: 'white', border: '1.5px solid #e8eaf0', borderRadius: 10, padding: '20px', textAlign: 'center', color: '#9ca3af', fontSize: 13 }}>No se encontró ningún servidor con ese nombre</div>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                  <p style={{ fontSize: 12, fontWeight: 600, color: '#6b7280', margin: '0 0 6px', textTransform: 'uppercase', letterSpacing: 1 }}>{resultadosBusqueda.length} resultado{resultadosBusqueda.length !== 1 ? 's' : ''}</p>
                  {resultadosBusqueda.map(r => {
                    const c = CATEGORIAS_COLOR[r.categoria] ?? { border: '#6b7280', badge: '#f3f4f6', text: '#374151' }
                    const encargadosMatch = r.encargados.filter(e => e.toLowerCase().includes(busquedaLower))
                    return (
                      <div key={r.id} style={{ background: 'white', border: '1.5px solid #e8eaf0', borderRadius: 10, padding: '12px 14px', borderLeft: `3px solid ${c.border}` }}>
                        <span style={{ fontSize: 10, background: c.badge, color: c.text, padding: '2px 7px', borderRadius: 20, fontWeight: 600 }}>{r.categoria}</span>
                        <p style={{ fontSize: 13, fontWeight: 700, color: '#111827', margin: '4px 0 6px' }}>{r.rol}</p>
                        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4 }}>
                          {encargadosMatch.map((e, i) => <span key={i} style={{ fontSize: 11, background: '#fef3c7', color: '#92400e', padding: '2px 8px', borderRadius: 20, fontWeight: 600 }}>{e}</span>)}
                        </div>
                      </div>
                    )
                  })}
                </div>
              )}
            </div>
          )}
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
                  return (
                    <div key={cat}>
                      <h3 style={{ fontSize: 12, fontWeight: 700, textTransform: 'uppercase', letterSpacing: 1, color: c.text, margin: '0 0 10px' }}>{cat}</h3>
                      <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                        {roles.filter(r => r.categoria === cat).map(rol => (
                          <div key={rol.id} style={{ background: 'white', border: '1.5px solid #e8eaf0', borderRadius: 10, overflow: 'hidden', borderLeft: `3px solid ${c.border}` }}>
                            {editandoId === rol.id ? (
                              <div style={{ padding: '14px' }}>
                                <div style={{ marginBottom: 10 }}>
                                  <label style={{ fontSize: 11, fontWeight: 600, color: '#6b7280', display: 'block', marginBottom: 4 }}>NOMBRE DEL ROL</label>
                                  <input value={editRol} onChange={e => setEditRol(e.target.value)} style={{ width: '100%', padding: '8px 10px', border: '1.5px solid #e8eaf0', borderRadius: 8, fontSize: 13, outline: 'none', boxSizing: 'border-box', fontFamily: 'inherit' }} />
                                </div>
                                <div style={{ marginBottom: 12 }}>
                                  <label style={{ fontSize: 11, fontWeight: 600, color: '#6b7280', display: 'block', marginBottom: 4 }}>ENCARGADOS (separados por coma)</label>
                                  <textarea value={editEncargados} onChange={e => setEditEncargados(e.target.value)} rows={3} style={{ width: '100%', padding: '8px 10px', border: '1.5px solid #e8eaf0', borderRadius: 8, fontSize: 13, outline: 'none', boxSizing: 'border-box', fontFamily: 'inherit', resize: 'vertical' }} />
                                </div>
                                <div style={{ display: 'flex', gap: 8 }}>
                                  <button onClick={() => guardarEdicion(rol.id)} disabled={guardando} style={{ flex: 1, padding: '8px', background: guardando ? '#9ca3af' : '#0f1787', color: 'white', border: 'none', borderRadius: 8, fontSize: 13, fontWeight: 600, cursor: 'pointer' }}>{guardando ? 'Guardando...' : 'Guardar'}</button>
                                  <button onClick={() => setEditandoId(null)} style={{ padding: '8px 14px', background: '#f3f4f6', color: '#374151', border: 'none', borderRadius: 8, fontSize: 13, cursor: 'pointer' }}>Cancelar</button>
                                </div>
                              </div>
                            ) : (
                              <div style={{ padding: '12px 14px', display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 10 }}>
                                <div style={{ flex: 1 }}>
                                  <p style={{ fontSize: 13, fontWeight: 700, color: '#111827', margin: '0 0 6px' }}>{rol.rol}</p>
                                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4 }}>
                                    {rol.encargados.map((e, i) => <span key={i} style={{ fontSize: 11, background: '#f3f4f6', color: '#374151', padding: '2px 8px', borderRadius: 20 }}>{e}</span>)}
                                  </div>
                                </div>
                                <button onClick={() => iniciarEdicion(rol)} style={{ padding: '6px 10px', background: '#f0f2ff', color: '#0f1787', border: 'none', borderRadius: 8, fontSize: 11, fontWeight: 600, cursor: 'pointer', flexShrink: 0 }}>Editar</button>
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

      {/* ── MESAS ── */}
      {tab === 'mesas' && (
        <div>
          {exitoMesa && <div style={{ background: '#f0fdf4', border: '1px solid #bbf7d0', borderRadius: 8, padding: '8px 14px', marginBottom: 12, fontSize: 13, color: '#16a34a' }}>✓ Mesa actualizada correctamente</div>}
          {loadingMesas ? (
            <div style={{ display: 'flex', justifyContent: 'center', padding: 40 }}>
              <div style={{ width: 28, height: 28, border: '3px solid #e2e4f0', borderTopColor: '#0f1787', borderRadius: '50%', animation: 'spin 0.8s linear infinite' }} />
              <style>{`@keyframes spin{to{transform:rotate(360deg)}}`}</style>
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              {mesas.map(mesa => (
                <div key={mesa.id} style={{ background: 'white', border: '1.5px solid #e8eaf0', borderRadius: 12, overflow: 'hidden', borderLeft: '3px solid #0f1787' }}>
                  {editandoMesaId === mesa.id ? (
                    <div style={{ padding: '14px' }}>
                      <p style={{ fontSize: 13, fontWeight: 700, color: '#0f1787', margin: '0 0 14px' }}>Mesa {mesa.numero}</p>
                      <div style={{ display: 'flex', flexDirection: 'column', gap: 10, marginBottom: 14 }}>
                        {[{ key: 'adulto', label: 'LÍDER ADULTO' }, { key: 'lider', label: 'LÍDER JOVEN' }, { key: 'colider', label: 'CO-LÍDER' }].map(f => (
                          <div key={f.key}>
                            <label style={{ fontSize: 11, fontWeight: 600, color: '#6b7280', display: 'block', marginBottom: 4 }}>{f.label}</label>
                            <input value={editMesa[f.key as keyof typeof editMesa]} onChange={e => setEditMesa(p => ({ ...p, [f.key]: e.target.value }))}
                              style={{ width: '100%', padding: '8px 10px', border: '1.5px solid #e8eaf0', borderRadius: 8, fontSize: 13, outline: 'none', boxSizing: 'border-box', fontFamily: 'inherit' }} />
                          </div>
                        ))}
                      </div>
                      <div style={{ display: 'flex', gap: 8 }}>
                        <button onClick={() => guardarMesa(mesa.id)} disabled={guardandoMesa} style={{ flex: 1, padding: '9px', background: guardandoMesa ? '#9ca3af' : '#0f1787', color: 'white', border: 'none', borderRadius: 8, fontSize: 13, fontWeight: 600, cursor: 'pointer' }}>{guardandoMesa ? 'Guardando...' : 'Guardar'}</button>
                        <button onClick={() => setEditandoMesaId(null)} style={{ padding: '9px 14px', background: '#f3f4f6', color: '#374151', border: 'none', borderRadius: 8, fontSize: 13, cursor: 'pointer' }}>Cancelar</button>
                      </div>
                    </div>
                  ) : (
                    <div style={{ padding: '12px 14px', display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 10 }}>
                      <div style={{ flex: 1 }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
                          <div style={{ width: 28, height: 28, borderRadius: 8, background: '#0f1787', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 13, fontWeight: 700, color: 'white', flexShrink: 0 }}>{mesa.numero}</div>
                          <span style={{ fontSize: 14, fontWeight: 700, color: '#111827' }}>Mesa {mesa.numero}</span>
                        </div>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                          {mesa.adulto && <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}><span style={{ fontSize: 10, background: '#fef3c7', color: '#92400e', padding: '1px 7px', borderRadius: 20, fontWeight: 600, flexShrink: 0 }}>Adulto</span><span style={{ fontSize: 12, color: '#374151' }}>{mesa.adulto}</span></div>}
                          {mesa.lider && <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}><span style={{ fontSize: 10, background: '#f0f2ff', color: '#0f1787', padding: '1px 7px', borderRadius: 20, fontWeight: 600, flexShrink: 0 }}>Líder</span><span style={{ fontSize: 12, color: '#374151' }}>{mesa.lider}</span></div>}
                          {mesa.colider && <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}><span style={{ fontSize: 10, background: '#faf5ff', color: '#7c3aed', padding: '1px 7px', borderRadius: 20, fontWeight: 600, flexShrink: 0 }}>Co-líder</span><span style={{ fontSize: 12, color: '#374151' }}>{mesa.colider}</span></div>}
                        </div>
                      </div>
                      <button onClick={() => iniciarEdicionMesa(mesa)} style={{ padding: '6px 10px', background: '#f0f2ff', color: '#0f1787', border: 'none', borderRadius: 8, fontSize: 11, fontWeight: 600, cursor: 'pointer', flexShrink: 0 }}>Editar</button>
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* ── CAMINANTES ── */}
      {tab === 'caminantes' && (
        <div>
          {exitoCam && <div style={{ background: '#f0fdf4', border: '1px solid #bbf7d0', borderRadius: 8, padding: '8px 14px', marginBottom: 12, fontSize: 13, color: '#16a34a' }}>✓ {exitoCam}</div>}

          {loadingCam ? (
            <div style={{ display: 'flex', justifyContent: 'center', padding: 40 }}>
              <div style={{ width: 28, height: 28, border: '3px solid #e2e4f0', borderTopColor: '#0f1787', borderRadius: '50%', animation: 'spin 0.8s linear infinite' }} />
              <style>{`@keyframes spin{to{transform:rotate(360deg)}}`}</style>
            </div>
          ) : (
            <>
              {/* Acciones */}
              <div style={{ display: 'flex', gap: 8, marginBottom: 16 }}>
                <button onClick={generarSugerencia} disabled={generando || guardandoCam}
                  style={{ flex: 1, padding: '10px', background: generando ? '#9ca3af' : '#0f1787', color: 'white', border: 'none', borderRadius: 10, fontSize: 13, fontWeight: 600, cursor: 'pointer' }}>
                  {generando ? 'Generando...' : asignaciones.length > 0 ? 'Regenerar sugerencia' : 'Generar sugerencia automática'}
                </button>
                {asignaciones.length > 0 && asignaciones.some(a => !a.confirmado_por_lider) && (
                  <button onClick={confirmarTodas} disabled={guardandoCam}
                    style={{ padding: '10px 14px', background: '#16a34a', color: 'white', border: 'none', borderRadius: 10, fontSize: 13, fontWeight: 600, cursor: 'pointer' }}>
                    Confirmar todas
                  </button>
                )}
                {asignaciones.length > 0 && asignaciones.some(a => a.confirmado_por_lider) && (
                  <button onClick={desconfirmarTodas} disabled={guardandoCam}
                    style={{ padding: '10px 14px', background: '#f3f4f6', color: '#6b7280', border: '1.5px solid #e8eaf0', borderRadius: 10, fontSize: 13, fontWeight: 600, cursor: 'pointer' }}>
                    Desconfirmar
                  </button>
                )}
              </div>

              {/* Stats */}
              {asignaciones.length > 0 && (
                <div style={{ display: 'flex', gap: 8, marginBottom: 16 }}>
                  <div style={{ flex: 1, background: 'white', border: '0.5px solid #e8eaf0', borderRadius: 10, padding: '10px 14px', textAlign: 'center' }}>
                    <div style={{ fontSize: 20, fontWeight: 700, color: '#0f1787' }}>{asignaciones.length}</div>
                    <div style={{ fontSize: 11, color: '#6b7280' }}>Asignados</div>
                  </div>
                  <div style={{ flex: 1, background: 'white', border: '0.5px solid #e8eaf0', borderRadius: 10, padding: '10px 14px', textAlign: 'center' }}>
                    <div style={{ fontSize: 20, fontWeight: 700, color: '#d97706' }}>{sinAsignar.length}</div>
                    <div style={{ fontSize: 11, color: '#6b7280' }}>Sin asignar</div>
                  </div>
                  <div style={{ flex: 1, background: 'white', border: '0.5px solid #e8eaf0', borderRadius: 10, padding: '10px 14px', textAlign: 'center' }}>
                    <div style={{ fontSize: 20, fontWeight: 700, color: '#16a34a' }}>{asignaciones.filter(a => a.confirmado_por_lider).length}</div>
                    <div style={{ fontSize: 11, color: '#6b7280' }}>Confirmados</div>
                  </div>
                </div>
              )}

              {/* Búsqueda */}
              {asignaciones.length > 0 && (
                <div style={{ position: 'relative', marginBottom: 16 }}>
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#9ca3af" strokeWidth="2" strokeLinecap="round" style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)' }}>
                    <circle cx="11" cy="11" r="8"/><path d="m21 21-4.35-4.35"/>
                  </svg>
                  <input type="text" placeholder="Buscar caminante por nombre..." value={busquedaCam} onChange={e => setBusquedaCam(e.target.value)}
                    style={{ width: '100%', padding: '10px 12px 10px 36px', border: '1.5px solid #e8eaf0', borderRadius: 10, fontSize: 13, outline: 'none', boxSizing: 'border-box', background: 'white', fontFamily: 'inherit' }} />
                  {busquedaCam && <button onClick={() => setBusquedaCam('')} style={{ position: 'absolute', right: 10, top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', cursor: 'pointer', color: '#9ca3af', fontSize: 16 }}>✕</button>}
                </div>
              )}

              {/* Sin asignar */}
              {sinAsignar.length > 0 && (
                <div style={{ background: '#fffbeb', border: '1px solid #fde68a', borderRadius: 10, padding: '12px 14px', marginBottom: 16 }}>
                  <p style={{ fontSize: 12, fontWeight: 700, color: '#92400e', margin: '0 0 8px', textTransform: 'uppercase', letterSpacing: 0.5 }}>
                    {sinAsignar.length} caminante{sinAsignar.length !== 1 ? 's' : ''} sin mesa
                  </p>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                    {sinAsignar.map(c => (
                      <div key={c.id} style={{ fontSize: 12, color: '#78350f', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        <span>{c.nombre} {c.edad ? `· ${c.edad} años` : ''}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Estado vacío */}
              {asignaciones.length === 0 && (
                <div style={{ background: 'white', border: '1.5px solid #e8eaf0', borderRadius: 14, padding: '40px 24px', textAlign: 'center' }}>
                  <div style={{ width: 48, height: 48, background: '#f0f2ff', borderRadius: 14, display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 16px' }}>
                    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#0f1787" strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round">
                      <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/>
                      <path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/>
                    </svg>
                  </div>
                  <p style={{ fontSize: 15, fontWeight: 600, color: '#111827', margin: '0 0 6px' }}>No hay asignaciones aún</p>
                  <p style={{ fontSize: 13, color: '#6b7280', margin: 0 }}>Haz clic en "Generar sugerencia automática" para asignar caminantes a las mesas según edad.</p>
                </div>
              )}

              {/* Lista por mesa */}
              {asignaciones.length > 0 && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                  {mesasDisponibles.map(mesa => {
                    const camsEnMesa = asignacionesPorMesa[mesa.numero] ?? []
                    const abierta = mesaExpandida === mesa.id
                    const confirmados = camsEnMesa.filter(a => a.confirmado_por_lider).length
                    return (
                      <div key={mesa.id} style={{ background: 'white', border: '1.5px solid #e8eaf0', borderRadius: 12, overflow: 'hidden', borderLeft: '3px solid #0f1787' }}>
                        {/* Header mesa */}
                        <button onClick={() => setMesaExpandida(abierta ? null : mesa.id)}
                          style={{ width: '100%', display: 'flex', alignItems: 'center', gap: 10, padding: '12px 14px', background: 'none', border: 'none', cursor: 'pointer', textAlign: 'left' }}>
                          <div style={{ width: 28, height: 28, borderRadius: 8, background: '#0f1787', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 13, fontWeight: 700, color: 'white', flexShrink: 0 }}>{mesa.numero}</div>
                          <div style={{ flex: 1 }}>
                            <span style={{ fontSize: 14, fontWeight: 700, color: '#111827' }}>Mesa {mesa.numero}</span>
                            <span style={{ fontSize: 11, color: '#6b7280', marginLeft: 8 }}>{mesa.lider}</span>
                          </div>
                          <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                            <span style={{ fontSize: 12, fontWeight: 600, color: camsEnMesa.length >= 5 ? '#16a34a' : '#d97706' }}>{camsEnMesa.length}/5</span>
                            {confirmados > 0 && confirmados === camsEnMesa.length && (
                              <span style={{ fontSize: 10, background: '#f0fdf4', color: '#16a34a', padding: '2px 6px', borderRadius: 20, fontWeight: 600 }}>✓</span>
                            )}
                            <span style={{ fontSize: 12, color: '#9ca3af' }}>{abierta ? '▲' : '▼'}</span>
                          </div>
                        </button>

                        {/* Caminantes de la mesa */}
                        {abierta && (
                          <div style={{ borderTop: '1px solid #f3f4f6', padding: '10px 14px' }}>
                            {camsEnMesa.length === 0 ? (
                              <p style={{ fontSize: 13, color: '#9ca3af', margin: '4px 0 8px', fontStyle: 'italic' }}>Sin caminantes asignados</p>
                            ) : (
                              <div style={{ display: 'flex', flexDirection: 'column', gap: 6, marginBottom: 10 }}>
                                {camsEnMesa.map(asig => (
                                  <div key={asig.id} style={{ display: 'flex', alignItems: 'flex-start', gap: 8, padding: '10px', background: asig.confirmado_por_lider ? '#f0fdf4' : '#fffbeb', borderRadius: 8 }}>
                                    <div style={{ flex: 1 }}>
                                      <div style={{ fontSize: 13, fontWeight: 600, color: '#111827', marginBottom: 2 }}>{asig.caminante?.nombre}</div>
                                      <div style={{ fontSize: 11, color: '#6b7280', marginBottom: 6 }}>
                                        {asig.caminante?.celular && `${asig.caminante.celular}`}
                                        {asig.caminante?.edad && ` · ${asig.caminante.edad} años`}
                                      </div>
                                      <SeguimientoBadges asignacionId={asig.id} seguimientos={seguimientos} onToggle={toggleSeguimiento} />
                                    </div>
                                    {editandoCamId === asig.id ? (
                                      <div style={{ display: 'flex', gap: 4, alignItems: 'center' }}>
                                        <select value={nuevaMesaId} onChange={e => setNuevaMesaId(e.target.value)}
                                          style={{ fontSize: 12, border: '1.5px solid #e8eaf0', borderRadius: 6, padding: '4px 6px', outline: 'none' }}>
                                          <option value="">Mesa...</option>
                                          {mesasDisponibles.map(m => <option key={m.id} value={m.id}>Mesa {m.numero}</option>)}
                                        </select>
                                        <button onClick={() => { if (nuevaMesaId) { const m = mesasDisponibles.find(x => x.id === nuevaMesaId); if (m) cambiarMesaCaminante(asig.id, m) } }}
                                          style={{ padding: '4px 8px', background: '#0f1787', color: 'white', border: 'none', borderRadius: 6, fontSize: 11, cursor: 'pointer' }}>OK</button>
                                        <button onClick={() => setEditandoCamId(null)}
                                          style={{ padding: '4px 8px', background: '#f3f4f6', color: '#374151', border: 'none', borderRadius: 6, fontSize: 11, cursor: 'pointer' }}>✕</button>
                                      </div>
                                    ) : (
                                      <div style={{ display: 'flex', gap: 4 }}>
                                        <button onClick={() => { setEditandoCamId(asig.id); setNuevaMesaId('') }}
                                          style={{ padding: '4px 8px', background: '#f0f2ff', color: '#0f1787', border: 'none', borderRadius: 6, fontSize: 11, fontWeight: 600, cursor: 'pointer' }}>Mover</button>
                                        <button onClick={() => quitarCaminante(asig.id)}
                                          style={{ padding: '4px 8px', background: '#fef2f2', color: '#dc2626', border: 'none', borderRadius: 6, fontSize: 11, fontWeight: 600, cursor: 'pointer' }}>✕</button>
                                      </div>
                                    )}
                                  </div>
                                ))}
                              </div>
                            )}

                            {/* Agregar caminante sin mesa */}
                            {caminantesSinMesa.length > 0 && (
                              agregandoACaminante === mesa.id ? (
                                <div style={{ display: 'flex', gap: 6, marginTop: 4 }}>
                                  <select value={camSeleccionado} onChange={e => setCamSeleccionado(e.target.value)}
                                    style={{ flex: 1, fontSize: 12, border: '1.5px solid #e8eaf0', borderRadius: 8, padding: '6px 8px', outline: 'none' }}>
                                    <option value="">Seleccionar caminante...</option>
                                    {caminantesSinMesa.map(c => <option key={c.id} value={c.id}>{c.nombre}{c.edad ? ` · ${c.edad} años` : ''}</option>)}
                                  </select>
                                  <button onClick={() => agregarCaminanteAMesa(mesa.id, mesa.numero, camSeleccionado)}
                                    style={{ padding: '6px 12px', background: '#0f1787', color: 'white', border: 'none', borderRadius: 8, fontSize: 12, fontWeight: 600, cursor: 'pointer' }}>Agregar</button>
                                  <button onClick={() => { setAgregandoACaminante(null); setCamSeleccionado('') }}
                                    style={{ padding: '6px 10px', background: '#f3f4f6', color: '#374151', border: 'none', borderRadius: 8, fontSize: 12, cursor: 'pointer' }}>✕</button>
                                </div>
                              ) : (
                                <button onClick={() => setAgregandoACaminante(mesa.id)}
                                  style={{ width: '100%', padding: '7px', background: '#f0f2ff', color: '#0f1787', border: '1.5px dashed #c7d0ff', borderRadius: 8, fontSize: 12, fontWeight: 600, cursor: 'pointer' }}>
                                  + Agregar caminante
                                </button>
                              )
                            )}
                          </div>
                        )}
                      </div>
                    )
                  })}
                </div>
              )}
            </>
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
            <button onClick={() => window.open('https://docs.google.com/document/d/1lB2M0-FyRe6Eu-2HjcLcnI96jfEqgikC71TWzuhNUR4/edit', '_blank')}
              style={{ width: '100%', padding: '12px', background: '#0f1787', color: 'white', border: 'none', borderRadius: 10, fontSize: 14, fontWeight: 600, cursor: 'pointer' }}>
              Abrir Manual
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
 
