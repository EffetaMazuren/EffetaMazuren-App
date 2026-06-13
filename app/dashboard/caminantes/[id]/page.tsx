'use client'
import { useEffect, useState } from 'react'
import { useRouter, useParams } from 'next/navigation'
import { supabase } from '@/lib/supabase'
import { ArrowLeft, Download, MoreHorizontal, Plus, Mail, CheckCircle, EyeOff, ChevronDown } from 'lucide-react'

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
  return (
    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '10px 0', borderBottom: '0.5px solid #f3f4f6' }}>
      <span style={{ fontSize: 12, color: '#9ca3af' }}>{label}</span>
      <span style={{ fontSize: 13, fontWeight: 500, color: valueColor || '#111827', textAlign: 'right', maxWidth: '60%' }}>{value || '—'}</span>
    </div>
  )
}

export default function FichaCaminante() {
  const router = useRouter()
  const { id } = useParams()
  const [cam, setCam] = useState<any>(null)
  const [pagos, setPagos] = useState<any[]>([])
  const [contactos, setContactos] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [enviandoCorreo, setEnviandoCorreo] = useState(false)
  const [modalPago, setModalPago] = useState(false)
  const [nuevoPago, setNuevoPago] = useState('')

  useEffect(() => {
    async function cargar() {
      const { data: c } = await supabase.from('vista_pagos_caminantes').select('*').eq('id', id).single()
      setCam(c)
      const { data: p } = await supabase.from('pagos').select('*').eq('persona_id', id).order('fecha')
      setPagos(p || [])
      const { data: ct } = await supabase.from('contactos_emergencia').select('*').eq('persona_id', id).order('orden')
      setContactos(ct || [])
      setLoading(false)
    }
    cargar()
  }, [id])

  async function registrarPago() {
    const valor = parseFloat(nuevoPago.replace(/\./g, '').replace(',', '.'))
    if (!valor || valor <= 0) return alert('Ingresa un valor válido')
    const { data: r } = await supabase.from('retiros').select('id').eq('estado', 'activo').single()
    const { error } = await supabase.from('pagos').insert({
      persona_id: id, tipo_persona: 'caminante',
      retiro_id: r?.id, valor, fecha: new Date().toISOString().split('T')[0],
    })
    if (error) alert('Error: ' + error.message)
    else { setModalPago(false); setNuevoPago(''); window.location.reload() }
  }

  async function enviarCorreo() {
    if (!cam) return
    setEnviandoCorreo(true)
    const res = await fetch('/api/correos/inscripcion', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ caminante_id: cam.id }),
    })
    if (res.ok) {
      alert('✅ Correo enviado correctamente')
      window.location.reload()
    } else {
      alert('Error enviando correo')
    }
    setEnviandoCorreo(false)
  }

  if (loading) return <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: '100vh' }}><div style={{ color: '#9ca3af' }}>Cargando...</div></div>
  if (!cam) return <div style={{ padding: 20 }}>Caminante no encontrado</div>

  const pct = Math.min(Math.round((cam.total_pagado / 500000) * 100), 100)

  return (
    <div style={{ background: '#f7f8fc', minHeight: '100vh', paddingBottom: 40 }}>
      {/* Nav */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '16px 20px 12px' }}>
        <button onClick={() => router.back()} style={{ display: 'flex', alignItems: 'center', gap: 6, color: '#9ca3af', fontSize: 13, background: 'none', border: 'none', cursor: 'pointer' }}>
          <ArrowLeft size={16} /> Caminantes
        </button>
        <div style={{ display: 'flex', gap: 8 }}>
          <button style={{ width: 34, height: 34, borderRadius: '50%', background: '#fff', border: '0.5px solid #e5e7eb', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer' }}><Download size={16} color="#6b7280" /></button>
          <button style={{ width: 34, height: 34, borderRadius: '50%', background: '#fff', border: '0.5px solid #e5e7eb', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer' }}><MoreHorizontal size={16} color="#6b7280" /></button>
        </div>
      </div>

      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', padding: '4px 20px 16px', gap: 12 }}>
        <div>
          <div style={{ fontSize: 22, fontWeight: 500, color: '#0d0d14', letterSpacing: -0.3 }}>{cam.nombre}</div>
          <div style={{ fontSize: 12, color: '#9ca3af', marginTop: 2 }}>C.C. {cam.numero_documento}</div>
          <div style={{ display: 'flex', gap: 6, marginTop: 8, flexWrap: 'wrap' }}>
            {cam.estado_pago === 'completo' && <Chip label="Pago completo" bg="#dcfce7" color="#166534" />}
            {cam.estado_pago === 'parcial' && <Chip label="Abono parcial" bg="#fef3c7" color="#92400e" />}
            {cam.estado_pago === 'sin_pago' && <Chip label="Sin pago" bg="#f3f4f6" color="#6b7280" />}
            {cam.es_sorpresa && <Chip label="Sorpresa" bg="#ede9fe" color="#5b21b6" />}
          </div>
        </div>
        <div style={{ textAlign: 'right', flexShrink: 0 }}>
          {cam.inscrito_oficialmente && (
            <div style={{ display: 'inline-flex', alignItems: 'center', gap: 6, background: '#0f1787', color: '#fff', padding: '5px 14px', borderRadius: 6, fontSize: 12, fontWeight: 500 }}>
              <CheckCircle size={13} /> Inscrito
            </div>
          )}
          <div style={{ fontSize: 11, color: '#9ca3af', marginTop: 5 }}>
            {cam.inscrito_oficialmente ? 'Cupo asegurado' : 'Sin cupo aún'}
          </div>
        </div>
      </div>

      {/* Banner inscrito */}
      {cam.inscrito_oficialmente && (
        <div style={{ margin: '0 20px 14px', background: '#0f1787', borderRadius: 12, padding: '12px 16px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <div style={{ width: 30, height: 30, borderRadius: 8, background: 'rgba(255,255,255,0.15)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <CheckCircle size={15} color="#fff" />
            </div>
            <div>
              <div style={{ fontSize: 13, fontWeight: 500, color: '#fff' }}>Inscripción confirmada</div>
              <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.6)', marginTop: 1 }}>
                {new Date(cam.fecha_inscripcion).toLocaleDateString('es-CO', { day: 'numeric', month: 'long', year: 'numeric' })}
              </div>
            </div>
          </div>
          <div style={{ color: 'rgba(255,255,255,0.7)', fontSize: 11, textAlign: 'right' }}>Retiro<br/>Jul 2026</div>
        </div>
      )}

      {/* Alerta sorpresa */}
      {cam.es_sorpresa && (
        <div style={{ margin: '0 20px 14px', background: '#f5f3ff', border: '0.5px solid #c4b5fd', borderRadius: 10, padding: '10px 14px', display: 'flex', alignItems: 'flex-start', gap: 8 }}>
          <EyeOff size={14} color="#5b21b6" style={{ marginTop: 1, flexShrink: 0 }} />
          <span style={{ fontSize: 12, color: '#5b21b6' }}>
            <strong>Retiro sorpresa.</strong> {contactos[0] ? `Contactar a: ${contactos[0].nombre} (${contactos[0].parentesco}) · ${contactos[0].celular}` : 'Ver contactos de emergencia'}
          </span>
        </div>
      )}

      {/* Acciones */}
      <div style={{ display: 'flex', gap: 8, padding: '0 20px 16px', flexWrap: 'wrap' }}>
        <button onClick={enviarCorreo} disabled={enviandoCorreo} style={{ display: 'inline-flex', alignItems: 'center', gap: 6, padding: '8px 14px', border: 'none', borderRadius: 8, fontSize: 12, fontWeight: 500, cursor: 'pointer', background: '#0f1787', color: '#fff' }}>
          <Mail size={14} /> {enviandoCorreo ? 'Enviando...' : cam.es_sorpresa ? 'Correo al contacto' : 'Enviar correo'}
        </button>
        <button onClick={() => setModalPago(true)} style={{ display: 'inline-flex', alignItems: 'center', gap: 6, padding: '8px 14px', border: '0.5px solid #e5e7eb', borderRadius: 8, fontSize: 12, fontWeight: 500, cursor: 'pointer', background: '#fff', color: '#0d0d14' }}>
          <Plus size={14} /> Registrar pago
        </button>
      </div>

      {/* Card de pago — siempre visible */}
      <div style={{ margin: '0 20px 12px', background: '#fff', borderRadius: 14, border: '0.5px solid #e5e7eb', overflow: 'hidden' }}>
        <div style={{ padding: '12px 16px 10px', borderBottom: '0.5px solid #edf0f7', display: 'flex', alignItems: 'center', gap: 8, background: '#f8fdf9' }}>
          <span style={{ fontSize: 11, fontWeight: 500, letterSpacing: 0.8, textTransform: 'uppercase', color: '#16a34a' }}>Estado de pago</span>
        </div>
        <div style={{ padding: '14px 16px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', padding: '6px 0', borderBottom: '0.5px solid #f1f2f6', fontSize: 13 }}>
            <span style={{ color: '#6b7194' }}>Total requerido</span><span style={{ fontWeight: 500 }}>{fmt(500000)}</span>
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-between', padding: '6px 0', borderBottom: '0.5px solid #f1f2f6', fontSize: 13 }}>
            <span style={{ color: '#6b7194' }}>Total pagado</span><span style={{ fontWeight: 500, color: '#166534' }}>{fmt(cam.total_pagado)}</span>
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-between', padding: '6px 0', fontSize: 13 }}>
            <span style={{ color: '#6b7194' }}>Saldo pendiente</span><span style={{ fontWeight: 500, color: cam.saldo_pendiente > 0 ? '#92400e' : '#166534' }}>{fmt(Math.max(cam.saldo_pendiente, 0))}</span>
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
              <div style={{ fontSize: 11, fontWeight: 500, color: '#9ca3af', margin: '12px 0 6px', textTransform: 'uppercase', letterSpacing: 0.5 }}>Historial de abonos</div>
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
                    {p.comprobante_url && <a href={p.comprobante_url} target="_blank" style={{ fontSize: 11, color: '#0f1787' }}>Ver comprobante</a>}
                  </div>
                </div>
              ))}
            </>
          )}
        </div>
      </div>

      {/* Acordeones */}
      <div style={{ padding: '0 20px' }}>
        <Accordion title="Datos personales" dot="#0f1787">
          <DataRow label="Celular" value={cam.celular} />
          <DataRow label="Correo" value={cam.correo} />
          <DataRow label="Estado correo" value={cam.estado_correo === 'sin_enviar' ? '⏳ Pendiente' : cam.estado_correo === 'enviado' ? '✓ Enviado' : '✓ Enviado al contacto'} valueColor={cam.estado_correo === 'sin_enviar' ? '#d97706' : '#166534'} />
        </Accordion>

        <Accordion title="Salud" dot="#dc2626">
          <DataRow label="EPS" value={cam.eps} />
          <DataRow label="Alergias" value={cam.alergias} />
          <DataRow label="Restricciones" value={cam.restricciones_alimentarias} />
          <DataRow label="Medicamentos" value={cam.medicamentos} />
        </Accordion>

        <Accordion title="Contactos de emergencia" dot="#7c3aed" hint={`${contactos.length}`}>
          {contactos.map(c => (
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
          <DataRow label="Inscripción" value={new Date(cam.fecha_inscripcion).toLocaleDateString('es-CO', { day: 'numeric', month: 'long', year: 'numeric' })} />
          <DataRow label="Correo inscripción" value={cam.estado_correo === 'sin_enviar' ? 'Pendiente' : '✓ Enviado'} valueColor={cam.estado_correo === 'sin_enviar' ? '#9ca3af' : '#166534'} />
          <DataRow label="Correo pago completo" value={cam.estado_pago === 'completo' ? '✓ Enviado' : 'Pendiente de pago'} valueColor={cam.estado_pago === 'completo' ? '#166534' : '#9ca3af'} />
        </Accordion>
      </div>

      {/* Modal pago */}
      {modalPago && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'flex-end', zIndex: 200 }}>
          <div style={{ background: '#fff', borderRadius: '16px 16px 0 0', padding: 24, width: '100%' }}>
            <div style={{ fontSize: 16, fontWeight: 500, color: '#0d0d14', marginBottom: 16 }}>Registrar abono</div>
            <div style={{ fontSize: 12, color: '#9ca3af', marginBottom: 6 }}>Valor del abono (COP)</div>
            <input
              type="number"
              value={nuevoPago}
              onChange={e => setNuevoPago(e.target.value)}
              placeholder="Ej: 250000"
              style={{ width: '100%', height: 44, border: '0.5px solid #e5e7eb', borderRadius: 10, padding: '0 14px', fontSize: 16, marginBottom: 12, outline: 'none' }}
            />
            <div style={{ display: 'flex', gap: 8 }}>
              <button onClick={() => setModalPago(false)} style={{ flex: 1, height: 44, border: '0.5px solid #e5e7eb', borderRadius: 10, background: '#fff', fontSize: 14, fontWeight: 500, cursor: 'pointer' }}>Cancelar</button>
              <button onClick={registrarPago} style={{ flex: 1, height: 44, border: 'none', borderRadius: 10, background: '#0f1787', color: '#fff', fontSize: 14, fontWeight: 500, cursor: 'pointer' }}>Guardar</button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
