'use client'
import { useEffect, useState, useRef } from 'react'
import { useRouter, useParams } from 'next/navigation'
import { supabase } from '@/lib/supabase'
import { ArrowLeft, Download, MoreHorizontal, Plus, Mail, CheckCircle, EyeOff, ChevronDown, Upload, X, ExternalLink, Loader } from 'lucide-react'

function fmt(n: number) { return `$${Number(n).toLocaleString('es-CO')}` }

function Chip({ label, bg, color }: any) {
  return <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4, padding: '4px 11px', borderRadius: 20, fontSize: 11, fontWeight: 500, background: bg, color }}>{label}</span>
}

function Accordion({ title, dot, hint, children }: any) {
  const [open, setOpen] = useState(false)
  return (
    <div style={{ background: '#fff', borderRadius: 14, border: '0.5px solid #e5e7eb', marginBottom: 8, overflow: 'hidden' }}>
      <div onClick={() => setOpen(!open)} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '15px 18px', cursor: 'pointer' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <div style={{ width: 8, height: 8, borderRadius: '50%', background: dot, flexShrink: 0 }} />
          <span style={{ fontSize: 14, fontWeight: 500, color: '#111827' }}>{title}</span>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          {hint && <span style={{ fontSize: 12, color: '#d1d5db' }}>{hint}</span>}
          <ChevronDown size={16} color="#d1d5db" style={{ transform: open ? 'rotate(180deg)' : 'none', transition: '0.2s' }} />
        </div>
      </div>
      {open && (
        <div style={{ padding: '0 18px 18px', borderTop: '0.5px solid #f3f4f6' }}>
          <div style={{ height: 4 }} />
          {children}
        </div>
      )}
    </div>
  )
}

function DataRow({ label, value, valueColor }: any) {
  const display = (!value || value === 'null' || value === '') ? '—' : value
  const isMissing = display === '—'
  return (
    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '10px 0', borderBottom: '0.5px solid #f3f4f6' }}>
      <span style={{ fontSize: 12, color: '#9ca3af' }}>{label}</span>
      <span style={{ fontSize: 13, fontWeight: isMissing ? 400 : 500, color: isMissing ? '#d1d5db' : (valueColor || '#111827'), textAlign: 'right', maxWidth: '65%' }}>{display}</span>
    </div>
  )
}

