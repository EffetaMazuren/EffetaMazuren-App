'use client'
import { useCallback, useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'
import { personalizar } from '@/lib/cupos-llenos'
import { ChevronLeft, Info, Send, AlertTriangle, Check, Gift, ChevronDown, ChevronUp, RotateCcw } from 'lucide-react'

type Persona = { id: string; nombre: string; correo?: string }
type Datos = {
  retiro: { id: string; nombre: string }
  asunto: string
  texto: string
  asuntoPorDefecto: string
  textoPorDefecto: string
  destinatarios: Persona[]
  sorpresas: Persona[]
  sinCorreo: Persona[]
  envios: { pendientes: number; enviados: number; cancelados: number; errores: { nombre: string; correo: string; error: string | null }[] }
}

async function llamar(metodo: 'GET' | 'PATCH' | 'POST', body?: object) {
  const { data: { session } } = await supabase.auth.getSession()
  const res = await fetch('/api/lider/cupos-llenos', {
    method: metodo,
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${session?.access_token ?? ''}` },
    body: body ? JSON.stringify(body) : undefined,
  })
  const data = await res.json()
  if (!res.ok || !data.success) throw new Error(data.error || 'Error de servidor')
  return data
}

const tarjeta: React.CSSProperties = { background: '#fff', border: '0.5px solid #e5e7eb', borderRadius: 14, padding: 16, marginBottom: 14 }
const titulo: React.CSSProperties = { fontSize: 11, fontWeight: 600, color: '#9ca3af', letterSpacing: '0.08em', textTransform: 'uppercase', margin: '0 0 10px' }
const input: React.CSSProperties = { width: '100%', padding: '10px 12px', borderRadius: 10, border: '1.5px solid #e2e4f0', fontSize: 14, outline: 'none', boxSizing: 'border-box', fontFamily: 'inherit' }

function Lista({ personas, mostrarCorreo }: { personas: Persona[]; mostrarCorreo?: boolean }) {
  return (
    <div style={{ maxHeight: 260, overflowY: 'auto', border: '0.5px solid #f3f4f6', borderRadius: 10 }}>
      {personas.map((p, i) => (
        <div key={p.id} style={{ padding: '8px 12px', borderBottom: i === personas.length - 1 ? 'none' : '0.5px solid #f3f4f6' }}>
          <div style={{ fontSize: 13, color: '#0d0d14' }}>{p.nombre}</div>
          {mostrarCorreo && p.correo && <div style={{ fontSize: 11, color: '#9ca3af' }}>{p.correo}</div>}
        </div>
      ))}
    </div>
  )
}

export default function CuposLlenosPage() {
  const router = useRouter()
  const [datos, setDatos] = useState<Datos | null>(null)
  const [asunto, setAsunto] = useState('')
  const [texto, setTexto] = useState('')
  const [cargando, setCargando] = useState(true)
  const [guardando, setGuardando] = useState(false)
  const [error, setError] = useState('')
  const [aviso, setAviso] = useState('')
  const [verLista, setVerLista] = useState(false)
  const [modal, setModal] = useState(false)
  const [confirmacion, setConfirmacion] = useState('')
  const [enviando, setEnviando] = useState(false)

  const cargar = useCallback(async (reiniciarTexto: boolean) => {
    try {
      const d: Datos = await llamar('GET')
      setDatos(d)
      if (reiniciarTexto) { setAsunto(d.asunto); setTexto(d.texto) }
      setError('')
    } catch (e: any) {
      setError(e.message)
    } finally {
      setCargando(false)
    }
  }, [])

  useEffect(() => { cargar(true) }, [cargar])

  // Mientras haya correos en cola, refresca el estado cada 30 segundos
  useEffect(() => {
    if (!datos || datos.envios.pendientes === 0) return
    const t = setInterval(() => cargar(false), 30000)
    return () => clearInterval(t)
  }, [datos, cargar])

  const cambiosSinGuardar = !!datos && (asunto.trim() !== datos.asunto.trim() || texto.trim() !== datos.texto.trim())

  async function guardarTexto() {
    setGuardando(true); setError(''); setAviso('')
    try {
      await llamar('PATCH', { asunto, texto })
      await cargar(true)
      setAviso('Texto guardado para este retiro.')
    } catch (e: any) {
      setError(e.message)
    } finally {
      setGuardando(false)
    }
  }

  async function enviar() {
    if (!datos) return
    setEnviando(true); setError(''); setAviso('')
    try {
      const r = await llamar('POST', { confirmacion, ids: datos.destinatarios.map(d => d.id) })
      setModal(false); setConfirmacion('')
      setAviso(`Listo: ${r.enCola} correos quedaron en cola. Se envían automáticamente en los próximos 15 minutos (si Gmail se queda sin cupo diario, siguen al día siguiente).`)
      await cargar(false)
    } catch (e: any) {
      setError(e.message)
    } finally {
      setEnviando(false)
    }
  }

  if (cargando) {
    return <div style={{ padding: 40, textAlign: 'center', color: '#9ca3af', fontSize: 14 }}>Cargando…</div>
  }

  const ejemplo = datos?.destinatarios[0]?.nombre || 'Juliana'
  const n = datos?.destinatarios.length ?? 0

  return (
    <div style={{ background: '#f7f8fc', minHeight: '100vh', paddingBottom: 60 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '18px 20px 14px' }}>
        <button onClick={() => router.push('/dashboard/config')} style={{ width: 34, height: 34, borderRadius: '50%', background: '#fff', border: '0.5px solid #e5e7eb', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer' }}>
          <ChevronLeft size={18} color="#6b7280" />
        </button>
        <div>
          <div style={{ fontSize: 17, fontWeight: 500, color: '#0d0d14' }}>Correo de cupos llenos</div>
          <div style={{ fontSize: 12, color: '#9ca3af', marginTop: 2 }}>{datos?.retiro.nombre}</div>
        </div>
      </div>

      <div style={{ padding: '0 20px' }}>
        <div style={{ background: '#eff6ff', border: '0.5px solid #bfdbfe', borderRadius: 12, padding: 14, display: 'flex', gap: 10, marginBottom: 14 }}>
          <Info size={18} color="#0f1787" style={{ flexShrink: 0, marginTop: 1 }} />
          <p style={{ fontSize: 13, color: '#1e3a8a', margin: 0, lineHeight: 1.5 }}>
            Le avisa a los caminantes inscritos <strong>sin ningún pago ni abono</strong> que los cupos se llenaron. A cada persona le llega <strong>una sola vez</strong>. Los caminantes sorpresa no lo reciben.
          </p>
        </div>

        {error && (
          <div style={{ color: '#dc2626', fontSize: 13, background: '#fef2f2', padding: '10px 12px', borderRadius: 8, display: 'flex', gap: 8, marginBottom: 14 }}>
            <AlertTriangle size={16} style={{ flexShrink: 0, marginTop: 1 }} /> {error}
          </div>
        )}
        {aviso && (
          <div style={{ color: '#166534', fontSize: 13, background: '#f0fdf4', padding: '10px 12px', borderRadius: 8, display: 'flex', gap: 8, marginBottom: 14 }}>
            <Check size={16} style={{ flexShrink: 0, marginTop: 1 }} /> {aviso}
          </div>
        )}

        {datos && (datos.envios.enviados + datos.envios.pendientes + datos.envios.errores.length + datos.envios.cancelados) > 0 && (
          <div style={tarjeta}>
            <p style={titulo}>Envíos de este retiro</p>
            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
              <span style={{ fontSize: 12, fontWeight: 600, padding: '4px 10px', borderRadius: 20, background: '#f0fdf4', color: '#166534' }}>Enviados · {datos.envios.enviados}</span>
              <span style={{ fontSize: 12, fontWeight: 600, padding: '4px 10px', borderRadius: 20, background: '#fffbeb', color: '#92400e' }}>En cola · {datos.envios.pendientes}</span>
              {datos.envios.cancelados > 0 && <span style={{ fontSize: 12, fontWeight: 600, padding: '4px 10px', borderRadius: 20, background: '#f3f4f6', color: '#374151' }}>No enviados (pagaron antes) · {datos.envios.cancelados}</span>}
              {datos.envios.errores.length > 0 && <span style={{ fontSize: 12, fontWeight: 600, padding: '4px 10px', borderRadius: 20, background: '#fef2f2', color: '#b91c1c' }}>Con error · {datos.envios.errores.length}</span>}
            </div>
            {datos.envios.errores.length > 0 && (
              <div style={{ marginTop: 10, fontSize: 12, color: '#b91c1c', lineHeight: 1.5 }}>
                {datos.envios.errores.map((e, i) => <div key={i}>{e.nombre} ({e.correo}): {e.error || 'error'}</div>)}
                <div style={{ color: '#6b7280', marginTop: 4 }}>Los que tuvieron error vuelven a aparecer abajo para reintentar.</div>
              </div>
            )}
          </div>
        )}

        {/* Texto del correo */}
        <div style={tarjeta}>
          <p style={titulo}>Texto del correo · {datos?.retiro.nombre}</p>
          <label style={{ fontSize: 12, fontWeight: 600, color: '#6b7280', display: 'block', marginBottom: 6 }}>Asunto</label>
          <input value={asunto} onChange={e => setAsunto(e.target.value)} style={{ ...input, marginBottom: 12 }} />
          <label style={{ fontSize: 12, fontWeight: 600, color: '#6b7280', display: 'block', marginBottom: 6 }}>Mensaje</label>
          <textarea value={texto} onChange={e => setTexto(e.target.value)} rows={14} style={{ ...input, resize: 'vertical', lineHeight: 1.5 }} />
          <p style={{ fontSize: 11, color: '#9ca3af', margin: '6px 0 12px', lineHeight: 1.5 }}>
            <strong>{'{nombre}'}</strong> se cambia por el primer nombre de cada persona y <strong>{'{retiro}'}</strong> por “{datos?.retiro.nombre}”. Deja una línea en blanco para separar párrafos.
          </p>
          <div style={{ display: 'flex', gap: 8 }}>
            <button onClick={guardarTexto} disabled={guardando || !cambiosSinGuardar}
              style={{ flex: 1, padding: 12, borderRadius: 10, border: 'none', background: guardando || !cambiosSinGuardar ? '#9ca3af' : '#0f1787', color: '#fff', fontSize: 14, fontWeight: 600, cursor: 'pointer' }}>
              {guardando ? 'Guardando…' : cambiosSinGuardar ? 'Guardar texto' : 'Texto guardado'}
            </button>
            <button onClick={() => { if (datos) { setAsunto(datos.asuntoPorDefecto); setTexto(datos.textoPorDefecto) } }}
              title="Volver al texto original"
              style={{ padding: '12px 14px', borderRadius: 10, border: '0.5px solid #e5e7eb', background: '#fff', color: '#6b7280', fontSize: 13, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 6 }}>
              <RotateCcw size={14} /> Original
            </button>
          </div>
        </div>

        {/* Vista previa */}
        <div style={tarjeta}>
          <p style={titulo}>Así le llega a {ejemplo.split(' ')[0]}</p>
          <div style={{ fontSize: 12, color: '#6b7280', marginBottom: 8 }}>
            <strong>Asunto:</strong> {personalizar(asunto, ejemplo, datos?.retiro.nombre || '')}
          </div>
          <div style={{ background: '#f7f8fc', borderRadius: 10, padding: 14, fontSize: 13, color: '#374151', lineHeight: 1.6, whiteSpace: 'pre-wrap' }}>
            {personalizar(texto, ejemplo, datos?.retiro.nombre || '')}
          </div>
        </div>

        {/* Destinatarios */}
        <div style={tarjeta}>
          <button onClick={() => setVerLista(v => !v)} style={{ width: '100%', background: 'none', border: 'none', padding: 0, display: 'flex', justifyContent: 'space-between', alignItems: 'center', cursor: 'pointer' }}>
            <span style={{ fontSize: 14, fontWeight: 600, color: '#0d0d14' }}>Le llegará a {n} {n === 1 ? 'persona' : 'personas'}</span>
            {verLista ? <ChevronUp size={16} color="#9ca3af" /> : <ChevronDown size={16} color="#9ca3af" />}
          </button>
          {verLista && n > 0 && <div style={{ marginTop: 10 }}><Lista personas={datos!.destinatarios} mostrarCorreo /></div>}
          {n === 0 && <p style={{ fontSize: 12, color: '#9ca3af', margin: '6px 0 0' }}>No hay caminantes sin pago a quienes falte enviarles el correo.</p>}
        </div>

        {datos && datos.sorpresas.length > 0 && (
          <div style={{ ...tarjeta, background: '#fff7ed', border: '0.5px solid #fed7aa' }}>
            <p style={{ ...titulo, color: '#c2410c', display: 'flex', alignItems: 'center', gap: 6 }}><Gift size={13} /> Sorpresas sin pago · no se les envía</p>
            <p style={{ fontSize: 12, color: '#9a3412', margin: '0 0 10px' }}>Avísale tú a quien los inscribió.</p>
            <Lista personas={datos.sorpresas} />
          </div>
        )}

        {datos && datos.sinCorreo.length > 0 && (
          <div style={tarjeta}>
            <p style={titulo}>Sin correo válido · no se les puede enviar</p>
            <Lista personas={datos.sinCorreo} />
          </div>
        )}

        <button
          onClick={() => { setConfirmacion(''); setModal(true) }}
          disabled={n === 0 || cambiosSinGuardar}
          style={{ width: '100%', padding: 15, borderRadius: 12, border: 'none', background: n === 0 || cambiosSinGuardar ? '#9ca3af' : '#dc2626', color: '#fff', fontSize: 15, fontWeight: 700, cursor: n === 0 || cambiosSinGuardar ? 'not-allowed' : 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8 }}>
          <Send size={16} /> Enviar a {n} {n === 1 ? 'persona' : 'personas'}
        </button>
        {cambiosSinGuardar && <p style={{ fontSize: 12, color: '#92400e', textAlign: 'center', margin: '8px 0 0' }}>Guarda el texto antes de enviar.</p>}
      </div>

      {/* Doble confirmación */}
      {modal && datos && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', zIndex: 200, display: 'flex', alignItems: 'flex-end', padding: '0 0 20px' }}>
          <div style={{ background: '#fff', borderRadius: 20, margin: '0 16px', width: 'calc(100% - 32px)', padding: 24, boxSizing: 'border-box' }}>
            <div style={{ fontSize: 16, fontWeight: 700, color: '#0d0d14', marginBottom: 8 }}>¿Enviar el correo de cupos llenos?</div>
            <div style={{ fontSize: 14, color: '#6b7280', lineHeight: 1.6, marginBottom: 16 }}>
              Les llegará a <strong>{n} {n === 1 ? 'persona' : 'personas'}</strong> del {datos.retiro.nombre} que no tienen ningún pago. Esto <strong>no se puede deshacer</strong>.
              <br /><br />Para confirmar, escribe <strong>ENVIAR</strong>:
            </div>
            <input value={confirmacion} onChange={e => setConfirmacion(e.target.value)} placeholder="ENVIAR" autoCapitalize="characters" autoFocus style={{ ...input, marginBottom: 16, fontSize: 16, letterSpacing: 2 }} />
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              <button onClick={enviar} disabled={confirmacion.trim().toUpperCase() !== 'ENVIAR' || enviando}
                style={{ width: '100%', padding: 14, borderRadius: 12, border: 'none', background: confirmacion.trim().toUpperCase() !== 'ENVIAR' || enviando ? '#9ca3af' : '#dc2626', color: '#fff', fontSize: 15, fontWeight: 700, cursor: 'pointer' }}>
                {enviando ? 'Enviando…' : 'Sí, enviar ahora'}
              </button>
              <button onClick={() => setModal(false)} disabled={enviando}
                style={{ width: '100%', padding: 14, borderRadius: 12, border: '0.5px solid #e5e7eb', background: '#fff', color: '#6b7280', fontSize: 15, cursor: 'pointer' }}>
                Cancelar
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
