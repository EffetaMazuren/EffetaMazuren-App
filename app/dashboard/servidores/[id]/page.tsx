'use client'
import { useEffect, useState } from 'react'
import { useRouter, useParams } from 'next/navigation'
import { supabase } from '@/lib/supabase'
import { ChevronLeft, Plus, Trash2, Upload, X } from 'lucide-react'

type Servidor = {
  id: string; nombre: string; numero_documento: string; tipo_documento: string
  celular: string; correo: string; edad: number; talla_camiseta: string
  eps: string; alergias: string; restricciones_alimentarias: string
  medicamentos: string; observaciones: string; estado_correo: string
  inscrito_oficialmente: boolean; fecha_inscripcion: string
  total_pagado: number; saldo_pendiente: number
  estado_pago: 'completo' | 'parcial' | 'sin_pago'; numero_abonos: number
}

type Pago = {
  id: string; valor: number; created_at: string
  comprobante_url: string | null; comprobante_nombre: string | null
}

function fmt(n: number) { return `$${Number(n).toLocaleString('es-CO')}` }
function iniciales(nombre: string) {
  return nombre.split(' ').slice(0, 2).map(n => n[0]).join('').toUpperCase()
}

const VALOR_TOTAL = 380000

export default function ServidorPage() {
  const router = useRouter()
  const { id } = useParams<{ id: string }>()

  const [servidor, setServidor] = useState<Servidor | null>(null)
  const [pagos, setPagos] = useState<Pago[]>([])
  const [loading, setLoading] = useState(true)
  const [mostrarFormPago, setMostrarFormPago] = useState(false)
  const [valorPago, setValorPago] = useState('')
  const [archivo, setArchivo] = useState<File | null>(null)
  const [previsualizacion, setPrevisualizacion] = useState<string | null>(null)
  const [guardandoPago, setGuardandoPago] = useState(false)
  const [borrandoId, setBorrandoId] = useState<string | null>(null)

  useEffect(() => { cargar() }, [id])

  async function cargar() {
    const { data: s } = await supabase
      .from('vista_pagos_servidores')
      .select('*')
      .eq('id', id)
      .single()
    if (s) setServidor(s as Servidor)

    const { data: p } = await supabase
      .from('pagos')
      .select('id, valor, created_at, comprobante_url, comprobante_nombre')
      .eq('persona_id', id)
      .eq('tipo_persona', 'servidor')
      .order('created_at', { ascending: false })
    if (p) setPagos(p as Pago[])

    setLoading(false)
  }

  function seleccionarArchivo(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    setArchivo(file)
    const reader = new FileReader()
    reader.onload = () => setPrevisualizacion(reader.result as string)
    reader.readAsDataURL(file)
  }

  async function registrarPago() {
    if (!valorPago || !servidor) return
    setGuardandoPago(true)

    let comprobante_url = null
    let comprobante_nombre = null

    if (archivo) {
      const ext = archivo.name.split('.').pop()
      const path = `servidores/${id}/${Date.now()}.${ext}`
      const { data: up } = await supabase.storage
        .from('comprobantes-pagos')
        .upload(path, archivo, { contentType: archivo.type })
      if (up) {
        const { data: url } = supabase.storage.from('comprobantes-pagos').getPublicUrl(path)
        comprobante_url = url.publicUrl
        comprobante_nombre = archivo.name
      }
    }

  const { data: r } = await supabase.from('retiros').select('id').eq('estado', 'activo').single()

    const { error } = await supabase.from('pagos').insert({
      persona_id: id,
      tipo_persona: 'servidor',
      retiro_id: r?.id,
      valor: Number(valorPago),
      fecha: new Date().toISOString().split('T')[0],
      estado: 'confirmado',
      comprobante_url,
      comprobante_nombre,
    })

    if (!error) {
      // Disparar correo de confirmación
      try {
        const appsScriptUrl = process.env.NEXT_PUBLIC_APPS_SCRIPT_URL
        if (appsScriptUrl) {
          await fetch(appsScriptUrl, {
            method: 'POST',
            body: JSON.stringify({
              tipo: 'confirmacion_pago_servidor',
              nombre: servidor.nombre,
              correo: servidor.correo,
              celular: servidor.celular,
              valor: Number(valorPago),
              total_pagado: servidor.total_pagado + Number(valorPago),
              saldo_pendiente: Math.max(0, servidor.saldo_pendiente - Number(valorPago)),
            })
          })
        }
      } catch (e) { console.log('correo error', e) }

      setValorPago('')
      setArchivo(null)
      setPrevisualizacion(null)
      setMostrarFormPago(false)
      cargar()
    }
    setGuardandoPago(false)
  }

  async function borrarPago(pagoId: string) {
    await supabase.from('pagos').delete().eq('id', pagoId)
    setBorrandoId(null)
    cargar()
  }

  if (loading || !servidor) return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: '100vh', background: '#f7f8fc' }}>
      <div style={{ color: '#9ca3af', fontSize: 14 }}>Cargando...</div>
    </div>
  )

  const pct = Math.min((servidor.total_pagado / VALOR_TOTAL) * 100, 100)
  const colorEstado = servidor.estado_pago === 'completo' ? { bg: '#dcfce7', color: '#166534', label: 'Pago completo' }
    : servidor.estado_pago === 'parcial' ? { bg: '#fef3c7', color: '#92400e', label: 'Abono parcial' }
    : { bg: '#f3f4f6', color: '#6b7280', label: 'Sin pago' }

  return (
    <div style={{ background: '#f7f8fc', minHeight: '100vh', paddingBottom: 40 }}>

      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '18px 20px 14px' }}>
        <button onClick={() => router.back()} style={{ width: 34, height: 34, borderRadius: '50%', background: '#fff', border: '0.5px solid #e5e7eb', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer' }}>
          <ChevronLeft size={18} color="#6b7280" />
        </button>
        <div style={{ fontSize: 17, fontWeight: 500, color: '#0d0d14' }}>Ficha servidor</div>
      </div>

      <div style={{ padding: '0 20px', display: 'flex', flexDirection: 'column', gap: 14 }}>

        {/* Hero card */}
        <div style={{ background: '#fff', borderRadius: 14, padding: '20px', border: '0.5px solid #e5e7eb' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 14, marginBottom: 16 }}>
            <div style={{ width: 52, height: 52, borderRadius: '50%', background: '#f0f1ff', color: '#0f1787', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 18, fontWeight: 600, flexShrink: 0 }}>
              {iniciales(servidor.nombre)}
            </div>
            <div>
              <div style={{ fontSize: 16, fontWeight: 600, color: '#0d0d14' }}>{servidor.nombre}</div>
              <div style={{ fontSize: 12, color: '#9ca3af', marginTop: 2 }}>{servidor.tipo_documento} {servidor.numero_documento}</div>
              <div style={{ marginTop: 6 }}>
                <span style={{ fontSize: 11, fontWeight: 500, padding: '3px 10px', borderRadius: 20, background: colorEstado.bg, color: colorEstado.color }}>
                  {colorEstado.label}
                </span>
              </div>
            </div>
          </div>

          {/* Barra pago */}
          <div style={{ marginBottom: 4 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 6 }}>
              <span style={{ fontSize: 12, color: '#6b7280' }}>Pagado: <strong>{fmt(servidor.total_pagado)}</strong></span>
              <span style={{ fontSize: 12, color: '#6b7280' }}>Saldo: <strong style={{ color: servidor.saldo_pendiente > 0 ? '#d97706' : '#16a34a' }}>{fmt(servidor.saldo_pendiente)}</strong></span>
            </div>
            <div style={{ height: 6, background: '#f3f4f6', borderRadius: 3 }}>
              <div style={{ height: 6, borderRadius: 3, background: pct >= 100 ? '#16a34a' : '#0f1787', width: `${pct}%`, transition: 'width 0.5s' }} />
            </div>
            <div style={{ fontSize: 11, color: '#9ca3af', marginTop: 4, textAlign: 'right' }}>{Math.round(pct)}% de {fmt(VALOR_TOTAL)}</div>
          </div>
        </div>

        {/* Info personal */}
        <div style={{ background: '#fff', borderRadius: 14, padding: '16px', border: '0.5px solid #e5e7eb', display: 'flex', flexDirection: 'column', gap: 10 }}>
          <div style={{ fontSize: 12, fontWeight: 600, color: '#0f1787', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Información</div>
          {[
            { label: 'Celular', value: servidor.celular },
            { label: 'Correo', value: servidor.correo },
            { label: 'Edad', value: servidor.edad ? `${servidor.edad} años` : '—' },
            { label: 'Talla', value: servidor.talla_camiseta },
            { label: 'EPS', value: servidor.eps || '—' },
          ].map(({ label, value }) => (
            <div key={label} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span style={{ fontSize: 13, color: '#9ca3af' }}>{label}</span>
              <span style={{ fontSize: 13, color: '#0d0d14', fontWeight: 500 }}>{value || '—'}</span>
            </div>
          ))}
        </div>

        {/* Salud */}
        {(servidor.alergias || servidor.restricciones_alimentarias || servidor.medicamentos) && (
          <div style={{ background: '#fff', borderRadius: 14, padding: '16px', border: '0.5px solid #e5e7eb', display: 'flex', flexDirection: 'column', gap: 10 }}>
            <div style={{ fontSize: 12, fontWeight: 600, color: '#0f1787', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Salud</div>
            {servidor.alergias && (
              <div style={{ display: 'flex', gap: 8, alignItems: 'flex-start' }}>
                <span style={{ fontSize: 10, fontWeight: 600, padding: '2px 8px', borderRadius: 20, background: '#fee2e2', color: '#991b1b', whiteSpace: 'nowrap' }}>Alergias</span>
                <span style={{ fontSize: 13, color: '#374151' }}>{servidor.alergias}</span>
              </div>
            )}
            {servidor.restricciones_alimentarias && (
              <div style={{ display: 'flex', gap: 8, alignItems: 'flex-start' }}>
                <span style={{ fontSize: 10, fontWeight: 600, padding: '2px 8px', borderRadius: 20, background: '#fef3c7', color: '#92400e', whiteSpace: 'nowrap' }}>Alimentación</span>
                <span style={{ fontSize: 13, color: '#374151' }}>{servidor.restricciones_alimentarias}</span>
              </div>
            )}
            {servidor.medicamentos && (
              <div style={{ display: 'flex', gap: 8, alignItems: 'flex-start' }}>
                <span style={{ fontSize: 10, fontWeight: 600, padding: '2px 8px', borderRadius: 20, background: '#ede9fe', color: '#5b21b6', whiteSpace: 'nowrap' }}>Medicamentos</span>
                <span style={{ fontSize: 13, color: '#374151' }}>{servidor.medicamentos}</span>
              </div>
            )}
          </div>
        )}

        {/* Pagos */}
        <div style={{ background: '#fff', borderRadius: 14, padding: '16px', border: '0.5px solid #e5e7eb' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14 }}>
            <div style={{ fontSize: 12, fontWeight: 600, color: '#0f1787', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
              Pagos · {servidor.numero_abonos}
            </div>
            {servidor.estado_pago !== 'completo' && (
              <button onClick={() => setMostrarFormPago(v => !v)}
                style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '6px 12px', borderRadius: 20, background: '#0f1787', border: 'none', color: '#fff', fontSize: 12, fontWeight: 500, cursor: 'pointer' }}>
                <Plus size={13} /> Registrar pago
              </button>
            )}
          </div>

          {/* Formulario pago */}
          {mostrarFormPago && (
            <div style={{ background: '#f7f8fc', borderRadius: 12, padding: '14px', marginBottom: 14, display: 'flex', flexDirection: 'column', gap: 12 }}>
              <div>
                <div style={{ fontSize: 11, color: '#9ca3af', marginBottom: 6 }}>Valor del abono</div>
                <input
                  type="number"
                  placeholder="380000"
                  value={valorPago}
                  onChange={e => setValorPago(e.target.value)}
                  style={{ width: '100%', border: '0.5px solid #e5e7eb', borderRadius: 10, padding: '10px 14px', fontSize: 15, fontWeight: 600, color: '#0d0d14', outline: 'none', background: '#fff', boxSizing: 'border-box' }}
                />
                {valorPago && <div style={{ fontSize: 11, color: '#9ca3af', marginTop: 4 }}>{fmt(Number(valorPago))}</div>}
              </div>

              {/* Comprobante */}
              {!previsualizacion ? (
                <label style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '12px 14px', borderRadius: 10, border: '1.5px dashed #e5e7eb', cursor: 'pointer', background: '#fff' }}>
                  <input type="file" accept="image/*" onChange={seleccionarArchivo} style={{ display: 'none' }} />
                  <Upload size={16} color="#9ca3af" />
                  <span style={{ fontSize: 13, color: '#9ca3af' }}>Subir comprobante (opcional)</span>
                </label>
              ) : (
                <div style={{ position: 'relative' }}>
                  <img src={previsualizacion} alt="Comprobante" style={{ width: '100%', borderRadius: 10, maxHeight: 180, objectFit: 'cover' }} />
                  <button onClick={() => { setArchivo(null); setPrevisualizacion(null) }}
                    style={{ position: 'absolute', top: 8, right: 8, width: 26, height: 26, borderRadius: '50%', background: 'rgba(0,0,0,0.5)', border: 'none', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer' }}>
                    <X size={13} color="#fff" />
                  </button>
                </div>
              )}

              <div style={{ display: 'flex', gap: 8 }}>
                <button onClick={() => { setMostrarFormPago(false); setValorPago(''); setArchivo(null); setPrevisualizacion(null) }}
                  style={{ flex: 1, padding: '10px', borderRadius: 10, fontSize: 13, background: '#f3f4f6', border: 'none', cursor: 'pointer', color: '#6b7280', fontWeight: 500 }}>
                  Cancelar
                </button>
                <button onClick={registrarPago} disabled={!valorPago || guardandoPago}
                  style={{ flex: 1, padding: '10px', borderRadius: 10, fontSize: 13, background: !valorPago ? '#e5e7eb' : '#0f1787', border: 'none', cursor: !valorPago ? 'not-allowed' : 'pointer', color: !valorPago ? '#9ca3af' : '#fff', fontWeight: 500 }}>
                  {guardandoPago ? 'Guardando...' : 'Confirmar pago'}
                </button>
              </div>
            </div>
          )}

          {/* Lista pagos */}
          {pagos.length === 0 ? (
            <div style={{ textAlign: 'center', color: '#9ca3af', fontSize: 13, padding: '20px 0' }}>Sin pagos registrados</div>
          ) : pagos.map(p => (
            <div key={p.id} style={{ marginBottom: 10 }}>
              {borrandoId === p.id ? (
                <div style={{ background: '#fee2e2', borderRadius: 10, padding: '12px 14px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10 }}>
                  <span style={{ fontSize: 13, color: '#991b1b', fontWeight: 500 }}>¿Borrar este pago?</span>
                  <div style={{ display: 'flex', gap: 8 }}>
                    <button onClick={() => setBorrandoId(null)} style={{ padding: '5px 12px', borderRadius: 20, fontSize: 12, background: '#fff', border: '0.5px solid #e5e7eb', cursor: 'pointer', color: '#6b7280' }}>Cancelar</button>
                    <button onClick={() => borrarPago(p.id)} style={{ padding: '5px 12px', borderRadius: 20, fontSize: 12, background: '#dc2626', border: 'none', cursor: 'pointer', color: '#fff', fontWeight: 500 }}>Borrar</button>
                  </div>
                </div>
              ) : (
                <div style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '10px 0', borderBottom: '0.5px solid #f3f4f6' }}>
                  <div style={{ flex: 1 }}>
                    <div style={{ fontSize: 14, fontWeight: 600, color: '#166534' }}>{fmt(p.valor)}</div>
                    <div style={{ fontSize: 11, color: '#9ca3af', marginTop: 2 }}>
                      {new Date(p.created_at).toLocaleDateString('es-CO', { day: 'numeric', month: 'short', year: 'numeric' })}
                    </div>
                    {p.comprobante_url && (
                      <a href={p.comprobante_url} target="_blank" rel="noopener noreferrer"
                        style={{ fontSize: 11, color: '#0f1787', marginTop: 4, display: 'inline-block', textDecoration: 'underline' }}>
                        Ver comprobante
                      </a>
                    )}
                  </div>
                  <button onClick={() => setBorrandoId(p.id)}
                    style={{ width: 30, height: 30, borderRadius: '50%', background: '#fee2e2', border: 'none', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', flexShrink: 0 }}>
                    <Trash2 size={13} color="#dc2626" />
                  </button>
                </div>
              )}
            </div>
          ))}
        </div>

        {servidor.observaciones && (
          <div style={{ background: '#fff', borderRadius: 14, padding: '16px', border: '0.5px solid #e5e7eb' }}>
            <div style={{ fontSize: 12, fontWeight: 600, color: '#0f1787', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 8 }}>Observaciones</div>
            <div style={{ fontSize: 13, color: '#374151', lineHeight: 1.6 }}>{servidor.observaciones}</div>
          </div>
        )}
      </div>
    </div>
  )
}