export default function FichaCaminante() {
  const router = useRouter()
  const { id } = useParams()
  const [cam, setCam] = useState<any>(null)
  const [detalle, setDetalle] = useState<any>(null)
  const [pagos, setPagos] = useState<any[]>([])
  const [contactos, setContactos] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [enviandoCorreo, setEnviandoCorreo] = useState(false)
  const [modalPago, setModalPago] = useState(false)

  // Estados del nuevo modal
  const [paso, setPaso] = useState<'subir' | 'revisar' | 'guardando'>('subir')
  const [archivo, setArchivo] = useState<File | null>(null)
  const [previsualizacion, setPrevisualizacion] = useState<string | null>(null)
  const [valorDetectado, setValorDetectado] = useState<string>('')
  const [valorManual, setValorManual] = useState<string>('')
  const [notas, setNotas] = useState<string>('')
  const [analizando, setAnalizando] = useState(false)
  const [errorAnalisis, setErrorAnalisis] = useState<string | null>(null)
  const inputFileRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    async function cargar() {
      const { data: vista } = await supabase
        .from('vista_pagos_caminantes')
        .select('*')
        .eq('id', id)
        .single()
      setCam(vista)

      const { data: completo } = await supabase
        .from('caminantes')
        .select('*')
        .eq('id', id)
        .single()
      setDetalle(completo)

      const { data: p } = await supabase
        .from('pagos')
        .select('*')
        .eq('persona_id', id)
        .order('fecha')
      setPagos(p || [])

      const { data: ct } = await supabase
        .from('contactos_emergencia')
        .select('*')
        .eq('persona_id', id)
        .order('orden')
      setContactos(ct || [])

      setLoading(false)
    }
    cargar()
  }, [id])

  function abrirModal() {
    setPaso('subir')
    setArchivo(null)
    setPrevisualizacion(null)
    setValorDetectado('')
    setValorManual('')
    setNotas('')
    setErrorAnalisis(null)
    setModalPago(true)
  }

  function cerrarModal() {
    setModalPago(false)
    setPaso('subir')
    setArchivo(null)
    setPrevisualizacion(null)
    setValorDetectado('')
    setValorManual('')
    setNotas('')
    setErrorAnalisis(null)
  }

  async function seleccionarArchivo(e: React.ChangeEvent<HTMLInputElement>) {
    const f = e.target.files?.[0]
    if (!f) return
    setArchivo(f)
    const url = URL.createObjectURL(f)
    setPrevisualizacion(url)
    setErrorAnalisis(null)
    await analizarComprobante(f)
  }

  async function analizarComprobante(f: File) {
    setAnalizando(true)
    setErrorAnalisis(null)
    try {
      // Convertir imagen a base64
      const base64 = await new Promise<string>((resolve, reject) => {
        const reader = new FileReader()
        reader.onload = () => {
          const result = reader.result as string
          resolve(result.split(',')[1])
        }
        reader.onerror = reject
        reader.readAsDataURL(f)
      })

      // Llamar a Claude para detectar el valor
      const response = await fetch('/api/pagos/analizar-comprobante', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          imageBase64: base64,
          mediaType: f.type,
        }),
      })

      const data = await response.json()
      if (data.valor) {
        setValorDetectado(data.valor.toString())
        setValorManual(data.valor.toString())
      } else {
        setErrorAnalisis('No se pudo detectar el valor automáticamente. Ingrésalo manualmente.')
      }
    } catch (err) {
      setErrorAnalisis('Error analizando imagen. Ingresa el valor manualmente.')
    } finally {
      setAnalizando(false)
      setPaso('revisar')
    }
  }

  async function confirmarYGuardar() {
    const valor = parseFloat(valorManual.replace(/\./g, '').replace(',', '.'))
    if (!valor || valor <= 0) return alert('Ingresa un valor válido')
    if (!archivo) return alert('Debes subir un comprobante')

    setPaso('guardando')

    try {
      // 1. Subir archivo a Google Drive
      const formData = new FormData()
      formData.append('file', archivo)
      formData.append('caminanteNombre', detalle.nombre)
      formData.append('caminanteId', id as string)

      const driveRes = await fetch('/api/drive/upload', {
        method: 'POST',
        body: formData,
      })
      const driveData = await driveRes.json()

      if (!driveData.success) throw new Error('Error subiendo a Drive')

      // 2. Obtener retiro activo
      const { data: retiro } = await supabase
        .from('retiros')
        .select('id')
        .eq('estado', 'activo')
        .single()

      // 3. Obtener usuario actual
      const { data: { user } } = await supabase.auth.getUser()

      // 4. Registrar pago vía API
      const pagoRes = await fetch('/api/pagos/registrar', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          caminanteId: id,
          retiroId: retiro?.id,
          valor,
          fileUrl: driveData.fileUrl,
          fileName: driveData.fileName,
          filePath: driveData.fileId,
          registradoPor: user?.id,
          notas: notas || null,
        }),
      })

      const pagoData = await pagoRes.json()
      if (!pagoData.success) throw new Error('Error registrando pago')

      cerrarModal()
      window.location.reload()
    } catch (err: any) {
      alert('Error: ' + err.message)
      setPaso('revisar')
    }
  }

  async function enviarCorreo() {
    if (!cam) return
    setEnviandoCorreo(true)
    const res = await fetch('/api/correos/inscripcion', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ caminante_id: cam.id }),
    })
    if (res.ok) { alert('✅ Correo enviado'); window.location.reload() }
    else alert('Error enviando correo')
    setEnviandoCorreo(false)
  }

  if (loading) return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: '100vh' }}>
      <div style={{ color: '#9ca3af' }}>Cargando...</div>
    </div>
  )

  if (!cam || !detalle) return <div style={{ padding: 20 }}>Caminante no encontrado</div>

  const pct = Math.min(Math.round((cam.total_pagado / 500000) * 100), 100)
  const sacramentos = detalle.sacramentos?.join(', ') || '—'

  return (
    <div style={{ background: '#f7f8fc', minHeight: '100vh', paddingBottom: 40 }}>
      {/* Nav */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '16px 20px 12px' }}>
        <button onClick={() => router.back()} style={{ display: 'flex', alignItems: 'center', gap: 6, color: '#9ca3af', fontSize: 13, background: 'none', border: 'none', cursor: 'pointer' }}>
          <ArrowLeft size={16} /> Caminantes
        </button>
        <div style={{ display: 'flex', gap: 8 }}>
          <button style={{ width: 34, height: 34, borderRadius: '50%', background: '#fff', border: '0.5px solid #e5e7eb', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer' }}>
            <Download size={16} color="#6b7280" />
          </button>
          <button style={{ width: 34, height: 34, borderRadius: '50%', background: '#fff', border: '0.5px solid #e5e7eb', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer' }}>
            <MoreHorizontal size={16} color="#6b7280" />
          </button>
        </div>
      </div>

      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', padding: '4px 20px 16px', gap: 12 }}>
        <div>
          <div style={{ fontSize: 22, fontWeight: 500, color: '#0d0d14', letterSpacing: -0.3 }}>{detalle.nombre}</div>
          <div style={{ fontSize: 12, color: '#9ca3af', marginTop: 2 }}>{detalle.tipo_documento} {detalle.numero_documento} · {detalle.edad} años</div>
          <div style={{ display: 'flex', gap: 6, marginTop: 8, flexWrap: 'wrap' }}>
            {cam.estado_pago === 'completo' && <Chip label="Pago completo" bg="#dcfce7" color="#166534" />}
            {cam.estado_pago === 'parcial' && <Chip label="Abono parcial" bg="#fef3c7" color="#92400e" />}
            {cam.estado_pago === 'sin_pago' && <Chip label="Sin pago" bg="#f3f4f6" color="#6b7280" />}
            {detalle.es_sorpresa && <Chip label="Sorpresa" bg="#ede9fe" color="#5b21b6" />}
          </div>
        </div>
        <div style={{ textAlign: 'right', flexShrink: 0 }}>
          {detalle.inscrito_oficialmente && (
            <div style={{ display: 'inline-flex', alignItems: 'center', gap: 6, background: '#0f1787', color: '#fff', padding: '5px 14px', borderRadius: 6, fontSize: 12, fontWeight: 500 }}>
              <CheckCircle size={13} /> Inscrito
            </div>
          )}
          <div style={{ fontSize: 11, color: '#9ca3af', marginTop: 5 }}>
            {detalle.inscrito_oficialmente ? 'Cupo asegurado' : 'Sin cupo aún'}
          </div>
        </div>
      </div>

      {/* Alerta sorpresa */}
      {detalle.es_sorpresa && contactos.length > 0 && (
        <div style={{ margin: '0 20px 14px', background: '#f5f3ff', border: '0.5px solid #c4b5fd', borderRadius: 10, padding: '10px 14px', display: 'flex', alignItems: 'flex-start', gap: 8 }}>
          <EyeOff size={14} color="#5b21b6" style={{ marginTop: 1, flexShrink: 0 }} />
          <span style={{ fontSize: 12, color: '#5b21b6' }}>
            <strong>Retiro sorpresa.</strong> Contactar a: {contactos[0].nombre} ({contactos[0].parentesco}) · {contactos[0].celular}
          </span>
        </div>
      )}

      {/* Acciones */}
      <div style={{ display: 'flex', gap: 8, padding: '0 20px 16px', flexWrap: 'wrap' }}>
        <button onClick={enviarCorreo} disabled={enviandoCorreo} style={{ display: 'inline-flex', alignItems: 'center', gap: 6, padding: '8px 14px', border: 'none', borderRadius: 8, fontSize: 12, fontWeight: 500, cursor: 'pointer', background: '#0f1787', color: '#fff' }}>
          <Mail size={14} /> {enviandoCorreo ? 'Enviando...' : detalle.es_sorpresa ? 'Correo al contacto' : 'Enviar correo'}
        </button>
        <button onClick={abrirModal} style={{ display: 'inline-flex', alignItems: 'center', gap: 6, padding: '8px 14px', border: '0.5px solid #e5e7eb', borderRadius: 8, fontSize: 12, fontWeight: 500, cursor: 'pointer', background: '#fff', color: '#0d0d14' }}>
          <Plus size={14} /> Registrar pago
        </button>
      </div>

      {/* Card pago */}
      <div style={{ margin: '0 20px 12px', background: '#fff', borderRadius: 14, border: '0.5px solid #e5e7eb', overflow: 'hidden' }}>
        <div style={{ padding: '12px 16px 10px', borderBottom: '0.5px solid #edf0f7', background: '#f8fdf9' }}>
          <span style={{ fontSize: 11, fontWeight: 500, letterSpacing: 0.8, textTransform: 'uppercase' as const, color: '#16a34a' }}>Estado de pago</span>
        </div>
        <div style={{ padding: '14px 16px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', padding: '6px 0', borderBottom: '0.5px solid #f1f2f6', fontSize: 13 }}>
            <span style={{ color: '#6b7280' }}>Total requerido</span><span style={{ fontWeight: 500 }}>{fmt(500000)}</span>
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-between', padding: '6px 0', borderBottom: '0.5px solid #f1f2f6', fontSize: 13 }}>
            <span style={{ color: '#6b7280' }}>Total pagado</span><span style={{ fontWeight: 500, color: '#166534' }}>{fmt(cam.total_pagado)}</span>
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-between', padding: '6px 0', fontSize: 13 }}>
            <span style={{ color: '#6b7280' }}>Saldo pendiente</span>
            <span style={{ fontWeight: 500, color: cam.saldo_pendiente > 0 ? '#92400e' : '#166534' }}>{fmt(Math.max(cam.saldo_pendiente, 0))}</span>
          </div>
          <div style={{ margin: '10px 0 6px' }}>
            <div style={{ height: 7, background: '#e8eaf6', borderRadius: 4 }}>
              <div style={{ height: 7, borderRadius: 4, background: '#0f1787', width: `${pct}%`, transition: 'width 0.4s' }} />
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 11, color: '#9ca3af', marginTop: 4 }}>
              <span>$0</span><span>{pct}% pagado</span><span>$500K</span>
            </div>
          </div>

          {pagos.length > 0 && (
            <>
              <div style={{ fontSize: 11, fontWeight: 500, color: '#9ca3af', margin: '12px 0 6px', textTransform: 'uppercase' as const, letterSpacing: 0.5 }}>Historial de abonos</div>
              {pagos.map((p, i) => (
                <div key={p.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '7px 0', borderBottom: '0.5px solid #f1f2f6' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                    <div style={{ width: 26, height: 26, borderRadius: 8, background: '#f3f4f6', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 11, fontWeight: 500, color: '#6b7280' }}>{i + 1}</div>
                    <div>
                      <div style={{ fontSize: 12, fontWeight: 500, color: '#111827' }}>Abono {i + 1}</div>
                      <div style={{ fontSize: 11, color: '#9ca3af' }}>{new Date(p.fecha).toLocaleDateString('es-CO', { day: 'numeric', month: 'short', year: 'numeric' })}</div>
                    </div>
                  </div>
                  <div style={{ textAlign: 'right' }}>
                    <div style={{ fontSize: 13, fontWeight: 500, color: '#166534' }}>{fmt(p.valor)}</div>
                    {p.comprobante_url && (
                      <a href={p.comprobante_url} target="_blank" rel="noopener noreferrer" style={{ fontSize: 11, color: '#0f1787', display: 'inline-flex', alignItems: 'center', gap: 3, textDecoration: 'none' }}>
                        Ver <ExternalLink size={10} />
                      </a>
                    )}
                  </div>
                </div>
              ))}
            </>
          )}

          <div style={{ marginTop: 12 }}>
            <button onClick={abrirModal} style={{ width: '100%', height: 38, border: '0.5px solid #e5e7eb', borderRadius: 8, background: '#fff', fontSize: 13, fontWeight: 500, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6, color: '#0d0d14' }}>
              <Plus size={14} /> Registrar nuevo abono
            </button>
          </div>
        </div>
      </div>

      {/* Acordeones */}
      <div style={{ padding: '0 20px' }}>
        <Accordion title="Datos personales" dot="#0f1787">
          <DataRow label="Celular" value={detalle.celular} />
          <DataRow label="Correo" value={detalle.correo} />
          <DataRow label="Dirección" value={detalle.direccion} />
          <DataRow label="Barrio" value={detalle.barrio} />
          <DataRow label="Fecha de nacimiento" value={detalle.fecha_nacimiento ? new Date(detalle.fecha_nacimiento).toLocaleDateString('es-CO', { day: 'numeric', month: 'long', year: 'numeric' }) : null} />
          <DataRow label="Talla camiseta" value={detalle.talla_camiseta} />
          <DataRow label="Sacramentos" value={sacramentos} />
          <DataRow label="Estado correo" value={detalle.estado_correo === 'sin_enviar' ? '⏳ Pendiente' : detalle.estado_correo === 'enviado' ? '✓ Enviado' : '✓ Enviado al contacto'} valueColor={detalle.estado_correo === 'sin_enviar' ? '#d97706' : '#166534'} />
        </Accordion>

        <Accordion title="Salud" dot="#dc2626">
          <DataRow label="EPS" value={detalle.eps} />
          <DataRow label="Alergias" value={detalle.alergias} />
          <DataRow label="Restricciones alimentarias" value={detalle.restricciones_alimentarias} />
          <DataRow label="Medicamentos" value={detalle.medicamentos} />
        </Accordion>

        <Accordion title="Contactos de emergencia" dot="#7c3aed" hint={contactos.length > 0 ? `${contactos.length}` : '0'}>
          {contactos.length === 0 ? (
            <div style={{ fontSize: 13, color: '#9ca3af', padding: '8px 0' }}>Sin contactos registrados</div>
          ) : contactos.map(c => (
            <div key={c.id} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '10px 0', borderBottom: '0.5px solid #f3f4f6' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                <div style={{ width: 32, height: 32, borderRadius: '50%', background: '#ede9fe', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 11, fontWeight: 500, color: '#5b21b6' }}>
                  {c.nombre.split(' ').slice(0, 2).map((n: string) => n[0]).join('')}
                </div>
                <div>
                  <div style={{ fontSize: 13, fontWeight: 500, color: '#111827' }}>{c.nombre}</div>
                  <div style={{ fontSize: 11, color: '#9ca3af' }}>{c.parentesco} · {c.celular}</div>
                </div>
              </div>
            </div>
          ))}
        </Accordion>

        <Accordion title="Historial" dot="#d1d5db">
          <DataRow label="Fecha de inscripción" value={detalle.fecha_inscripcion ? new Date(detalle.fecha_inscripcion).toLocaleDateString('es-CO', { day: 'numeric', month: 'long', year: 'numeric' }) : null} />
          <DataRow label="Correo inscripción" value={detalle.estado_correo === 'sin_enviar' ? 'Pendiente' : '✓ Enviado'} valueColor={detalle.estado_correo === 'sin_enviar' ? '#9ca3af' : '#166534'} />
          <DataRow label="Correo pago completo" value={cam.estado_pago === 'completo' ? '✓ Enviado' : 'Pendiente de pago'} valueColor={cam.estado_pago === 'completo' ? '#166534' : '#9ca3af'} />
          <DataRow label="Retiro" value="Effetá Mazuren · Julio 2026" />
          {detalle.observaciones && <DataRow label="Observaciones" value={detalle.observaciones} />}
        </Accordion>
      </div>

      {/* Modal nuevo abono con comprobante */}
      {modalPago && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'flex-end', zIndex: 200 }}>
          <div style={{ background: '#fff', borderRadius: '16px 16px 0 0', padding: 24, width: '100%', maxHeight: '90vh', overflowY: 'auto' }}>

            {/* Header modal */}
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 4 }}>
              <div style={{ fontSize: 16, fontWeight: 500, color: '#0d0d14' }}>Registrar abono</div>
              <button onClick={cerrarModal} style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 4 }}>
                <X size={18} color="#9ca3af" />
              </button>
            </div>
            <div style={{ fontSize: 13, color: '#9ca3af', marginBottom: 20 }}>{detalle.nombre}</div>

            {/* PASO 1: Subir comprobante */}
            {(paso === 'subir' || paso === 'revisar') && (
              <>
                {/* Zona de subida */}
                <input
                  ref={inputFileRef}
                  type="file"
                  accept="image/*"
                  onChange={seleccionarArchivo}
                  style={{ display: 'none' }}
                />

                {!archivo ? (
                  <div
                    onClick={() => inputFileRef.current?.click()}
                    style={{ border: '1.5px dashed #e5e7eb', borderRadius: 12, padding: '32px 20px', textAlign: 'center', cursor: 'pointer', background: '#fafafa', marginBottom: 16 }}
                  >
                    <Upload size={24} color="#9ca3af" style={{ margin: '0 auto 8px' }} />
                    <div style={{ fontSize: 14, fontWeight: 500, color: '#374151', marginBottom: 4 }}>Subir comprobante</div>
                    <div style={{ fontSize: 12, color: '#9ca3af' }}>Foto o captura de pantalla de la transferencia</div>
                  </div>
                ) : (
                  <div style={{ marginBottom: 16 }}>
                    {/* Vista previa */}
                    <div style={{ position: 'relative', borderRadius: 12, overflow: 'hidden', marginBottom: 10 }}>
                      <img src={previsualizacion!} alt="Comprobante" style={{ width: '100%', maxHeight: 200, objectFit: 'cover', borderRadius: 12 }} />
                      <button
                        onClick={() => { setArchivo(null); setPrevisualizacion(null); setValorDetectado(''); setValorManual(''); setPaso('subir') }}
                        style={{ position: 'absolute', top: 8, right: 8, background: 'rgba(0,0,0,0.5)', border: 'none', borderRadius: '50%', width: 28, height: 28, display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer' }}
                      >
                        <X size={14} color="#fff" />
                      </button>
                    </div>

                    {/* Estado análisis */}
                    {analizando && (
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '10px 14px', background: '#f0f4ff', borderRadius: 10, marginBottom: 12 }}>
                        <Loader size={14} color="#0f1787" style={{ animation: 'spin 1s linear infinite' }} />
                        <span style={{ fontSize: 13, color: '#0f1787' }}>Analizando comprobante...</span>
                      </div>
                    )}

                    {!analizando && valorDetectado && (
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '10px 14px', background: '#f0fdf4', borderRadius: 10, marginBottom: 12, border: '0.5px solid #bbf7d0' }}>
                        <CheckCircle size={14} color="#16a34a" />
                        <span style={{ fontSize: 13, color: '#166534' }}>Valor detectado: <strong>{fmt(parseFloat(valorDetectado))}</strong></span>
                      </div>
                    )}

                    {!analizando && errorAnalisis && (
                      <div style={{ padding: '10px 14px', background: '#fff7ed', borderRadius: 10, marginBottom: 12, border: '0.5px solid #fed7aa' }}>
                        <span style={{ fontSize: 12, color: '#92400e' }}>{errorAnalisis}</span>
                      </div>
                    )}
                  </div>
                )}

                {/* Campo valor — siempre visible en paso revisar */}
                {paso === 'revisar' && !analizando && (
                  <>
                    <div style={{ fontSize: 12, color: '#9ca3af', marginBottom: 6 }}>
                      {valorDetectado ? 'Confirmar o corregir valor (COP)' : 'Valor del abono (COP)'}
                    </div>
                    <input
                      type="number"
                      value={valorManual}
                      onChange={e => setValorManual(e.target.value)}
                      placeholder="Ej: 250000"
                      style={{ width: '100%', height: 44, border: '0.5px solid #e5e7eb', borderRadius: 10, padding: '0 14px', fontSize: 16, marginBottom: 12, outline: 'none', boxSizing: 'border-box' }}
                    />
                    <div style={{ fontSize: 12, color: '#9ca3af', marginBottom: 6 }}>Notas (opcional)</div>
                    <input
                      type="text"
                      value={notas}
                      onChange={e => setNotas(e.target.value)}
                      placeholder="Ej: Transferencia Nequi"
                      style={{ width: '100%', height: 40, border: '0.5px solid #e5e7eb', borderRadius: 10, padding: '0 14px', fontSize: 14, marginBottom: 16, outline: 'none', boxSizing: 'border-box' }}
                    />
                    <div style={{ display: 'flex', gap: 8 }}>
                      <button onClick={cerrarModal} style={{ flex: 1, height: 44, border: '0.5px solid #e5e7eb', borderRadius: 10, background: '#fff', fontSize: 14, fontWeight: 500, cursor: 'pointer' }}>Cancelar</button>
                      <button onClick={confirmarYGuardar} style={{ flex: 2, height: 44, border: 'none', borderRadius: 10, background: '#0f1787', color: '#fff', fontSize: 14, fontWeight: 500, cursor: 'pointer' }}>
                        Confirmar y guardar
                      </button>
                    </div>
                  </>
                )}
              </>
            )}

            {/* PASO: Guardando */}
            {paso === 'guardando' && (
              <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', padding: '24px 0', gap: 12 }}>
                <Loader size={28} color="#0f1787" style={{ animation: 'spin 1s linear infinite' }} />
                <div style={{ fontSize: 14, color: '#374151', fontWeight: 500 }}>Subiendo comprobante a Drive...</div>
                <div style={{ fontSize: 12, color: '#9ca3af' }}>Registrando el abono, por favor espera</div>
              </div>
            )}

          </div>
        </div>
      )}

      <style>{`
        @keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }
      `}</style>
    </div>
  )
}
