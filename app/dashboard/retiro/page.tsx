'use client'

import { useEffect, useState, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'

const RETIRO_ID = '21da7588-f7d9-4bf8-a6f6-ae6c8258c00e'
const CAMINANTES_POR_MESA = 6
const APPS_SCRIPT_MESAS = 'https://script.google.com/macros/s/AKfycbxSBSMqBbLMjpjvwkGFYGOXN2Itnlk9ZMb5hxLaYiqhyDaily/exec'
const APPS_SCRIPT_HABITACIONES = 'https://script.google.com/macros/s/AKfycbx0ECn_Bv7pDUvSxna_ewwZcUt7kwDE4WQuMZk5QTq4SfpSYKG7xXzuIqi12lVDDE_aGQ/exec'

function norm(s: string): string {
  return s.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').trim()
}
function tokensOf(s: string): string[] {
  return norm(s).split(' ').filter(t => t.length > 2)
}
function nombreMatch(a: string, b: string): boolean {
  const nA = norm(a), nB = norm(b)
  if (nA === nB) return true
  const tA = tokensOf(a), tB = tokensOf(b)
  if (tA.filter(t => tB.includes(t)).length >= 3) return true
  if (tA.length >= 3 && tB.length >= 3 && tB.includes(tA[0]) && tA.slice(1).filter(t => tB.includes(t)).length >= 2) return true
  return false
}

function loadJsPDF(): Promise<any> {
  return new Promise((resolve, reject) => {
    const w = window as any
    if (w.jspdf?.jsPDF) { resolve(w.jspdf.jsPDF); return }
    const existing = document.getElementById('jspdf-cdn-script') as HTMLScriptElement | null
    if (existing) {
      existing.addEventListener('load', () => resolve(w.jspdf.jsPDF))
      existing.addEventListener('error', () => reject(new Error('No se pudo cargar jsPDF')))
      return
    }
    const script = document.createElement('script')
    script.id = 'jspdf-cdn-script'
    script.src = 'https://cdnjs.cloudflare.com/ajax/libs/jspdf/2.5.1/jspdf.umd.min.js'
    script.onload = () => resolve(w.jspdf.jsPDF)
    script.onerror = () => reject(new Error('No se pudo cargar jsPDF'))
    document.body.appendChild(script)
  })
}

type Tab = 'minutominuto' | 'roles' | 'mesas' | 'caminantes' | 'cuartos' | 'manual'
type Dia = 'viernes' | 'sabado' | 'domingo'

interface RolRetiro { id: string; categoria: string; rol: string; encargados: string[]; orden: number }
interface Mesa { id: string; numero: number; adulto: string; lider: string; colider: string }
interface Caminante { id: string; nombre: string; celular: string; edad: number | null; es_dificil?: boolean; motivo_dificil?: string | null }
interface Asignacion { id: string; caminante_id: string; mesa_id: string; mesa_numero: number; confirmado_por_lider: boolean; caminante: Caminante }
interface Seguimiento { id?: string; asignacion_mesa_id: string; llamado: boolean; contesto: boolean }
interface Habitacion { id: string; numero: string; piso: number; bloque: string; tipo_cama: string; capacidad: number; solo_servidores: boolean }
interface AsignacionHabitacion { id: string; habitacion_id: string; persona_id: string; tipo_persona: 'caminante' | 'servidor'; nombre: string }
interface ServidorPalancas { id: string; nombre: string; palancas_lider: boolean }

interface ItemMM { id?: string; hora: string; actividad: string; encargado: string; detalle?: string; tipo?: 'charla'|'actividad'|'comida'|'logistica'|'espiritual'; orden_item: number }
interface BloqueMM { titulo: string; camiseta?: string; orden_bloque: number; items: ItemMM[] }

const colorTipoMM: Record<string, { bg: string; color: string; label: string }> = {
  charla:    { bg: '#dc2626', color: 'white', label: 'Charla' },
  actividad: { bg: '#7c3aed', color: 'white', label: 'Actividad' },
  comida:    { bg: '#16a34a', color: 'white', label: 'Comida' },
  logistica: { bg: '#6b7280', color: 'white', label: 'Logística' },
  espiritual:{ bg: '#d97706', color: 'white', label: 'Espiritual' },
}

function parsearTextoMM(texto: string): BloqueMM[] {
  const lineas = texto.split('\n').map(l => l.trim()).filter(l => l.length > 0)
  const bloques: BloqueMM[] = []
  let bloqueActual: BloqueMM | null = null
  let ordenBloque = 0
  let ordenItem = 0

  const parseHora = (raw: string): string => {
    const m = raw.replace(/[;,.]/g, ':').match(/^(\d{1,2}):(\d{2})\s*(am|pm)?$/i)
    if (!m) return raw.toUpperCase()
    let h = parseInt(m[1])
    const min = m[2]
    const per = m[3]?.toLowerCase()
    if (per === 'pm' && h < 12) h += 12
    if (per === 'am' && h === 12) h = 0
    const suf = h >= 12 ? 'PM' : 'AM'
    const h12 = h % 12 === 0 ? 12 : h % 12
    return `${h12}:${min} ${suf}`
  }

  const detectarTipo = (t: string): ItemMM['tipo'] => {
    const s = t.toLowerCase()
    if (s.includes('charla') || s.includes('testimonio')) return 'charla'
    if (s.includes('almuerzo') || s.includes('cena') || s.includes('desayuno') || s.includes('snack') || s.includes('picadita')) return 'comida'
    if (s.includes('oración') || s.includes('oracion') || s.includes('rosario') || s.includes('misa') || s.includes('santísimo') || s.includes('lectio') || s.includes('confesion')) return 'espiritual'
    if (s.includes('ejercicio') || s.includes('actividad') || s.includes('dinámica') || s.includes('máscaras') || s.includes('fogata') || s.includes('camino')) return 'actividad'
    return 'logistica'
  }

  for (const linea of lineas) {
    if (linea.toUpperCase().startsWith('CAMISETA:')) {
      if (bloqueActual) bloqueActual.camiseta = linea.replace(/^CAMISETA:\s*/i, '').trim()
      continue
    }
    const esEncabezado = linea.startsWith('BLOQUE:') || (linea === linea.toUpperCase() && !linea.startsWith('*') && !/^\d/.test(linea) && linea.length > 2 && !linea.includes('|'))
    if (esEncabezado) {
      bloqueActual = { titulo: linea.replace(/^BLOQUE:\s*/i, '').trim(), orden_bloque: ordenBloque++, items: [] }
      bloques.push(bloqueActual)
      ordenItem = 0
      continue
    }
    if (!linea.startsWith('*') && !/^\d/.test(linea)) continue
    const contenido = linea.replace(/^\*\s*/, '').trim()
    const partes = contenido.split('|').map(p => p.trim())
    const horaMatch = partes[0].match(/^(\d{1,2}[;:,.]\d{2}\s*(?:am|pm)?)\s+(.+)/i)
    if (!horaMatch) continue
    const hora = parseHora(horaMatch[1].trim())
    const actividad = horaMatch[2].trim()
    const encargado = partes[1] ?? ''
    const tipoRaw = partes[2] ?? ''
    const detalle = partes[3] ?? ''
    const TIPOS_VALIDOS = ['charla','actividad','comida','logistica','espiritual']
    const tipo = TIPOS_VALIDOS.includes(tipoRaw.toLowerCase()) ? tipoRaw.toLowerCase() as ItemMM['tipo'] : detectarTipo(actividad)
    if (!bloqueActual) {
      bloqueActual = { titulo: 'General', orden_bloque: ordenBloque++, items: [] }
      bloques.push(bloqueActual)
    }
    bloqueActual.items.push({ hora, actividad, encargado, detalle: detalle || undefined, tipo, orden_item: ordenItem++ })
  }
  return bloques.filter(b => b.items.length > 0)
}

function SeguimientoBadges({ asignacionId, seguimientos, onToggle }: { asignacionId: string; seguimientos: Record<string, Seguimiento>; onToggle: (id: string, campo: 'llamado'|'contesto') => void }) {
  const seg = seguimientos[asignacionId] ?? { llamado: false, contesto: false }
  return (
    <div style={{ display: 'flex', gap: 6 }}>
      {(['llamado','contesto'] as const).map(campo => (
        <button key={campo} onClick={e => { e.stopPropagation(); onToggle(asignacionId, campo) }}
          style={{ display: 'flex', alignItems: 'center', gap: 4, padding: '3px 8px', borderRadius: 20, border: 'none', cursor: 'pointer', fontSize: 10, fontWeight: 600, background: seg[campo] ? (campo==='llamado'?'#dcfce7':'#eff6ff') : '#f3f4f6', color: seg[campo] ? (campo==='llamado'?'#16a34a':'#0f1787') : '#6b7280' }}>
          <div style={{ width: 10, height: 10, borderRadius: 3, border: '1.5px solid '+(seg[campo]?(campo==='llamado'?'#16a34a':'#0f1787'):'#9ca3af'), background: seg[campo]?(campo==='llamado'?'#16a34a':'#0f1787'):'transparent', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
            {seg[campo] && <svg width="7" height="7" viewBox="0 0 10 10"><polyline points="1.5,5 4,7.5 8.5,2" stroke="white" strokeWidth="1.5" fill="none" strokeLinecap="round"/></svg>}
          </div>
          {campo === 'llamado' ? 'Llamado' : 'Contestó'}
        </button>
      ))}
    </div>
  )
}

const CATEGORIAS_COLOR: Record<string, { border: string; badge: string; text: string }> = {
  'General':               { border: '#0f1787', badge: '#f0f2ff', text: '#0f1787' },
  'Actividades Generales': { border: '#7c3aed', badge: '#faf5ff', text: '#7c3aed' },
  'Muro y Nudo':           { border: '#dc2626', badge: '#fef2f2', text: '#dc2626' },
}

export default function RetiroDashboard() {
  const router = useRouter()
  const [tab, setTab] = useState<Tab>('minutominuto')
  const [diaActivo, setDiaActivo] = useState<Dia>('viernes')
  const [expandido, setExpandido] = useState<string|null>(null)

  // MM
  const [mmPorDia, setMmPorDia] = useState<Record<Dia,BloqueMM[]>>({viernes:[],sabado:[],domingo:[]})
  const [loadingMM, setLoadingMM] = useState(false)
  const [modoEdicionMM, setModoEdicionMM] = useState(false)
  const [textoDia, setTextoDia] = useState<Record<Dia,string>>({viernes:'',sabado:'',domingo:''})
  const [parsePreview, setParsePreview] = useState<BloqueMM[]>([])
  const [guardandoMM, setGuardandoMM] = useState(false)
  const [exitoMM, setExitoMM] = useState('')
  const [diaEdicion, setDiaEdicion] = useState<Dia>('viernes')

  // Roles
  const [roles, setRoles] = useState<RolRetiro[]>([])
  const [loadingRoles, setLoadingRoles] = useState(false)
  const [busqueda, setBusqueda] = useState('')
  const [editandoId, setEditandoId] = useState<string|null>(null)
  const [editEncargados, setEditEncargados] = useState('')
  const [editRol, setEditRol] = useState('')
  const [guardando, setGuardando] = useState(false)
  const [exito, setExito] = useState('')
  const [creandoRol, setCreandoRol] = useState(false)
  const [filtroRolesNum, setFiltroRolesNum] = useState<number|null>(null)
  const [filtroRolesModo, setFiltroRolesModo] = useState<'exacto'|'mas'|'menos'>('exacto')
  const [nuevoRolNombre, setNuevoRolNombre] = useState('')
  const [nuevoRolCategoria, setNuevoRolCategoria] = useState('General')
  const [nuevoRolEncargados, setNuevoRolEncargados] = useState('')
  const [guardandoNuevo, setGuardandoNuevo] = useState(false)

  // Palancas
  const [servidoresList, setServidoresList] = useState<ServidorPalancas[]>([])
  const [loadingPL, setLoadingPL] = useState(false)
  const [exitoPL, setExitoPL] = useState('')

  // Mesas
  const [mesas, setMesas] = useState<Mesa[]>([])
  const [loadingMesas, setLoadingMesas] = useState(false)
  const [editandoMesaId, setEditandoMesaId] = useState<string|null>(null)
  const [editMesa, setEditMesa] = useState({adulto:'',lider:'',colider:''})
  const [guardandoMesa, setGuardandoMesa] = useState(false)
  const [exitoMesa, setExitoMesa] = useState('')
  const [generandoPDF, setGenerandoPDF] = useState(false)
  const [errorPDF, setErrorPDF] = useState('')

  // Caminantes
  const [asignaciones, setAsignaciones] = useState<Asignacion[]>([])
  const [loadingCam, setLoadingCam] = useState(false)
  const [guardandoCam, setGuardandoCam] = useState(false)
  const [exitoCam, setExitoCam] = useState('')
  const [busquedaCam, setBusquedaCam] = useState('')
  const [mesaExpandida, setMesaExpandida] = useState<string|null>(null)
  const [editandoCamId, setEditandoCamId] = useState<string|null>(null)
  const [mesasDisponibles, setMesasDisponibles] = useState<Mesa[]>([])
  const [nuevaMesaId, setNuevaMesaId] = useState('')
  const [sinAsignar, setSinAsignar] = useState<Caminante[]>([])
  const [caminantesSinMesa, setCaminantesSinMesa] = useState<Caminante[]>([])
  const [agregandoACam, setAgregandoACam] = useState<string|null>(null)
  const [camSel, setCamSel] = useState('')
  const [seguimientos, setSeguimientos] = useState<Record<string,Seguimiento>>({})
  const [dificilEditId, setDificilEditId] = useState<string|null>(null)
  const [motivoDificil, setMotivoDificil] = useState('')
  const [guardandoDificil, setGuardandoDificil] = useState(false)
  const [verCasosDificiles, setVerCasosDificiles] = useState(false)

  // Cuartos
  const [habitaciones, setHabitaciones] = useState<Habitacion[]>([])
  const [asignacionesHab, setAsignacionesHab] = useState<AsignacionHabitacion[]>([])
  const [loadingCuartos, setLoadingCuartos] = useState(false)
  const [exitoCuartos, setExitoCuartos] = useState('')
  const [busquedaCuartos, setBusquedaCuartos] = useState('')
  const [filtroPiso, setFiltroPiso] = useState<number|null>(null)
  const [filtroTipo, setFiltroTipo] = useState<'todos'|'caminante'|'servidor'|'libre'>('todos')
  const [habExpandida, setHabExpandida] = useState<string|null>(null)
  const [sinCuarto, setSinCuarto] = useState<{id:string;nombre:string;tipo:'caminante'|'servidor'}[]>([])
  const [agregandoAHab, setAgregandoAHab] = useState<string|null>(null)
  const [personaSel, setPersonaSel] = useState('')

  useEffect(() => {
    if (tab==='minutominuto') cargarMM()
    if (tab==='roles') { cargarRoles(); cargarPalancas() }
    if (tab==='mesas') cargarMesas()
    if (tab==='caminantes') cargarCaminantes()
    if (tab==='cuartos') cargarCuartos()
  }, [tab])

  const cargarMM = async () => {
    setLoadingMM(true)
    const { data } = await supabase.from('minuto_minuto').select('*').eq('retiro_id',RETIRO_ID).order('orden_bloque').order('orden_item')
    const porDia: Record<Dia,BloqueMM[]> = {viernes:[],sabado:[],domingo:[]}
    if (data && data.length > 0) {
      for (const dia of ['viernes','sabado','domingo'] as Dia[]) {
        const filas = data.filter((r:any)=>r.dia===dia)
        const map: Record<number,BloqueMM> = {}
        for (const f of filas) {
          if (!map[f.orden_bloque]) map[f.orden_bloque] = { titulo:f.bloque_titulo, camiseta:f.bloque_camiseta??undefined, orden_bloque:f.orden_bloque, items:[] }
          map[f.orden_bloque].items.push({ id:f.id, hora:f.hora, actividad:f.actividad, encargado:f.encargado??'', detalle:f.detalle??undefined, tipo:f.tipo??undefined, orden_item:f.orden_item })
        }
        porDia[dia] = Object.values(map).sort((a,b)=>a.orden_bloque-b.orden_bloque)
      }
    }
    setMmPorDia(porDia)
    setLoadingMM(false)
  }

  const guardarDiaMM = async (dia: Dia, bloques: BloqueMM[]) => {
    setGuardandoMM(true)
    await supabase.from('minuto_minuto').delete().eq('retiro_id',RETIRO_ID).eq('dia',dia)
    const filas: any[] = []
    for (const b of bloques) for (const it of b.items) filas.push({ retiro_id:RETIRO_ID, dia, bloque_titulo:b.titulo, bloque_camiseta:b.camiseta??null, orden_bloque:b.orden_bloque, hora:it.hora, actividad:it.actividad, encargado:it.encargado||null, detalle:it.detalle??null, tipo:it.tipo??null, orden_item:it.orden_item })
    if (filas.length>0) await supabase.from('minuto_minuto').insert(filas)
    await cargarMM()
    setGuardandoMM(false); setModoEdicionMM(false); setParsePreview([])
    setExitoMM(`${dia.charAt(0).toUpperCase()+dia.slice(1)} guardado`); setTimeout(()=>setExitoMM(''),3000)
  }

  const cargarRoles = async () => {
    setLoadingRoles(true)
    const { data } = await supabase.from('roles_retiro').select('*').eq('retiro_id',RETIRO_ID).order('orden')
    setRoles(data??[]); setLoadingRoles(false)
  }

  const cargarPalancas = async () => {
    setLoadingPL(true)
    const { data } = await supabase.from('servidores_inscripcion').select('id,nombre,palancas_lider').eq('retiro_id',RETIRO_ID).order('nombre')
    setServidoresList(data??[]); setLoadingPL(false)
  }

  const cargarMesas = async () => {
    setLoadingMesas(true)
    const { data } = await supabase.from('mesas').select('id,numero,adulto,lider,colider').eq('retiro_id',RETIRO_ID).order('numero')
    setMesas(data??[]); setLoadingMesas(false)
  }

  const cargarCaminantes = useCallback(async () => {
    setLoadingCam(true)
    const { data: md } = await supabase.from('mesas').select('id,numero,adulto,lider,colider').eq('retiro_id',RETIRO_ID).order('numero')
    setMesasDisponibles(md??[])
    const { data: ad } = await supabase.from('asignaciones_mesa').select('id,caminante_id,mesa_id,mesa_numero,confirmado_por_lider,caminantes(id,nombre,celular,edad,es_dificil,motivo_dificil)').order('mesa_numero')
    const asigs: Asignacion[] = (ad??[]).map((a:any)=>({id:a.id,caminante_id:a.caminante_id,mesa_id:a.mesa_id,mesa_numero:a.mesa_numero,confirmado_por_lider:a.confirmado_por_lider,caminante:a.caminantes})).filter((a:Asignacion)=>a.caminante)
    setAsignaciones(asigs)
    if (asigs.length>0) {
      const { data: sd } = await supabase.from('seguimiento_caminantes').select('id,asignacion_mesa_id,llamado,contesto').in('asignacion_mesa_id',asigs.map(a=>a.id))
      const sm: Record<string,Seguimiento> = {}; (sd??[]).forEach((s:any)=>{sm[s.asignacion_mesa_id]=s}); setSeguimientos(sm)
    }
    const { data: pd } = await supabase.from('pagos').select('persona_id').eq('retiro_id',RETIRO_ID).eq('tipo_persona','caminante').eq('estado','confirmado')
    const ids = [...new Set((pd??[]).map((p:any)=>p.persona_id))]
    const asigIds = new Set(asigs.map(a=>a.caminante_id))
    if (ids.length>0) {
      const { data: cd } = await supabase.from('caminantes').select('id,nombre,celular,edad,es_dificil,motivo_dificil').in('id',ids).eq('retiro_id',RETIRO_ID).order('edad')
      const todos: Caminante[] = cd??[]
      setSinAsignar(todos.filter(c=>!asigIds.has(c.id))); setCaminantesSinMesa(todos.filter(c=>!asigIds.has(c.id)))
    } else { setSinAsignar([]); setCaminantesSinMesa([]) }
    setLoadingCam(false)
  }, [])

  const cargarCuartos = useCallback(async () => {
    setLoadingCuartos(true)
    const { data: hd } = await supabase.from('habitaciones').select('*').eq('retiro_id',RETIRO_ID).order('piso').order('numero')
    setHabitaciones(hd??[])
    const { data: ad } = await supabase.from('asignaciones_habitacion').select('*').eq('retiro_id',RETIRO_ID)
    setAsignacionesHab(ad??[])
    const conCuarto = new Set((ad??[]).map((a:any)=>a.persona_id))
    const { data: pd } = await supabase.from('pagos').select('persona_id').eq('retiro_id',RETIRO_ID).eq('tipo_persona','caminante').eq('estado','confirmado')
    const idsCam = [...new Set((pd??[]).map((p:any)=>p.persona_id))]
    let lc: {id:string;nombre:string;tipo:'caminante'}[] = []
    if (idsCam.length>0) { const { data } = await supabase.from('caminantes').select('id,nombre').in('id',idsCam).eq('retiro_id',RETIRO_ID).order('nombre'); lc=(data??[]).map((c:any)=>({id:c.id,nombre:c.nombre,tipo:'caminante' as const})) }
    const { data: sd } = await supabase.from('servidores_inscripcion').select('id,nombre').eq('retiro_id',RETIRO_ID).eq('es_interno',true).order('nombre')
    const ls=(sd??[]).map((s:any)=>({id:s.id,nombre:s.nombre,tipo:'servidor' as const}))
    setSinCuarto([...ls,...lc].filter(p=>!conCuarto.has(p.id))); setLoadingCuartos(false)
  }, [])

  const syncHabitaciones = async () => {
    try {
      const { data: hd } = await supabase.from('habitaciones').select('*').eq('retiro_id',RETIRO_ID).order('piso').order('numero')
      const { data: ad } = await supabase.from('asignaciones_habitacion').select('*').eq('retiro_id',RETIRO_ID)
      await fetch(APPS_SCRIPT_HABITACIONES,{method:'POST',body:JSON.stringify({tipo:'actualizar_habitaciones',habitaciones:(hd??[]).map((h:Habitacion)=>({...h,asignaciones:(ad??[]).filter((a:any)=>a.habitacion_id===h.id)}))})})
    } catch(e){console.error(e)}
  }

  const syncMesas = async () => {
    try {
      const { data: ad } = await supabase.from('asignaciones_mesa').select('mesa_numero,mesa_id,caminantes(nombre,celular,edad)').order('mesa_numero')
      const { data: md } = await supabase.from('mesas').select('id,numero,adulto,lider,colider').eq('retiro_id',RETIRO_ID).order('numero')
      const mm: Record<string,Mesa> = {}; (md??[]).forEach((m:Mesa)=>{mm[m.id]=m})
      const pm: Record<number,{mesa:Mesa;caminantes:{nombre:string;celular:string;edad:number|null}[]}> = {}
      ;(ad??[]).forEach((a:any)=>{ if(!a.caminantes) return; if(!pm[a.mesa_numero]) pm[a.mesa_numero]={mesa:mm[a.mesa_id]??{numero:a.mesa_numero,adulto:'',lider:'',colider:'',id:''},caminantes:[]}; pm[a.mesa_numero].caminantes.push({nombre:a.caminantes.nombre,celular:a.caminantes.celular,edad:a.caminantes.edad}) })
      await fetch(APPS_SCRIPT_MESAS,{method:'POST',body:JSON.stringify({tipo:'actualizar_mesas',mesas:Object.values(pm)})})
    } catch(e){console.error(e)}
  }

  const quitarDeHab = async (id:string) => { await supabase.from('asignaciones_habitacion').delete().eq('id',id); await cargarCuartos(); await syncHabitaciones() }
  const agregarAHab = async (habId:string) => {
    const p=sinCuarto.find(x=>x.id===personaSel); if(!p) return
    await supabase.from('asignaciones_habitacion').insert({habitacion_id:habId,persona_id:p.id,tipo_persona:p.tipo,nombre:p.nombre,retiro_id:RETIRO_ID})
    setAgregandoAHab(null); setPersonaSel(''); await cargarCuartos(); await syncHabitaciones()
  }

  const confirmarTodas = async () => { setGuardandoCam(true); await supabase.from('asignaciones_mesa').update({confirmado_por_lider:true}).eq('confirmado_por_lider',false); await cargarCaminantes(); await syncMesas(); setExitoCam('Todas confirmadas'); setTimeout(()=>setExitoCam(''),2500); setGuardandoCam(false) }
  const desconfirmarTodas = async () => { setGuardandoCam(true); await supabase.from('asignaciones_mesa').update({confirmado_por_lider:false}).eq('confirmado_por_lider',true); await cargarCaminantes(); setExitoCam('Desconfirmadas'); setTimeout(()=>setExitoCam(''),3000); setGuardandoCam(false) }
  const cambiarMesa = async (asigId:string,mesa:Mesa) => { setGuardandoCam(true); await supabase.from('asignaciones_mesa').update({mesa_id:mesa.id,mesa_numero:mesa.numero,confirmado_por_lider:true}).eq('id',asigId); setEditandoCamId(null); await cargarCaminantes(); await syncMesas(); setGuardandoCam(false) }
  const quitarCaminante = async (id:string) => { await supabase.from('asignaciones_mesa').delete().eq('id',id); await cargarCaminantes(); await syncMesas() }
  const toggleSeg = async (asigId:string,campo:'llamado'|'contesto') => {
    const act=seguimientos[asigId]??{llamado:false,contesto:false}; const nv={...act,[campo]:!act[campo]}
    setSeguimientos(p=>({...p,[asigId]:{...nv,asignacion_mesa_id:asigId}}))
    const {data:ex}=await supabase.from('seguimiento_caminantes').select('id').eq('asignacion_mesa_id',asigId).single()
    if(ex?.id) await supabase.from('seguimiento_caminantes').update({[campo]:nv[campo],updated_at:new Date().toISOString()}).eq('id',ex.id)
    else await supabase.from('seguimiento_caminantes').insert({asignacion_mesa_id:asigId,llamado:nv.llamado,contesto:nv.contesto})
  }
  const agregarCamAMesa = async (mesaId:string,mesaNum:number,camId:string) => {
    if(!camId) return; setGuardandoCam(true)
    await supabase.from('asignaciones_mesa').insert({caminante_id:camId,mesa_id:mesaId,mesa_numero:mesaNum,sugerido_por_sistema:false,confirmado_por_lider:true})
    setAgregandoACam(null); setCamSel(''); await cargarCaminantes(); await syncMesas(); setGuardandoCam(false)
  }
  const iniciarEdicionDificil = (cam: Caminante | undefined | null) => {
    if (!cam) return
    setDificilEditId(cam.id)
    setMotivoDificil(cam.motivo_dificil ?? '')
  }
  const guardarDificil = async (camId: string) => {
    setGuardandoDificil(true)
    const motivo = motivoDificil.trim()
    await supabase.from('caminantes').update({ es_dificil: true, motivo_dificil: motivo || null }).eq('id', camId)
    setDificilEditId(null); setMotivoDificil('')
    await cargarCaminantes()
    setGuardandoDificil(false)
  }
  const quitarDificil = async (camId: string) => {
    setGuardandoDificil(true)
    await supabase.from('caminantes').update({ es_dificil: false, motivo_dificil: null }).eq('id', camId)
    setDificilEditId(null); setMotivoDificil('')
    await cargarCaminantes()
    setGuardandoDificil(false)
  }

  const iniciarEdicion = (r:RolRetiro) => { setEditandoId(r.id); setEditRol(r.rol); setEditEncargados(r.encargados.join(', ')) }
  const guardarEdicion = async (id:string) => {
    setGuardando(true)
    const enc=editEncargados.split(',').map(e=>e.trim()).filter(e=>e.length>0)
    const {error}=await supabase.from('roles_retiro').update({rol:editRol,encargados:enc}).eq('id',id)
    if(!error){setExito('Guardado');await cargarRoles();setEditandoId(null);setTimeout(()=>setExito(''),2000)}
    setGuardando(false)
  }
  const crearRol = async () => {
    if(!nuevoRolNombre.trim()) return; setGuardandoNuevo(true)
    const enc=nuevoRolEncargados.split(',').map(e=>e.trim()).filter(e=>e.length>0)
    const maxO=roles.length>0?Math.max(...roles.map(r=>r.orden)):0
    const {error}=await supabase.from('roles_retiro').insert({retiro_id:RETIRO_ID,categoria:nuevoRolCategoria,rol:nuevoRolNombre.trim(),encargados:enc,orden:maxO+1})
    if(!error){await cargarRoles();setCreandoRol(false);setNuevoRolNombre('');setNuevoRolEncargados('');setNuevoRolCategoria('General');setExito('Rol creado');setTimeout(()=>setExito(''),2000)}
    setGuardandoNuevo(false)
  }
  const iniciarEdicionMesa = (m:Mesa) => { setEditandoMesaId(m.id); setEditMesa({adulto:m.adulto??'',lider:m.lider??'',colider:m.colider??''}) }
  const guardarMesa = async (id:string) => {
    setGuardandoMesa(true)
    const {error}=await supabase.from('mesas').update({adulto:editMesa.adulto.trim(),lider:editMesa.lider.trim(),colider:editMesa.colider.trim()}).eq('id',id)
    if(!error){setExitoMesa('Guardado');await cargarMesas();setEditandoMesaId(null);setTimeout(()=>setExitoMesa(''),2500)}
    setGuardandoMesa(false)
  }

  const descargarPDFMesas = async () => {
    setGenerandoPDF(true)
    setErrorPDF('')
    try {
      const jsPDFCtor = await loadJsPDF()

      const { data: amData } = await supabase
        .from('asignaciones_mesa')
        .select('mesa_id,caminantes(id,nombre)')
        .eq('confirmado_por_lider', true)

      const { data: ahData } = await supabase
        .from('asignaciones_habitacion')
        .select('habitacion_id,persona_id,tipo_persona,nombre')
        .eq('retiro_id', RETIRO_ID)

      const { data: hData } = await supabase
        .from('habitaciones')
        .select('id,numero,bloque')
        .eq('retiro_id', RETIRO_ID)

      const habMap: Record<string,{numero:string;bloque:string}> = {}
      ;(hData ?? []).forEach((h: any) => { habMap[h.id] = { numero: String(h.numero), bloque: h.bloque } })

      const habPorCaminante: Record<string,{numero:string;bloque:string}> = {}
      const servidoresConHab: {nombre:string;numero:string;bloque:string}[] = []
      ;(ahData ?? []).forEach((a: any) => {
        const h = habMap[a.habitacion_id]
        if (!h) return
        if (a.tipo_persona === 'caminante') habPorCaminante[a.persona_id] = h
        else servidoresConHab.push({ nombre: a.nombre, ...h })
      })

      const buscarHabServidor = (nombre: string) => {
        if (!nombre?.trim()) return null
        const m = servidoresConHab.find(s => nombreMatch(nombre, s.nombre))
        return m ? { numero: m.numero, bloque: m.bloque } : null
      }

      const camsPorMesa: Record<string, { nombre: string; habitacion: string }[]> = {}
      ;(amData ?? []).forEach((a: any) => {
        if (!a.caminantes) return
        const h = habPorCaminante[a.caminantes.id]
        if (!camsPorMesa[a.mesa_id]) camsPorMesa[a.mesa_id] = []
        camsPorMesa[a.mesa_id].push({ nombre: a.caminantes.nombre, habitacion: h ? `Hab. ${h.numero} (${h.bloque})` : 'Sin cuarto asignado' })
      })

      const doc = new jsPDFCtor({ unit: 'pt', format: 'letter' })
      const navy: [number, number, number] = [15, 23, 135]

      mesas.forEach((mesa, idx) => {
        if (idx > 0) doc.addPage()
        let y = 50

        doc.setFont('helvetica', 'bold')
        doc.setFontSize(9)
        doc.setTextColor(107, 114, 128)
        doc.text('EFFETÁ MAZUREN — IX RETIRO · 3-5 JULIO 2026', 40, y)
        y += 30

        doc.setFontSize(22)
        doc.setTextColor(navy[0], navy[1], navy[2])
        doc.text(`Mesa ${mesa.numero}`, 40, y)
        y += 20

        doc.setDrawColor(232, 234, 240)
        doc.line(40, y, 570, y)
        y += 28

        doc.setFontSize(10)
        doc.setTextColor(107, 114, 128)
        doc.setFont('helvetica', 'bold')
        doc.text('LÍDERES', 40, y)
        y += 20

        const filaLider = (label: string, nombre: string) => {
          if (!nombre?.trim()) return
          const hab = buscarHabServidor(nombre)
          doc.setFontSize(12)
          doc.setTextColor(17, 24, 39)
          doc.setFont('helvetica', 'bold')
          doc.text(`${label}:`, 40, y)
          doc.setFont('helvetica', 'normal')
          doc.text(nombre, 115, y)
          doc.setFontSize(10)
          doc.setTextColor(107, 114, 128)
          doc.text(hab ? `Hab. ${hab.numero} (${hab.bloque})` : 'Sin cuarto asignado', 380, y)
          y += 22
        }
        filaLider('Adulto', mesa.adulto)
        filaLider('Líder', mesa.lider)
        filaLider('Co-líder', mesa.colider)

        y += 12
        doc.setDrawColor(232, 234, 240)
        doc.line(40, y, 570, y)
        y += 28

        const cams = camsPorMesa[mesa.id] ?? []
        doc.setFontSize(10)
        doc.setTextColor(107, 114, 128)
        doc.setFont('helvetica', 'bold')
        doc.text(`CAMINANTES (${cams.length})`, 40, y)
        y += 22

        if (cams.length === 0) {
          doc.setFontSize(12)
          doc.setTextColor(156, 163, 175)
          doc.setFont('helvetica', 'italic')
          doc.text('Sin caminantes confirmados', 40, y)
        } else {
          cams.forEach((c, i) => {
            if (y > 730) { doc.addPage(); y = 50 }
            doc.setFontSize(12)
            doc.setTextColor(17, 24, 39)
            doc.setFont('helvetica', 'normal')
            doc.text(`${i + 1}. ${c.nombre}`, 40, y)
            doc.setFontSize(10)
            doc.setTextColor(107, 114, 128)
            doc.text(c.habitacion, 380, y)
            y += 20
          })
        }
      })

      doc.save(`Mesas_IX_Retiro_Effeta_${new Date().toISOString().slice(0,10)}.pdf`)
    } catch (e) {
      console.error(e)
      setErrorPDF('No se pudo generar el PDF. Intenta de nuevo.')
    } finally {
      setGenerandoPDF(false)
    }
  }

  // Derivados
  const bL=busqueda.toLowerCase()
  const resBus=busqueda.length>1?roles.filter(r=>r.encargados.some(e=>e.toLowerCase().includes(bL))):[]
  const cats=[...new Set(roles.map(r=>r.categoria))]
  const rpMap: Record<string,{d:string;c:number}>= {}
  roles.forEach(r=>r.encargados.forEach(e=>{const k=norm(e);if(!rpMap[k])rpMap[k]={d:e,c:0};rpMap[k].c++}))
  const rp: Record<string,number>=Object.fromEntries(Object.entries(rpMap).map(([,v])=>[v.d,v.c]))
  const pFilt=filtroRolesNum!==null?Object.entries(rp).filter(([,c])=>filtroRolesModo==='exacto'?c===filtroRolesNum:filtroRolesModo==='mas'?c>=filtroRolesNum!:c<=filtroRolesNum!).sort((a,b)=>b[1]-a[1]):[]
  const bCL=busquedaCam.toLowerCase()
  const asigFilt=busquedaCam.length>1?asignaciones.filter(a=>a.caminante?.nombre?.toLowerCase().includes(bCL)):asignaciones
  const aPM: Record<number,Asignacion[]>={}
  asigFilt.forEach(a=>{if(!aPM[a.mesa_numero])aPM[a.mesa_numero]=[];aPM[a.mesa_numero].push(a)})
  const casosDificiles = [
    ...asignaciones.filter(a=>a.caminante?.es_dificil).map(a=>({id:a.caminante.id,nombre:a.caminante.nombre,celular:a.caminante.celular,motivo:a.caminante.motivo_dificil,mesa:a.mesa_numero as number|null})),
    ...sinAsignar.filter(c=>c.es_dificil).map(c=>({id:c.id,nombre:c.nombre,celular:c.celular,motivo:c.motivo_dificil,mesa:null as number|null})),
  ]
  const bCuL=busquedaCuartos.toLowerCase()
  const habFilt=habitaciones.filter(h=>{
    if(filtroPiso!==null&&h.piso!==filtroPiso) return false
    const asigs=asignacionesHab.filter(a=>a.habitacion_id===h.id)
    if(filtroTipo==='libre'&&asigs.length>0) return false
    if(filtroTipo==='caminante'&&!asigs.some(a=>a.tipo_persona==='caminante')) return false
    if(filtroTipo==='servidor'&&!asigs.some(a=>a.tipo_persona==='servidor')) return false
    if(busquedaCuartos.length>1) return h.numero.toLowerCase().includes(bCuL)||h.bloque.toLowerCase().includes(bCuL)||asigs.some(a=>a.nombre.toLowerCase().includes(bCuL))
    return true
  })
  const bloquesCuartos=[...new Set(habFilt.map(h=>h.bloque))]
  const totAsig=asignacionesHab.length, totSrv=asignacionesHab.filter(a=>a.tipo_persona==='servidor').length, totCam=asignacionesHab.filter(a=>a.tipo_persona==='caminante').length

  const tabs: {id:Tab;label:string}[] = [{id:'minutominuto',label:'Minuto a Minuto'},{id:'roles',label:'Roles'},{id:'mesas',label:'Mesas'},{id:'caminantes',label:'Caminantes'},{id:'cuartos',label:'Cuartos'},{id:'manual',label:'Manual'}]
  const dias: {id:Dia;label:string;fecha:string}[] = [{id:'viernes',label:'Viernes',fecha:'3 Jul'},{id:'sabado',label:'Sábado',fecha:'4 Jul'},{id:'domingo',label:'Domingo',fecha:'5 Jul'}]

  const Spinner = () => <div style={{display:'flex',justifyContent:'center',padding:40}}><div style={{width:28,height:28,border:'3px solid #e2e4f0',borderTopColor:'#0f1787',borderRadius:'50%',animation:'spin 0.8s linear infinite'}}/></div>

  return (
    <div style={{padding:'24px 16px',maxWidth:700,margin:'0 auto',paddingBottom:40}}>
      <style>{`@keyframes spin{to{transform:rotate(360deg)}}`}</style>
      <div style={{display:'flex',alignItems:'center',justifyContent:'space-between',marginBottom:24}}>
        <div>
          <h1 style={{fontSize:20,fontWeight:700,color:'#111827',margin:'0 0 4px'}}>IX Retiro Effeta Mazuren</h1>
          <p style={{fontSize:13,color:'#6b7280',margin:0}}>3, 4 y 5 de julio de 2026</p>
        </div>
        <button onClick={()=>router.push('/dashboard')} style={{background:'#f3f4f6',border:'none',borderRadius:8,padding:'8px 14px',fontSize:13,cursor:'pointer',color:'#374151'}}>← Dashboard</button>
      </div>

      <div style={{display:'flex',gap:4,marginBottom:24,background:'#f3f4f6',borderRadius:10,padding:4,overflowX:'auto'}}>
        {tabs.map(t=><button key={t.id} onClick={()=>setTab(t.id)} style={{flex:1,minWidth:60,padding:'8px 4px',border:'none',borderRadius:8,fontSize:10,fontWeight:600,cursor:'pointer',background:tab===t.id?'#0f1787':'transparent',color:tab===t.id?'white':'#6b7280',whiteSpace:'nowrap'}}>{t.label}</button>)}
      </div>

      {/* ══ MINUTO A MINUTO ══ */}
      {tab==='minutominuto' && (
        <div>
          <div style={{display:'flex',gap:8,marginBottom:16}}>
            {dias.map(d=><button key={d.id} onClick={()=>setDiaActivo(d.id)} style={{flex:1,padding:'10px 8px',border:'none',borderRadius:10,cursor:'pointer',background:diaActivo===d.id?'#0f1787':'white',color:diaActivo===d.id?'white':'#374151',outline:diaActivo===d.id?'none':'1.5px solid #e8eaf0',fontWeight:600,fontSize:12}}>
              <div>{d.label}</div><div style={{fontSize:11,opacity:.7,fontWeight:400}}>{d.fecha}</div>
            </button>)}
          </div>

          <div style={{display:'flex',alignItems:'center',justifyContent:'space-between',marginBottom:14}}>
            <span style={{fontSize:12,color:'#16a34a',fontWeight:600}}>{exitoMM?`✓ ${exitoMM}`:''}</span>
            {!modoEdicionMM
              ? <button onClick={()=>{setModoEdicionMM(true);setDiaEdicion(diaActivo);setParsePreview([])}} style={{padding:'7px 14px',background:'#f0f2ff',color:'#0f1787',border:'1.5px solid #c7d0ff',borderRadius:8,fontSize:12,fontWeight:600,cursor:'pointer'}}>Editar {diaActivo}</button>
              : <button onClick={()=>{setModoEdicionMM(false);setParsePreview([])}} style={{padding:'7px 14px',background:'#f3f4f6',color:'#6b7280',border:'none',borderRadius:8,fontSize:12,cursor:'pointer'}}>Cancelar</button>
            }
          </div>

          {modoEdicionMM && (
            <div style={{background:'white',border:'1.5px solid #c7d0ff',borderRadius:14,padding:'18px',marginBottom:20}}>
              <p style={{fontSize:13,fontWeight:700,color:'#0f1787',margin:'0 0 6px'}}>Editar horario — {diaEdicion.charAt(0).toUpperCase()+diaEdicion.slice(1)}</p>
              <p style={{fontSize:11,color:'#9ca3af',margin:'0 0 14px',lineHeight:1.6}}>
                Pega el horario. Línea en MAYÚSCULAS = nuevo bloque.<br/>
                Formato: <code style={{background:'#f3f4f6',padding:'1px 6px',borderRadius:4}}>* 6;15pm actividad</code> &nbsp;|&nbsp; encargado opcional separado por <code style={{background:'#f3f4f6',padding:'1px 6px',borderRadius:4}}>|</code>
              </p>
              <div style={{display:'flex',gap:6,marginBottom:12}}>
                {dias.map(d=><button key={d.id} onClick={()=>{setDiaEdicion(d.id);setParsePreview([])}} style={{flex:1,padding:'6px 4px',border:'none',borderRadius:8,cursor:'pointer',fontSize:11,fontWeight:600,background:diaEdicion===d.id?'#0f1787':'#f3f4f6',color:diaEdicion===d.id?'white':'#6b7280'}}>{d.label}</button>)}
              </div>
              <textarea
                value={textoDia[diaEdicion]}
                onChange={e=>{setTextoDia(p=>({...p,[diaEdicion]:e.target.value}));setParsePreview([])}}
                placeholder={'VIERNES NOCHE\n\n* 6;15pm tocar campana\n* 6;20pm asignación mesas\n* 6;35pm ejercicio de la luz\n* 6;40pm cena'}
                rows={14}
                style={{width:'100%',border:'1.5px solid #e8eaf0',borderRadius:10,padding:'10px 12px',fontSize:12,color:'#374151',outline:'none',resize:'vertical',fontFamily:'monospace',lineHeight:1.7,boxSizing:'border-box',background:'#fafafa'}}
              />
              <div style={{display:'flex',gap:8,marginTop:12}}>
                <button onClick={()=>setParsePreview(parsearTextoMM(textoDia[diaEdicion]))} disabled={!textoDia[diaEdicion].trim()} style={{flex:1,padding:'10px',background:textoDia[diaEdicion].trim()?'#f0f2ff':'#f3f4f6',color:textoDia[diaEdicion].trim()?'#0f1787':'#9ca3af',border:'1.5px solid #c7d0ff',borderRadius:10,fontSize:13,fontWeight:600,cursor:'pointer'}}>Vista previa</button>
                <button onClick={async()=>{const p=parsePreview.length>0?parsePreview:parsearTextoMM(textoDia[diaEdicion]);await guardarDiaMM(diaEdicion,p)}} disabled={guardandoMM||!textoDia[diaEdicion].trim()} style={{flex:1,padding:'10px',background:guardandoMM||!textoDia[diaEdicion].trim()?'#9ca3af':'#0f1787',color:'white',border:'none',borderRadius:10,fontSize:13,fontWeight:600,cursor:'pointer'}}>{guardandoMM?'Guardando…':'Guardar'}</button>
              </div>
              {parsePreview.length>0 && (
                <div style={{marginTop:16,borderTop:'1px solid #e8eaf0',paddingTop:14}}>
                  <p style={{fontSize:11,fontWeight:700,color:'#6b7280',margin:'0 0 10px',textTransform:'uppercase',letterSpacing:.5}}>Vista previa — {parsePreview.reduce((s,b)=>s+b.items.length,0)} actividades en {parsePreview.length} bloque{parsePreview.length!==1?'s':''}</p>
                  {parsePreview.map((b,bi)=>(
                    <div key={bi} style={{marginBottom:12}}>
                      <div style={{fontSize:11,fontWeight:700,color:'#0f1787',textTransform:'uppercase',letterSpacing:1,marginBottom:6}}>{b.titulo}{b.camiseta&&<span style={{fontSize:10,fontWeight:400,color:'#92400e',background:'#fef3c7',padding:'1px 7px',borderRadius:20,marginLeft:8,textTransform:'none',letterSpacing:0}}>{b.camiseta}</span>}</div>
                      {b.items.map((it,idx)=>{const cl=it.tipo?colorTipoMM[it.tipo]:colorTipoMM.logistica;return(
                        <div key={idx} style={{display:'flex',gap:8,padding:'6px 10px',background:'#f7f8fc',borderRadius:8,marginBottom:4,alignItems:'center'}}>
                          <span style={{fontSize:11,fontWeight:700,color:'#0f1787',minWidth:60,flexShrink:0}}>{it.hora}</span>
                          <span style={{fontSize:12,color:'#111827',flex:1}}>{it.actividad}</span>
                          {it.tipo&&<span style={{fontSize:9,padding:'2px 6px',borderRadius:20,fontWeight:700,background:cl.bg,color:cl.color,flexShrink:0}}>{cl.label}</span>}
                        </div>
                      )})}
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {loadingMM ? <Spinner/> : mmPorDia[diaActivo].length===0 ? (
            <div style={{background:'white',border:'1.5px solid #e8eaf0',borderRadius:14,padding:'40px 24px',textAlign:'center'}}>
              <p style={{fontSize:15,fontWeight:600,color:'#111827',margin:'0 0 6px'}}>Sin horario para este día</p>
              <p style={{fontSize:13,color:'#6b7280',margin:0}}>Haz clic en "Editar {diaActivo}" y pega el horario.</p>
            </div>
          ) : mmPorDia[diaActivo].map((bloque,bi)=>(
            <div key={bi} style={{marginBottom:24}}>
              <div style={{display:'flex',alignItems:'center',gap:10,marginBottom:10}}>
                <h3 style={{fontSize:13,fontWeight:700,color:'#0f1787',margin:0,textTransform:'uppercase',letterSpacing:1}}>{bloque.titulo}</h3>
                {bloque.camiseta&&<span style={{fontSize:11,background:'#fef3c7',color:'#92400e',padding:'2px 8px',borderRadius:20}}>{bloque.camiseta}</span>}
              </div>
              <div style={{display:'flex',flexDirection:'column',gap:6}}>
                {bloque.items.map((item,idx)=>{
                  const key=`${bi}-${idx}`,ab=expandido===key,cl=item.tipo?colorTipoMM[item.tipo]:colorTipoMM.logistica,ec=item.tipo==='charla'
                  return(
                    <div key={idx} style={{background:'white',border:ec?'2px solid #dc2626':'1.5px solid #e8eaf0',borderRadius:10,overflow:'hidden'}}>
                      <button onClick={()=>setExpandido(ab?null:key)} style={{width:'100%',display:'flex',alignItems:'center',gap:10,padding:'10px 12px',background:'none',border:'none',cursor:'pointer',textAlign:'left'}}>
                        <span style={{fontSize:12,fontWeight:700,color:'#0f1787',minWidth:64,flexShrink:0}}>{item.hora}</span>
                        <span style={{fontSize:13,fontWeight:ec?700:500,color:'#111827',flex:1}}>{item.actividad}</span>
                        {item.tipo&&<span style={{fontSize:10,padding:'2px 7px',borderRadius:20,fontWeight:600,flexShrink:0,background:cl.bg,color:cl.color}}>{cl.label}</span>}
                        <span style={{fontSize:12,color:'#9ca3af',flexShrink:0}}>{ab?'▲':'▼'}</span>
                      </button>
                      {ab&&(
                        <div style={{padding:'0 12px 12px',borderTop:'1px solid #f3f4f6'}}>
                          {item.encargado&&<p style={{fontSize:12,color:'#0f1787',fontWeight:600,margin:'8px 0 4px'}}>Encargado: {item.encargado}</p>}
                          {item.detalle&&<p style={{fontSize:12,color:'#374151',margin:0,lineHeight:1.6}}>{item.detalle}</p>}
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

      {/* ══ ROLES ══ */}
      {tab==='roles' && (
        <div>
          {exito&&<div style={{background:'#f0fdf4',border:'1px solid #bbf7d0',borderRadius:8,padding:'8px 14px',marginBottom:12,fontSize:13,color:'#16a34a'}}>✓ {exito}</div>}
          {!creandoRol&&<button onClick={()=>setCreandoRol(true)} style={{width:'100%',padding:'10px',background:'#f0f2ff',color:'#0f1787',border:'1.5px dashed #c7d0ff',borderRadius:10,fontSize:13,fontWeight:600,cursor:'pointer',marginBottom:16}}>+ Nuevo rol</button>}
          {creandoRol&&(
            <div style={{background:'white',border:'1.5px solid #c7d0ff',borderRadius:12,padding:'16px',marginBottom:16}}>
              <p style={{fontSize:13,fontWeight:700,color:'#0f1787',margin:'0 0 14px'}}>Nuevo rol</p>
              <div style={{display:'flex',flexDirection:'column',gap:10,marginBottom:14}}>
                <div><label style={{fontSize:11,fontWeight:600,color:'#6b7280',display:'block',marginBottom:4}}>CATEGORÍA</label>
                  <select value={nuevoRolCategoria} onChange={e=>setNuevoRolCategoria(e.target.value)} style={{width:'100%',padding:'8px 10px',border:'1.5px solid #e8eaf0',borderRadius:8,fontSize:13,outline:'none',boxSizing:'border-box',fontFamily:'inherit',background:'white'}}>
                    <option>General</option><option>Actividades Generales</option><option>Muro y Nudo</option>
                  </select></div>
                <div><label style={{fontSize:11,fontWeight:600,color:'#6b7280',display:'block',marginBottom:4}}>NOMBRE DEL ROL</label><input value={nuevoRolNombre} onChange={e=>setNuevoRolNombre(e.target.value)} placeholder="Ej: Campanero" style={{width:'100%',padding:'8px 10px',border:'1.5px solid #e8eaf0',borderRadius:8,fontSize:13,outline:'none',boxSizing:'border-box',fontFamily:'inherit'}}/></div>
                <div><label style={{fontSize:11,fontWeight:600,color:'#6b7280',display:'block',marginBottom:4}}>ENCARGADOS (separados por coma)</label><textarea value={nuevoRolEncargados} onChange={e=>setNuevoRolEncargados(e.target.value)} rows={3} placeholder="Ej: Juan Pérez, María García" style={{width:'100%',padding:'8px 10px',border:'1.5px solid #e8eaf0',borderRadius:8,fontSize:13,outline:'none',boxSizing:'border-box',fontFamily:'inherit',resize:'vertical'}}/></div>
              </div>
              <div style={{display:'flex',gap:8}}>
                <button onClick={crearRol} disabled={guardandoNuevo||!nuevoRolNombre.trim()} style={{flex:1,padding:'9px',background:guardandoNuevo||!nuevoRolNombre.trim()?'#9ca3af':'#0f1787',color:'white',border:'none',borderRadius:8,fontSize:13,fontWeight:600,cursor:'pointer'}}>{guardandoNuevo?'Guardando...':'Crear rol'}</button>
                <button onClick={()=>{setCreandoRol(false);setNuevoRolNombre('');setNuevoRolEncargados('')}} style={{padding:'9px 14px',background:'#f3f4f6',color:'#374151',border:'none',borderRadius:8,fontSize:13,cursor:'pointer'}}>Cancelar</button>
              </div>
            </div>
          )}
          <div style={{background:'white',border:'1.5px solid #e8eaf0',borderRadius:12,padding:'14px',marginBottom:16}}>
            <p style={{fontSize:11,fontWeight:700,color:'#6b7280',margin:'0 0 10px',textTransform:'uppercase',letterSpacing:.5}}>Filtrar por cantidad de roles</p>
            <div style={{display:'flex',gap:6,flexWrap:'wrap',marginBottom:10}}>
              {(['exacto','mas','menos'] as const).map(m=><button key={m} onClick={()=>setFiltroRolesModo(m)} style={{padding:'4px 10px',borderRadius:20,border:'none',cursor:'pointer',fontSize:11,fontWeight:600,background:filtroRolesModo===m?'#0f1787':'#f3f4f6',color:filtroRolesModo===m?'white':'#6b7280'}}>{m==='exacto'?'Exactamente':m==='mas'?'Al menos':'Máximo'}</button>)}
            </div>
            <div style={{display:'flex',gap:8,alignItems:'center'}}>
              <input type="number" min={1} max={20} value={filtroRolesNum??''} placeholder="# roles" onChange={e=>setFiltroRolesNum(e.target.value?parseInt(e.target.value):null)} style={{width:80,padding:'7px 10px',border:'1.5px solid #e8eaf0',borderRadius:8,fontSize:13,outline:'none',fontFamily:'inherit'}}/>
              <span style={{fontSize:13,color:'#6b7280'}}>roles</span>
              {filtroRolesNum!==null&&<button onClick={()=>setFiltroRolesNum(null)} style={{marginLeft:'auto',padding:'4px 10px',background:'#f3f4f6',color:'#6b7280',border:'none',borderRadius:8,fontSize:11,cursor:'pointer'}}>Limpiar</button>}
            </div>
            {filtroRolesNum!==null&&(
              <div style={{marginTop:12}}>
                {pFilt.length===0?<p style={{fontSize:13,color:'#9ca3af',margin:0,fontStyle:'italic'}}>Nadie tiene ese número de roles</p>:(
                  <><p style={{fontSize:11,color:'#6b7280',margin:'0 0 8px',fontWeight:600}}>{pFilt.length} persona{pFilt.length!==1?'s':''}</p>
                  <div style={{display:'flex',flexDirection:'column',gap:6}}>
                    {pFilt.map(([n,c])=>{const sr=roles.filter(r=>r.encargados.some(e=>nombreMatch(n,e)));return(
                      <div key={n} style={{background:'#f7f8fc',borderRadius:8,padding:'8px 12px'}}>
                        <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',marginBottom:4}}>
                          <span style={{fontSize:13,fontWeight:600,color:'#111827'}}>{n}</span>
                          <span style={{fontSize:11,background:'#0f1787',color:'white',padding:'2px 8px',borderRadius:20,fontWeight:700}}>{c} roles</span>
                        </div>
                        <div style={{display:'flex',flexWrap:'wrap',gap:4}}>{sr.map((r,i)=><span key={i} style={{fontSize:10,background:'#e8eaf0',color:'#374151',padding:'1px 7px',borderRadius:20}}>{r.rol}</span>)}</div>
                      </div>
                    )})}
                  </div></>
                )}
              </div>
            )}
          </div>
          <div style={{position:'relative',marginBottom:20}}>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#9ca3af" strokeWidth="2" strokeLinecap="round" style={{position:'absolute',left:12,top:'50%',transform:'translateY(-50%)'}}><circle cx="11" cy="11" r="8"/><path d="m21 21-4.35-4.35"/></svg>
            <input type="text" placeholder="Buscar servidor por nombre..." value={busqueda} onChange={e=>setBusqueda(e.target.value)} style={{width:'100%',padding:'10px 12px 10px 36px',border:'1.5px solid #e8eaf0',borderRadius:10,fontSize:14,outline:'none',boxSizing:'border-box',background:'white',fontFamily:'inherit'}}/>
            {busqueda&&<button onClick={()=>setBusqueda('')} style={{position:'absolute',right:10,top:'50%',transform:'translateY(-50%)',background:'none',border:'none',cursor:'pointer',color:'#9ca3af',fontSize:16}}>✕</button>}
          </div>
          {busqueda.length>1&&(
            <div style={{marginBottom:20}}>
              {resBus.length===0?<div style={{background:'white',border:'1.5px solid #e8eaf0',borderRadius:10,padding:'20px',textAlign:'center',color:'#9ca3af',fontSize:13}}>No se encontró ningún servidor con ese nombre</div>:(
                <div style={{display:'flex',flexDirection:'column',gap:8}}>
                  <p style={{fontSize:12,fontWeight:600,color:'#6b7280',margin:'0 0 6px',textTransform:'uppercase',letterSpacing:1}}>{resBus.length} resultado{resBus.length!==1?'s':''}</p>
                  {resBus.map(r=>{const c=CATEGORIAS_COLOR[r.categoria]??{border:'#6b7280',badge:'#f3f4f6',text:'#374151'};return(
                    <div key={r.id} style={{background:'white',border:'1.5px solid #e8eaf0',borderRadius:10,padding:'12px 14px',borderLeft:`3px solid ${c.border}`}}>
                      <span style={{fontSize:10,background:c.badge,color:c.text,padding:'2px 7px',borderRadius:20,fontWeight:600}}>{r.categoria}</span>
                      <p style={{fontSize:13,fontWeight:700,color:'#111827',margin:'4px 0 6px'}}>{r.rol}</p>
                      <div style={{display:'flex',flexWrap:'wrap',gap:4}}>{r.encargados.filter(e=>e.toLowerCase().includes(bL)).map((e,i)=><span key={i} style={{fontSize:11,background:'#fef3c7',color:'#92400e',padding:'2px 8px',borderRadius:20,fontWeight:600}}>{e}</span>)}</div>
                    </div>
                  )})}
                </div>
              )}
            </div>
          )}
          {busqueda.length<=1&&(
            loadingRoles?<Spinner/>:(
              <div style={{display:'flex',flexDirection:'column',gap:24}}>
                {cats.map(cat=>{const c=CATEGORIAS_COLOR[cat]??{border:'#6b7280',badge:'#f3f4f6',text:'#374151'};return(
                  <div key={cat}>
                    <h3 style={{fontSize:12,fontWeight:700,textTransform:'uppercase',letterSpacing:1,color:c.text,margin:'0 0 10px'}}>{cat}</h3>
                    <div style={{display:'flex',flexDirection:'column',gap:8}}>
                      {roles.filter(r=>r.categoria===cat).map(rol=>(
                        <div key={rol.id} style={{background:'white',border:'1.5px solid #e8eaf0',borderRadius:10,overflow:'hidden',borderLeft:`3px solid ${c.border}`}}>
                          {editandoId===rol.id?(
                            <div style={{padding:'14px'}}>
                              <div style={{marginBottom:10}}><label style={{fontSize:11,fontWeight:600,color:'#6b7280',display:'block',marginBottom:4}}>NOMBRE DEL ROL</label><input value={editRol} onChange={e=>setEditRol(e.target.value)} style={{width:'100%',padding:'8px 10px',border:'1.5px solid #e8eaf0',borderRadius:8,fontSize:13,outline:'none',boxSizing:'border-box',fontFamily:'inherit'}}/></div>
                              <div style={{marginBottom:12}}><label style={{fontSize:11,fontWeight:600,color:'#6b7280',display:'block',marginBottom:4}}>ENCARGADOS (separados por coma)</label><textarea value={editEncargados} onChange={e=>setEditEncargados(e.target.value)} rows={3} style={{width:'100%',padding:'8px 10px',border:'1.5px solid #e8eaf0',borderRadius:8,fontSize:13,outline:'none',boxSizing:'border-box',fontFamily:'inherit',resize:'vertical'}}/></div>
                              <div style={{display:'flex',gap:8}}>
                                <button onClick={()=>guardarEdicion(rol.id)} disabled={guardando} style={{flex:1,padding:'8px',background:guardando?'#9ca3af':'#0f1787',color:'white',border:'none',borderRadius:8,fontSize:13,fontWeight:600,cursor:'pointer'}}>{guardando?'Guardando...':'Guardar'}</button>
                                <button onClick={()=>setEditandoId(null)} style={{padding:'8px 14px',background:'#f3f4f6',color:'#374151',border:'none',borderRadius:8,fontSize:13,cursor:'pointer'}}>Cancelar</button>
                              </div>
                            </div>
                          ):(
                            <div style={{padding:'12px 14px',display:'flex',alignItems:'flex-start',justifyContent:'space-between',gap:10}}>
                              <div style={{flex:1}}>
                                <p style={{fontSize:13,fontWeight:700,color:'#111827',margin:'0 0 6px'}}>{rol.rol}</p>
                                <div style={{display:'flex',flexWrap:'wrap',gap:4}}>{rol.encargados.map((e,i)=><span key={i} style={{fontSize:11,background:'#f3f4f6',color:'#374151',padding:'2px 8px',borderRadius:20}}>{e}</span>)}</div>
                              </div>
                              <button onClick={()=>iniciarEdicion(rol)} style={{padding:'6px 10px',background:'#f0f2ff',color:'#0f1787',border:'none',borderRadius:8,fontSize:11,fontWeight:600,cursor:'pointer',flexShrink:0}}>Editar</button>
                            </div>
                          )}
                        </div>
                      ))}
                    </div>
                  </div>
                )})}
              </div>
            )
          )}
          <div style={{marginTop:32}}>
            <div style={{display:'flex',alignItems:'center',justifyContent:'space-between',marginBottom:12}}>
              <div>
                <h3 style={{fontSize:12,fontWeight:700,color:'#7c3aed',margin:'0 0 2px',textTransform:'uppercase',letterSpacing:1}}>Acceso Palancas Líder</h3>
                <p style={{fontSize:12,color:'#9ca3af',margin:0}}>Servidores que pueden ver todo el seguimiento de palancas</p>
              </div>
              {exitoPL&&<span style={{fontSize:12,color:'#16a34a',fontWeight:600}}>✓ {exitoPL}</span>}
            </div>
            {loadingPL?<Spinner/>:(
              <div style={{display:'flex',flexDirection:'column',gap:6}}>
                {servidoresList.map(srv=>(
                  <div key={srv.id} style={{display:'flex',alignItems:'center',justifyContent:'space-between',padding:'10px 14px',background:srv.palancas_lider?'#faf5ff':'white',border:`1.5px solid ${srv.palancas_lider?'#d8b4fe':'#e8eaf0'}`,borderRadius:10}}>
                    <div style={{display:'flex',alignItems:'center',gap:10}}>
                      {srv.palancas_lider&&<div style={{width:8,height:8,borderRadius:'50%',background:'#7c3aed',flexShrink:0}}/>}
                      <span style={{fontSize:13,fontWeight:srv.palancas_lider?600:400,color:srv.palancas_lider?'#6d28d9':'#374151'}}>{srv.nombre}</span>
                    </div>
                    <button onClick={async()=>{const nv=!srv.palancas_lider;await supabase.from('servidores_inscripcion').update({palancas_lider:nv}).eq('id',srv.id);setServidoresList(p=>p.map(s=>s.id===srv.id?{...s,palancas_lider:nv}:s));setExitoPL(nv?`Acceso dado a ${srv.nombre.split(' ')[0]}`:`Acceso quitado a ${srv.nombre.split(' ')[0]}`);setTimeout(()=>setExitoPL(''),2500)}} style={{padding:'5px 12px',borderRadius:8,border:'none',cursor:'pointer',fontSize:12,fontWeight:600,background:srv.palancas_lider?'#fef2f2':'#f0fdf4',color:srv.palancas_lider?'#dc2626':'#16a34a'}}>
                      {srv.palancas_lider?'Quitar acceso':'Dar acceso'}
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {/* ══ MESAS ══ */}
      {tab==='mesas'&&(
        <div>
          {exitoMesa&&<div style={{background:'#f0fdf4',border:'1px solid #bbf7d0',borderRadius:8,padding:'8px 14px',marginBottom:12,fontSize:13,color:'#16a34a'}}>✓ Mesa actualizada correctamente</div>}
          {errorPDF&&<div style={{background:'#fef2f2',border:'1px solid #fecaca',borderRadius:8,padding:'8px 14px',marginBottom:12,fontSize:13,color:'#dc2626'}}>{errorPDF}</div>}
          {!loadingMesas && mesas.length>0 && (
            <button onClick={descargarPDFMesas} disabled={generandoPDF} style={{width:'100%',padding:'12px',background:generandoPDF?'#9ca3af':'#0f1787',color:'white',border:'none',borderRadius:12,fontSize:14,fontWeight:600,cursor:'pointer',marginBottom:16,display:'flex',alignItems:'center',justifyContent:'center',gap:8}}>
              {generandoPDF?'Generando PDF...':'📄 Descargar PDF por mesa (líderes, caminantes y cuartos)'}
            </button>
          )}
          {loadingMesas?<Spinner/>:(
            <div style={{display:'flex',flexDirection:'column',gap:10}}>
              {mesas.map(mesa=>(
                <div key={mesa.id} style={{background:'white',border:'1.5px solid #e8eaf0',borderRadius:12,overflow:'hidden',borderLeft:'3px solid #0f1787'}}>
                  {editandoMesaId===mesa.id?(
                    <div style={{padding:'14px'}}>
                      <p style={{fontSize:13,fontWeight:700,color:'#0f1787',margin:'0 0 14px'}}>Mesa {mesa.numero}</p>
                      <div style={{display:'flex',flexDirection:'column',gap:10,marginBottom:14}}>
                        {[{key:'adulto',label:'LÍDER ADULTO'},{key:'lider',label:'LÍDER JOVEN'},{key:'colider',label:'CO-LÍDER'}].map(f=>(
                          <div key={f.key}><label style={{fontSize:11,fontWeight:600,color:'#6b7280',display:'block',marginBottom:4}}>{f.label}</label><input value={editMesa[f.key as keyof typeof editMesa]} onChange={e=>setEditMesa(p=>({...p,[f.key]:e.target.value}))} style={{width:'100%',padding:'8px 10px',border:'1.5px solid #e8eaf0',borderRadius:8,fontSize:13,outline:'none',boxSizing:'border-box',fontFamily:'inherit'}}/></div>
                        ))}
                      </div>
                      <div style={{display:'flex',gap:8}}>
                        <button onClick={()=>guardarMesa(mesa.id)} disabled={guardandoMesa} style={{flex:1,padding:'9px',background:guardandoMesa?'#9ca3af':'#0f1787',color:'white',border:'none',borderRadius:8,fontSize:13,fontWeight:600,cursor:'pointer'}}>{guardandoMesa?'Guardando...':'Guardar'}</button>
                        <button onClick={()=>setEditandoMesaId(null)} style={{padding:'9px 14px',background:'#f3f4f6',color:'#374151',border:'none',borderRadius:8,fontSize:13,cursor:'pointer'}}>Cancelar</button>
                      </div>
                    </div>
                  ):(
                    <div style={{padding:'12px 14px',display:'flex',alignItems:'flex-start',justifyContent:'space-between',gap:10}}>
                      <div style={{flex:1}}>
                        <div style={{display:'flex',alignItems:'center',gap:8,marginBottom:8}}>
                          <div style={{width:28,height:28,borderRadius:8,background:'#0f1787',display:'flex',alignItems:'center',justifyContent:'center',fontSize:13,fontWeight:700,color:'white',flexShrink:0}}>{mesa.numero}</div>
                          <span style={{fontSize:14,fontWeight:700,color:'#111827'}}>Mesa {mesa.numero}</span>
                        </div>
                        <div style={{display:'flex',flexDirection:'column',gap:4}}>
                          {mesa.adulto&&<div style={{display:'flex',alignItems:'center',gap:6}}><span style={{fontSize:10,background:'#fef3c7',color:'#92400e',padding:'1px 7px',borderRadius:20,fontWeight:600,flexShrink:0}}>Adulto</span><span style={{fontSize:12,color:'#374151'}}>{mesa.adulto}</span></div>}
                          {mesa.lider&&<div style={{display:'flex',alignItems:'center',gap:6}}><span style={{fontSize:10,background:'#f0f2ff',color:'#0f1787',padding:'1px 7px',borderRadius:20,fontWeight:600,flexShrink:0}}>Líder</span><span style={{fontSize:12,color:'#374151'}}>{mesa.lider}</span></div>}
                          {mesa.colider&&<div style={{display:'flex',alignItems:'center',gap:6}}><span style={{fontSize:10,background:'#faf5ff',color:'#7c3aed',padding:'1px 7px',borderRadius:20,fontWeight:600,flexShrink:0}}>Co-líder</span><span style={{fontSize:12,color:'#374151'}}>{mesa.colider}</span></div>}
                        </div>
                      </div>
                      <button onClick={()=>iniciarEdicionMesa(mesa)} style={{padding:'6px 10px',background:'#f0f2ff',color:'#0f1787',border:'none',borderRadius:8,fontSize:11,fontWeight:600,cursor:'pointer',flexShrink:0}}>Editar</button>
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* ══ CAMINANTES ══ */}
      {tab==='caminantes'&&(
        <div>
          {exitoCam&&<div style={{background:'#f0fdf4',border:'1px solid #bbf7d0',borderRadius:8,padding:'8px 14px',marginBottom:12,fontSize:13,color:'#16a34a'}}>✓ {exitoCam}</div>}
          {loadingCam?<Spinner/>:(
            <>
              {casosDificiles.length>0&&(
                <div style={{background:'#fef2f2',border:'1.5px solid #fecaca',borderRadius:12,padding:'14px',marginBottom:16}}>
                  <button onClick={()=>setVerCasosDificiles(v=>!v)} style={{width:'100%',display:'flex',alignItems:'center',justifyContent:'space-between',background:'none',border:'none',cursor:'pointer',padding:0}}>
                    <span style={{fontSize:12,fontWeight:700,color:'#991b1b',textTransform:'uppercase',letterSpacing:.5}}>⚠️ Casos difíciles ({casosDificiles.length})</span>
                    <span style={{fontSize:12,color:'#991b1b'}}>{verCasosDificiles?'▲':'▼'}</span>
                  </button>
                  {verCasosDificiles&&(
                    <div style={{display:'flex',flexDirection:'column',gap:8,marginTop:12}}>
                      {casosDificiles.map(c=>(
                        <div key={c.id} style={{background:'white',borderRadius:8,padding:'10px 12px',border:'1px solid #fecaca'}}>
                          <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',marginBottom:4,gap:8}}>
                            <span style={{fontSize:13,fontWeight:600,color:'#111827'}}>{c.nombre}</span>
                            {c.mesa!=null&&<span style={{fontSize:10,background:'#fef3c7',color:'#92400e',padding:'1px 7px',borderRadius:20,fontWeight:600,flexShrink:0}}>Mesa {c.mesa}</span>}
                          </div>
                          {c.motivo&&<p style={{fontSize:12,color:'#7f1d1d',margin:0,lineHeight:1.5}}>{c.motivo}</p>}
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}
              {(asignaciones.some(a=>!a.confirmado_por_lider)||asignaciones.some(a=>a.confirmado_por_lider))&&(
                <div style={{display:'flex',gap:8,marginBottom:16}}>
                  {asignaciones.some(a=>!a.confirmado_por_lider)&&<button onClick={confirmarTodas} disabled={guardandoCam} style={{flex:1,padding:'10px 14px',background:'#16a34a',color:'white',border:'none',borderRadius:10,fontSize:13,fontWeight:600,cursor:'pointer'}}>Confirmar todas</button>}
                  {asignaciones.some(a=>a.confirmado_por_lider)&&<button onClick={desconfirmarTodas} disabled={guardandoCam} style={{flex:1,padding:'10px 14px',background:'#f3f4f6',color:'#6b7280',border:'1.5px solid #e8eaf0',borderRadius:10,fontSize:13,fontWeight:600,cursor:'pointer'}}>Desconfirmar</button>}
                </div>
              )}
              {asignaciones.length>0&&<div style={{display:'flex',gap:8,marginBottom:16}}>{[{l:'Asignados',v:asignaciones.length,c:'#0f1787'},{l:'Sin asignar',v:sinAsignar.length,c:'#d97706'},{l:'Confirmados',v:asignaciones.filter(a=>a.confirmado_por_lider).length,c:'#16a34a'}].map(s=><div key={s.l} style={{flex:1,background:'white',border:'0.5px solid #e8eaf0',borderRadius:10,padding:'10px 14px',textAlign:'center'}}><div style={{fontSize:20,fontWeight:700,color:s.c}}>{s.v}</div><div style={{fontSize:11,color:'#6b7280'}}>{s.l}</div></div>)}</div>}
              {asignaciones.length>0&&<div style={{position:'relative',marginBottom:16}}><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#9ca3af" strokeWidth="2" strokeLinecap="round" style={{position:'absolute',left:12,top:'50%',transform:'translateY(-50%)'}}><circle cx="11" cy="11" r="8"/><path d="m21 21-4.35-4.35"/></svg><input type="text" placeholder="Buscar caminante..." value={busquedaCam} onChange={e=>setBusquedaCam(e.target.value)} style={{width:'100%',padding:'10px 12px 10px 36px',border:'1.5px solid #e8eaf0',borderRadius:10,fontSize:13,outline:'none',boxSizing:'border-box',background:'white',fontFamily:'inherit'}}/>{busquedaCam&&<button onClick={()=>setBusquedaCam('')} style={{position:'absolute',right:10,top:'50%',transform:'translateY(-50%)',background:'none',border:'none',cursor:'pointer',color:'#9ca3af',fontSize:16}}>✕</button>}</div>}
              {sinAsignar.length>0&&<div style={{background:'#fffbeb',border:'1px solid #fde68a',borderRadius:10,padding:'12px 14px',marginBottom:16}}>
                <p style={{fontSize:12,fontWeight:700,color:'#92400e',margin:'0 0 8px',textTransform:'uppercase',letterSpacing:.5}}>{sinAsignar.length} sin mesa</p>
                <div style={{display:'flex',flexDirection:'column',gap:6}}>
                  {sinAsignar.map(c=>(
                    <div key={c.id}>
                      <div style={{display:'flex',alignItems:'center',justifyContent:'space-between',gap:8}}>
                        <span style={{fontSize:12,color:'#78350f'}}>{c.nombre}{c.edad?` · ${c.edad} años`:''}{c.es_dificil&&<span style={{marginLeft:6,fontSize:9,fontWeight:700,padding:'1px 6px',borderRadius:20,background:'#fecaca',color:'#991b1b'}}>DIFÍCIL</span>}</span>
                        {dificilEditId!==c.id&&<button onClick={()=>iniciarEdicionDificil(c)} style={{fontSize:10,padding:'2px 8px',background:c.es_dificil?'#fef2f2':'#f3f4f6',color:c.es_dificil?'#dc2626':'#6b7280',border:'none',borderRadius:20,cursor:'pointer',fontWeight:600,flexShrink:0}}>{c.es_dificil?'Editar':'⚠️ Marcar difícil'}</button>}
                      </div>
                      {dificilEditId===c.id&&(
                        <div style={{marginTop:6,padding:'8px',background:'white',borderRadius:8,border:'1px solid #fde68a'}}>
                          <textarea value={motivoDificil} onChange={e=>setMotivoDificil(e.target.value)} rows={2} placeholder="Describe por qué es un caso difícil..." style={{width:'100%',padding:'6px 8px',border:'1.5px solid #e8eaf0',borderRadius:6,fontSize:12,outline:'none',boxSizing:'border-box',fontFamily:'inherit',resize:'vertical'}}/>
                          <div style={{display:'flex',gap:6,marginTop:6}}>
                            <button onClick={()=>guardarDificil(c.id)} disabled={guardandoDificil} style={{flex:1,padding:'6px',background:guardandoDificil?'#9ca3af':'#dc2626',color:'white',border:'none',borderRadius:6,fontSize:11,fontWeight:600,cursor:'pointer'}}>{guardandoDificil?'Guardando...':'Guardar'}</button>
                            {c.es_dificil&&<button onClick={()=>quitarDificil(c.id)} disabled={guardandoDificil} style={{padding:'6px 10px',background:'#f3f4f6',color:'#374151',border:'none',borderRadius:6,fontSize:11,cursor:'pointer'}}>Quitar</button>}
                            <button onClick={()=>{setDificilEditId(null);setMotivoDificil('')}} style={{padding:'6px 10px',background:'#f3f4f6',color:'#374151',border:'none',borderRadius:6,fontSize:11,cursor:'pointer'}}>Cancelar</button>
                          </div>
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              </div>}
              {asignaciones.length===0&&<div style={{background:'white',border:'1.5px solid #e8eaf0',borderRadius:14,padding:'40px 24px',textAlign:'center'}}><p style={{fontSize:15,fontWeight:600,color:'#111827',margin:'0 0 6px'}}>No hay asignaciones aún</p><p style={{fontSize:13,color:'#6b7280',margin:0}}>Agrega caminantes a las mesas manualmente desde abajo.</p></div>}
              {asignaciones.length>0&&(
                <div style={{display:'flex',flexDirection:'column',gap:10}}>
                  {mesasDisponibles.map(mesa=>{
                    const cams=aPM[mesa.numero]??[], ab=mesaExpandida===mesa.id, conf=cams.filter(a=>a.confirmado_por_lider).length
                    return(
                      <div key={mesa.id} style={{background:'white',border:'1.5px solid #e8eaf0',borderRadius:12,overflow:'hidden',borderLeft:'3px solid #0f1787'}}>
                        <button onClick={()=>setMesaExpandida(ab?null:mesa.id)} style={{width:'100%',display:'flex',alignItems:'center',gap:10,padding:'12px 14px',background:'none',border:'none',cursor:'pointer',textAlign:'left'}}>
                          <div style={{width:28,height:28,borderRadius:8,background:'#0f1787',display:'flex',alignItems:'center',justifyContent:'center',fontSize:13,fontWeight:700,color:'white',flexShrink:0}}>{mesa.numero}</div>
                          <div style={{flex:1}}><span style={{fontSize:14,fontWeight:700,color:'#111827'}}>Mesa {mesa.numero}</span><span style={{fontSize:11,color:'#6b7280',marginLeft:8}}>{mesa.lider}</span></div>
                          <div style={{display:'flex',alignItems:'center',gap:6}}>
                            <span style={{fontSize:12,fontWeight:600,color:cams.length>=CAMINANTES_POR_MESA?'#16a34a':'#d97706'}}>{cams.length}/{CAMINANTES_POR_MESA}</span>
                            {conf>0&&conf===cams.length&&<span style={{fontSize:10,background:'#f0fdf4',color:'#16a34a',padding:'2px 6px',borderRadius:20,fontWeight:600}}>✓</span>}
                            <span style={{fontSize:12,color:'#9ca3af'}}>{ab?'▲':'▼'}</span>
                          </div>
                        </button>
                        {ab&&(
                          <div style={{borderTop:'1px solid #f3f4f6',padding:'10px 14px'}}>
                            {cams.length===0?<p style={{fontSize:13,color:'#9ca3af',margin:'4px 0 8px',fontStyle:'italic'}}>Sin caminantes asignados</p>:(
                              <div style={{display:'flex',flexDirection:'column',gap:6,marginBottom:10}}>
                                {cams.map(asig=>(
                                  <div key={asig.id} style={{display:'flex',alignItems:'flex-start',gap:8,padding:'10px',background:asig.confirmado_por_lider?'#f0fdf4':'#fffbeb',borderRadius:8}}>
                                    <div style={{flex:1}}>
                                      <div style={{fontSize:13,fontWeight:600,color:'#111827',marginBottom:2}}>{asig.caminante?.nombre}{asig.caminante?.es_dificil&&<span style={{marginLeft:6,fontSize:9,fontWeight:700,padding:'1px 6px',borderRadius:20,background:'#fecaca',color:'#991b1b'}}>DIFÍCIL</span>}</div>
                                      <div style={{fontSize:11,color:'#6b7280',marginBottom:6}}>{asig.caminante?.celular}{asig.caminante?.edad?` · ${asig.caminante.edad} años`:''}</div>
                                      <div style={{display:'flex',alignItems:'center',gap:6,flexWrap:'wrap'}}>
                                        <SeguimientoBadges asignacionId={asig.id} seguimientos={seguimientos} onToggle={toggleSeg}/>
                                        {dificilEditId!==asig.caminante?.id&&(
                                          <button onClick={()=>iniciarEdicionDificil(asig.caminante)} style={{display:'flex',alignItems:'center',gap:4,padding:'3px 8px',borderRadius:20,border:'none',cursor:'pointer',fontSize:10,fontWeight:600,background:asig.caminante?.es_dificil?'#fef2f2':'#f3f4f6',color:asig.caminante?.es_dificil?'#dc2626':'#6b7280'}}>{asig.caminante?.es_dificil?'Editar caso':'⚠️ Marcar difícil'}</button>
                                        )}
                                      </div>
                                      {dificilEditId===asig.caminante?.id&&(
                                        <div style={{marginTop:8,padding:'8px',background:'white',borderRadius:8,border:'1px solid #fecaca'}}>
                                          <textarea value={motivoDificil} onChange={e=>setMotivoDificil(e.target.value)} rows={2} placeholder="Describe por qué es un caso difícil..." style={{width:'100%',padding:'6px 8px',border:'1.5px solid #e8eaf0',borderRadius:6,fontSize:12,outline:'none',boxSizing:'border-box',fontFamily:'inherit',resize:'vertical'}}/>
                                          <div style={{display:'flex',gap:6,marginTop:6}}>
                                            <button onClick={()=>guardarDificil(asig.caminante.id)} disabled={guardandoDificil} style={{flex:1,padding:'6px',background:guardandoDificil?'#9ca3af':'#dc2626',color:'white',border:'none',borderRadius:6,fontSize:11,fontWeight:600,cursor:'pointer'}}>{guardandoDificil?'Guardando...':'Guardar'}</button>
                                            {asig.caminante?.es_dificil&&<button onClick={()=>quitarDificil(asig.caminante.id)} disabled={guardandoDificil} style={{padding:'6px 10px',background:'#f3f4f6',color:'#374151',border:'none',borderRadius:6,fontSize:11,cursor:'pointer'}}>Quitar</button>}
                                            <button onClick={()=>{setDificilEditId(null);setMotivoDificil('')}} style={{padding:'6px 10px',background:'#f3f4f6',color:'#374151',border:'none',borderRadius:6,fontSize:11,cursor:'pointer'}}>Cancelar</button>
                                          </div>
                                        </div>
                                      )}
                                    </div>
                                    {editandoCamId===asig.id?(
                                      <div style={{display:'flex',gap:4,alignItems:'center'}}>
                                        <select value={nuevaMesaId} onChange={e=>setNuevaMesaId(e.target.value)} style={{fontSize:12,border:'1.5px solid #e8eaf0',borderRadius:6,padding:'4px 6px',outline:'none'}}><option value="">Mesa...</option>{mesasDisponibles.map(m=><option key={m.id} value={m.id}>Mesa {m.numero}</option>)}</select>
                                        <button onClick={()=>{const m=mesasDisponibles.find(x=>x.id===nuevaMesaId);if(m)cambiarMesa(asig.id,m)}} style={{padding:'4px 8px',background:'#0f1787',color:'white',border:'none',borderRadius:6,fontSize:11,cursor:'pointer'}}>OK</button>
                                        <button onClick={()=>setEditandoCamId(null)} style={{padding:'4px 8px',background:'#f3f4f6',color:'#374151',border:'none',borderRadius:6,fontSize:11,cursor:'pointer'}}>✕</button>
                                      </div>
                                    ):(
                                      <div style={{display:'flex',gap:4}}>
                                        <button onClick={()=>{setEditandoCamId(asig.id);setNuevaMesaId('')}} style={{padding:'4px 8px',background:'#f0f2ff',color:'#0f1787',border:'none',borderRadius:6,fontSize:11,fontWeight:600,cursor:'pointer'}}>Mover</button>
                                        <button onClick={()=>quitarCaminante(asig.id)} style={{padding:'4px 8px',background:'#fef2f2',color:'#dc2626',border:'none',borderRadius:6,fontSize:11,fontWeight:600,cursor:'pointer'}}>✕</button>
                                      </div>
                                    )}
                                  </div>
                                ))}
                              </div>
                            )}
                            {caminantesSinMesa.length>0&&(
                              agregandoACam===mesa.id?(
                                <div style={{display:'flex',gap:6,marginTop:4}}>
                                  <select value={camSel} onChange={e=>setCamSel(e.target.value)} style={{flex:1,fontSize:12,border:'1.5px solid #e8eaf0',borderRadius:8,padding:'6px 8px',outline:'none'}}><option value="">Seleccionar caminante...</option>{caminantesSinMesa.map(c=><option key={c.id} value={c.id}>{c.nombre}{c.edad?` · ${c.edad} años`:''}</option>)}</select>
                                  <button onClick={()=>agregarCamAMesa(mesa.id,mesa.numero,camSel)} style={{padding:'6px 12px',background:'#0f1787',color:'white',border:'none',borderRadius:8,fontSize:12,fontWeight:600,cursor:'pointer'}}>Agregar</button>
                                  <button onClick={()=>{setAgregandoACam(null);setCamSel('')}} style={{padding:'6px 10px',background:'#f3f4f6',color:'#374151',border:'none',borderRadius:8,fontSize:12,cursor:'pointer'}}>✕</button>
                                </div>
                              ):<button onClick={()=>setAgregandoACam(mesa.id)} style={{width:'100%',padding:'7px',background:'#f0f2ff',color:'#0f1787',border:'1.5px dashed #c7d0ff',borderRadius:8,fontSize:12,fontWeight:600,cursor:'pointer'}}>+ Agregar caminante</button>
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

      {/* ══ CUARTOS ══ */}
      {tab==='cuartos'&&(
        <div>
          {exitoCuartos&&<div style={{background:'#f0fdf4',border:'1px solid #bbf7d0',borderRadius:8,padding:'8px 14px',marginBottom:12,fontSize:13,color:'#16a34a'}}>✓ {exitoCuartos}</div>}
          {loadingCuartos?<Spinner/>:(
            <>
              <div style={{display:'flex',gap:8,marginBottom:16}}>{[{l:'Total asig.',v:totAsig,c:'#0f1787'},{l:'Servidores',v:totSrv,c:'#1e40af'},{l:'Caminantes',v:totCam,c:'#16a34a'},{l:'Sin cuarto',v:sinCuarto.length,c:'#dc2626'}].map(s=><div key={s.l} style={{flex:1,background:'white',border:'0.5px solid #e8eaf0',borderRadius:10,padding:'8px 6px',textAlign:'center'}}><div style={{fontSize:18,fontWeight:700,color:s.c}}>{s.v}</div><div style={{fontSize:10,color:'#6b7280'}}>{s.l}</div></div>)}</div>
              {sinCuarto.length>0&&<div style={{background:'#fef2f2',border:'1px solid #fecaca',borderRadius:10,padding:'12px 14px',marginBottom:14}}><p style={{fontSize:12,fontWeight:700,color:'#991b1b',margin:'0 0 6px',textTransform:'uppercase',letterSpacing:.5}}>{sinCuarto.length} sin cuarto</p><div style={{display:'flex',flexDirection:'column',gap:3}}>{sinCuarto.slice(0,6).map(p=><div key={p.id} style={{display:'flex',alignItems:'center',gap:6,fontSize:12,color:'#7f1d1d'}}><span style={{fontSize:9,fontWeight:700,padding:'1px 6px',borderRadius:20,background:p.tipo==='servidor'?'#cfe2ff':'#f0fdf4',color:p.tipo==='servidor'?'#1e40af':'#166534'}}>{p.tipo==='servidor'?'SRV':'CAM'}</span>{p.nombre}</div>)}{sinCuarto.length>6&&<span style={{fontSize:11,color:'#9ca3af',marginTop:2}}>...y {sinCuarto.length-6} más</span>}</div></div>}
              <div style={{position:'relative',marginBottom:10}}><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#9ca3af" strokeWidth="2" strokeLinecap="round" style={{position:'absolute',left:12,top:'50%',transform:'translateY(-50%)'}}><circle cx="11" cy="11" r="8"/><path d="m21 21-4.35-4.35"/></svg><input type="text" placeholder="Buscar habitación, bloque o persona..." value={busquedaCuartos} onChange={e=>setBusquedaCuartos(e.target.value)} style={{width:'100%',padding:'10px 12px 10px 36px',border:'1.5px solid #e8eaf0',borderRadius:10,fontSize:13,outline:'none',boxSizing:'border-box',background:'white',fontFamily:'inherit'}}/>{busquedaCuartos&&<button onClick={()=>setBusquedaCuartos('')} style={{position:'absolute',right:10,top:'50%',transform:'translateY(-50%)',background:'none',border:'none',cursor:'pointer',color:'#9ca3af',fontSize:16}}>✕</button>}</div>
              <div style={{display:'flex',gap:6,marginBottom:16,flexWrap:'wrap'}}>
                {[{l:'Todos',v:null},{l:'Piso 1',v:1},{l:'Piso 2',v:2},{l:'Piso 3',v:3}].map(f=><button key={String(f.v)} onClick={()=>setFiltroPiso(f.v)} style={{padding:'5px 12px',borderRadius:20,border:'none',cursor:'pointer',fontSize:11,fontWeight:600,background:filtroPiso===f.v?'#0f1787':'#f3f4f6',color:filtroPiso===f.v?'white':'#6b7280'}}>{f.l}</button>)}
                <div style={{width:'100%',height:0}}/>
                {[{l:'Todos',v:'todos'as const},{l:'Servidores',v:'servidor'as const},{l:'Caminantes',v:'caminante'as const},{l:'Libre',v:'libre'as const}].map(f=><button key={f.v} onClick={()=>setFiltroTipo(f.v)} style={{padding:'5px 12px',borderRadius:20,border:'none',cursor:'pointer',fontSize:11,fontWeight:600,background:filtroTipo===f.v?'#7c3aed':'#f3f4f6',color:filtroTipo===f.v?'white':'#6b7280'}}>{f.l}</button>)}
              </div>
              {habitaciones.length===0?<div style={{background:'white',border:'1.5px solid #e8eaf0',borderRadius:14,padding:'40px 24px',textAlign:'center'}}><p style={{fontSize:15,fontWeight:600,color:'#111827',margin:'0 0 6px'}}>No hay habitaciones cargadas</p></div>:bloquesCuartos.length===0?<div style={{background:'white',border:'1.5px solid #e8eaf0',borderRadius:10,padding:'20px',textAlign:'center',color:'#9ca3af',fontSize:13}}>Sin resultados</div>:(
                <div style={{display:'flex',flexDirection:'column',gap:24}}>
                  {bloquesCuartos.map(blq=>{
                    const habs=habFilt.filter(h=>h.bloque===blq); if(!habs.length) return null
                    const piso=habs[0].piso,p1=piso===1
                    const cb=p1?'#cfe2ff':piso===2?'#f0fdf4':'#faf5ff',ct=p1?'#1e40af':piso===2?'#166534':'#6b21a8'
                    return(
                      <div key={blq}>
                        <div style={{display:'flex',alignItems:'center',gap:8,marginBottom:10}}>
                          <span style={{fontSize:10,fontWeight:700,padding:'2px 8px',borderRadius:20,background:cb,color:ct}}>Piso {piso}</span>
                          <h3 style={{fontSize:13,fontWeight:700,color:'#111827',margin:0}}>{blq}</h3>
                          {p1&&<span style={{fontSize:9,fontWeight:700,padding:'2px 7px',borderRadius:20,background:'#cfe2ff',color:'#1e40af'}}>Solo servidores</span>}
                        </div>
                        <div style={{display:'flex',flexDirection:'column',gap:8}}>
                          {habs.map(hab=>{
                            const asigs=asignacionesHab.filter(a=>a.habitacion_id===hab.id),ab=habExpandida===hab.id,llena=asigs.length>=hab.capacidad
                            const ts=asigs.some(a=>a.tipo_persona==='servidor'),tc=asigs.some(a=>a.tipo_persona==='caminante')
                            const bc=ts&&tc?'#d97706':ts?'#1e40af':tc?'#16a34a':'#e8eaf0'
                            return(
                              <div key={hab.id} style={{background:'white',border:'1.5px solid #e8eaf0',borderRadius:12,overflow:'hidden',borderLeft:`3px solid ${bc}`}}>
                                <button onClick={()=>setHabExpandida(ab?null:hab.id)} style={{width:'100%',display:'flex',alignItems:'center',gap:10,padding:'12px 14px',background:'none',border:'none',cursor:'pointer',textAlign:'left'}}>
                                  <div style={{width:36,height:36,borderRadius:10,background:llena?'#f0fdf4':'#f7f8fc',display:'flex',alignItems:'center',justifyContent:'center',flexShrink:0,border:`1.5px solid ${llena?'#bbf7d0':'#e8eaf0'}`}}><span style={{fontSize:11,fontWeight:700,color:llena?'#16a34a':'#0f1787'}}>{hab.numero}</span></div>
                                  <div style={{flex:1}}>
                                    <div style={{display:'flex',alignItems:'center',gap:5,marginBottom:2}}>
                                      <span style={{fontSize:13,fontWeight:700,color:'#111827'}}>Hab. {hab.numero}</span>
                                      {ts&&<span style={{fontSize:9,fontWeight:700,padding:'1px 5px',borderRadius:20,background:'#cfe2ff',color:'#1e40af'}}>SRV</span>}
                                      {tc&&<span style={{fontSize:9,fontWeight:700,padding:'1px 5px',borderRadius:20,background:'#f0fdf4',color:'#166534'}}>CAM</span>}
                                    </div>
                                    <span style={{fontSize:11,color:'#9ca3af'}}>{hab.tipo_cama}</span>
                                  </div>
                                  <div style={{display:'flex',alignItems:'center',gap:6}}><span style={{fontSize:12,fontWeight:600,color:llena?'#16a34a':'#d97706'}}>{asigs.length}/{hab.capacidad}</span><span style={{fontSize:12,color:'#9ca3af'}}>{ab?'▲':'▼'}</span></div>
                                </button>
                                {ab&&(
                                  <div style={{borderTop:'1px solid #f3f4f6',padding:'10px 14px'}}>
                                    {asigs.length===0?<p style={{fontSize:13,color:'#9ca3af',margin:'4px 0 8px',fontStyle:'italic'}}>Habitación vacía</p>:(
                                      <div style={{display:'flex',flexDirection:'column',gap:6,marginBottom:10}}>
                                        {asigs.map(a=><div key={a.id} style={{display:'flex',alignItems:'center',gap:8,padding:'8px 10px',background:a.tipo_persona==='servidor'?'#eff6ff':'#f0fdf4',borderRadius:8}}><span style={{fontSize:9,fontWeight:700,padding:'2px 6px',borderRadius:20,background:a.tipo_persona==='servidor'?'#cfe2ff':'#bbf7d0',color:a.tipo_persona==='servidor'?'#1e40af':'#166534',flexShrink:0}}>{a.tipo_persona==='servidor'?'SRV':'CAM'}</span><span style={{fontSize:13,fontWeight:500,color:'#111827',flex:1}}>{a.nombre}</span><button onClick={()=>quitarDeHab(a.id)} style={{padding:'3px 8px',background:'#fef2f2',color:'#dc2626',border:'none',borderRadius:6,fontSize:11,fontWeight:600,cursor:'pointer'}}>✕</button></div>)}
                                      </div>
                                    )}
                                    {asigs.length<hab.capacidad&&sinCuarto.length>0&&(
                                      agregandoAHab===hab.id?(
                                        <div style={{display:'flex',gap:6}}>
                                          <select value={personaSel} onChange={e=>setPersonaSel(e.target.value)} style={{flex:1,fontSize:12,border:'1.5px solid #e8eaf0',borderRadius:8,padding:'6px 8px',outline:'none'}}>
                                            <option value="">Seleccionar persona...</option>
                                            <optgroup label="Servidores">{sinCuarto.filter(p=>p.tipo==='servidor').map(p=><option key={p.id} value={p.id}>{p.nombre}</option>)}</optgroup>
                                            {!hab.solo_servidores&&<optgroup label="Caminantes">{sinCuarto.filter(p=>p.tipo==='caminante').map(p=><option key={p.id} value={p.id}>{p.nombre}</option>)}</optgroup>}
                                          </select>
                                          <button onClick={()=>agregarAHab(hab.id)} style={{padding:'6px 12px',background:'#0f1787',color:'white',border:'none',borderRadius:8,fontSize:12,fontWeight:600,cursor:'pointer'}}>OK</button>
                                          <button onClick={()=>{setAgregandoAHab(null);setPersonaSel('')}} style={{padding:'6px 10px',background:'#f3f4f6',color:'#374151',border:'none',borderRadius:8,fontSize:12,cursor:'pointer'}}>✕</button>
                                        </div>
                                      ):<button onClick={()=>setAgregandoAHab(hab.id)} style={{width:'100%',padding:'7px',background:'#f0f2ff',color:'#0f1787',border:'1.5px dashed #c7d0ff',borderRadius:8,fontSize:12,fontWeight:600,cursor:'pointer'}}>+ Agregar persona</button>
                                    )}
                                  </div>
                                )}
                              </div>
                            )
                          })}
                        </div>
                      </div>
                    )
                  })}
                </div>
              )}
            </>
          )}
        </div>
      )}

      {/* ══ MANUAL ══ */}
      {tab==='manual'&&(
        <div style={{display:'flex',flexDirection:'column',gap:16}}>
          <div style={{background:'white',border:'1.5px solid #e8eaf0',borderRadius:14,padding:'20px'}}>
            <div style={{display:'flex',gap:14,alignItems:'flex-start',marginBottom:16}}>
              <div style={{width:48,height:48,background:'#0f1787',borderRadius:12,display:'flex',alignItems:'center',justifyContent:'center',flexShrink:0}}>
                <svg width="24" height="24" fill="none" viewBox="0 0 24 24"><path d="M9 12h6M9 16h6M7 3H5a2 2 0 00-2 2v14a2 2 0 002 2h14a2 2 0 002-2V8l-5-5H7z" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/><path d="M14 3v5h5" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/></svg>
              </div>
              <div>
                <p style={{fontSize:16,fontWeight:700,color:'#111827',margin:'0 0 4px'}}>Manual Effeta Mazuren</p>
                <p style={{fontSize:13,color:'#6b7280',margin:0}}>Documento oficial con todas las instrucciones, actividades, guiones y protocolos.</p>
              </div>
            </div>
            <button onClick={()=>window.open('https://docs.google.com/document/d/1lB2M0-FyRe6Eu-2HjcLcnI96jfEqgikC71TWzuhNUR4/edit','_blank')} style={{width:'100%',padding:'12px',background:'#0f1787',color:'white',border:'none',borderRadius:10,fontSize:14,fontWeight:600,cursor:'pointer'}}>Abrir Manual</button>
          </div>
        </div>
      )}
    </div>
  )
}
