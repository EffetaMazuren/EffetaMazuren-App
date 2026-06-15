'use client'

import { useEffect, useState, useRef } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'

const RETIRO_ID = '21da7588-f7d9-4bf8-a6f6-ae6c8258c00e'
const BUCKET = 'comprobantes-pagos'

interface Comprobante {
  id: string
  monto: number
  fecha: string
  url_comprobante: string | null
  descripcion: string | null
  estado: string | null
}

interface PagoResumen {
  total_pagado: number
  costo_retiro: number
  estado_pago: string
  saldo_pendiente: number
}

export default function PagoServidor() {
  const router = useRouter()
  const fileRef = useRef<HTMLInputElement>(null)
  const [comprobantes, setComprobantes] = useState<Comprobante[]>([])
  const [resumen, setResumen] = useState<PagoResumen | null>(null)
  const [inscripcionId, setInscripcionId] = useState('')
  const [loading, setLoading] = useState(true)
  const [subiendo, setSubiendo] = useState(false)
  const [error, setError] = useState('')
  const [exito, setExito] = useState('')

  useEffect(() => {
    const cargar = async () => {
      const { data: { session } } = await supabase.auth.getSession()
      if (!session) { router.push('/'); return }

      const { data: srv } = await supabase
        .from('servidores_inscripcion')
        .select('id, es_interno')
        .eq('usuario_id', session.user.id)
        .eq('retiro_id', RETIRO_ID)
        .single()

      if (!srv) return

      setInscripcionId(srv.id)

      const { data: pagoData } = await supabase
        .from('vista_pagos_servidores')
        .select('*')
        .eq('servidor_id', srv.id)
        .single()

      const costo: number = srv.es_interno ? 380000 : 0
      const pagado: number = pagoData?.total_pagado ?? 0

      setResumen({
        total_pagado: pagado,
        costo_retiro: costo,
        estado_pago: pagoData?.estado_pago ?? 'sin_pago',
        saldo_pendiente: Math.max(0, costo - pagado)
      })

      const { data: transacciones } = await supabase
        .from('transacciones')
        .select('id, monto, fecha, url_comprobante, descripcion, estado')
        .eq('servidor_inscripcion_id', srv.id)
        .order('fecha', { ascending: false })

      setComprobantes(transacciones ?? [])
      setLoading(false)
    }
    cargar()
  }, [router])

  const subirComprobante = async (archivo: File) => {
    if (!inscripcionId) return
    if (!['image/jpeg', 'image/png', 'image/webp', 'application/pdf'].includes(archivo.type)) {
      setError('Solo se permiten imágenes (JPG, PNG, WEBP) o PDF')
      return
    }
    if (archivo.size > 5 * 1024 * 1024) {
      setError('El archivo no puede pesar más de 5 MB')
      return
    }

    setSubiendo(true)
    setError('')
    setExito('')

    const ext = archivo.name.split('.').pop()
    const nombre = `servidores/${inscripcionId}/${Date.now()}.${ext}`

    const { error: upErr } = await supabase.storage
      .from(BUCKET)
      .upload(nombre, archivo, { upsert: false })

    if (upErr) {
      setError('Error al subir archivo: ' + upErr.message)
      setSubiendo(false)
      return
    }

    const { data: urlData } = supabase.storage.from(BUCKET).getPublicUrl(nombre)

    const { error: txErr } = await supabase
      .from('transacciones')
      .insert({
        servidor_inscripcion_id: inscripcionId,
        retiro_id: RETIRO_ID,
        monto: 0,
        fecha: new Date().toISOString().split('T')[0],
        url_comprobante: urlData.publicUrl,
        descripcion: 'Comprobante subido por servidor — pendiente verificación',
        estado: 'pendiente_verificacion',
        tipo: 'ingreso'
      })

    if (txErr) {
      setError('Error al registrar: ' + txErr.message)
    } else {
      setExito('✅ Comprobante enviado. Un líder lo verificará pronto.')
      const { data } = await supabase
        .from('transacciones')
        .select('id, monto, fecha, url_comprobante, descripcion, estado')
        .eq('servidor_inscripcion_id', inscripcionId)
        .order('fecha', { ascending: false })
      setComprobantes(data ?? [])
    }

    setSubiendo(false)
    if (fileRef.current) fileRef.current.value = ''
  }

  const estadoPagoColor: Record<string, string> = {
    completo: '#16a34a',
    parcial: '#d97706',
    sin_pago: '#6b7280',
    sorpresa: '#7c3aed',
    pendiente_verificacion: '#d97706'
  }

  if (loading) return (
    <div style={{ display: 'flex', justifyContent: 'center', padding: 60 }}>
      <div style={{
        width: 32, height: 32, border: '3px solid #e2e4f0',
        borderTopColor: '#0f1787', borderRadius: '50%',
        animation: 'spin 0.8s linear infinite'
      }} />
      <style>{`@keyframes spin{to{transform:rotate(360deg)}}`}</style>
    </div>
  )

  const porcentaje = resumen && resumen.costo_retiro > 0
    ? Math.min(100, Math.round((resumen.total_pagado / resumen.costo_retiro) * 100))
    : 100

  return (
    <div style={{ padding: '20px 16px', maxWidth: 480, margin: '0 auto' }}>
      <h1 style={{ fontSize: 20, fontWeight: 700, color: '#111827', margin: '0 0 20px' }}>
        💳 Mi Pago
      </h1>

      {resumen && (
        <div style={{
          background: 'white', borderRadius: 14,
          border: '1.5px solid #e8eaf0', padding: '20px', marginBottom: 20
        }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 16 }}>
            <div>
              <div style={{ fontSize: 12, color: '#6b7280', marginBottom: 4 }}>TOTAL PAGADO</div>
              <div style={{ fontSize: 26, fontWeight: 700, color: '#111827' }}>
                ${resumen.total_pagado.toLocaleString('es-CO')}
              </div>
            </div>
            <div style={{ textAlign: 'right' }}>
              <div style={{ fontSize: 12, color: '#6b7280', marginBottom: 4 }}>PENDIENTE</div>
              <div style={{
                fontSize: 26, fontWeight: 700,
                color: resumen.saldo_pendiente > 0 ? '#d97706' : '#16a34a'
              }}>
                ${resumen.saldo_pendiente.toLocaleString('es-CO')}
              </div>
            </div>
          </div>

          <div style={{ height: 8, background: '#f3f4f6', borderRadius: 6, overflow: 'hidden' }}>
            <div style={{
              height: '100%', width: `${porcentaje}%`,
              background: porcentaje === 100 ? '#16a34a' : '#d97706',
              borderRadius: 6, transition: 'width 0.6s'
            }} />
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 6 }}>
            <span style={{ fontSize: 12, color: '#6b7280' }}>{porcentaje}% pagado</span>
            <span style={{ fontSize: 12, color: '#6b7280' }}>
              Total: ${resumen.costo_retiro.toLocaleString('es-CO')}
            </span>
          </div>
        </div>
      )}

      <div style={{
        background: 'white', borderRadius: 14,
        border: '1.5px dashed #c7d0ff', padding: '20px', marginBottom: 20
      }}>
        <h3 style={{ margin: '0 0 8px', fontSize: 15, color: '#111827', fontWeight: 600 }}>
          📎 Subir comprobante de pago
        </h3>
        <p style={{ margin: '0 0 16px', fontSize: 13, color: '#6b7280', lineHeight: 1.5 }}>
          Sube tu screenshot o PDF del comprobante de transferencia.
          Un líder lo verificará y actualizará tu saldo.
        </p>

        <input
          ref={fileRef}
          type="file"
          accept="image/jpeg,image/png,image/webp,application/pdf"
          onChange={e => e.target.files?.[0] && subirComprobante(e.target.files[0])}
          style={{ display: 'none' }}
          id="file-comprobante"
        />

        {error && (
          <p style={{
            color: '#dc2626', fontSize: 13, margin: '0 0 12px',
            background: '#fef2f2', padding: '8px 12px', borderRadius: 8
          }}>{error}</p>
        )}

        {exito && (
          <p style={{
            color: '#16a34a', fontSize: 13, margin: '0 0 12px',
            background: '#f0fdf4', padding: '8px 12px', borderRadius: 8
          }}>{exito}</p>
        )}

        <label
          htmlFor="file-comprobante"
          style={{
            display: 'block', width: '100%', padding: '12px',
            background: subiendo ? '#9ca3af' : '#0f1787',
            color: 'white', borderRadius: 10, textAlign: 'center',
            fontSize: 14, fontWeight: 600,
            cursor: subiendo ? 'not-allowed' : 'pointer',
            boxSizing: 'border-box'
          }}
        >
          {subiendo ? '⏳ Subiendo...' : '📷 Seleccionar archivo'}
        </label>
        <p style={{ margin: '8px 0 0', fontSize: 11, color: '#9ca3af', textAlign: 'center' }}>
          JPG, PNG, WEBP o PDF · Máx 5MB
        </p>
      </div>

      {comprobantes.length > 0 ? (
        <div>
          <h3 style={{ margin: '0 0 12px', fontSize: 15, color: '#374151', fontWeight: 600 }}>
            Historial de pagos
          </h3>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            {comprobantes.map(c => (
              <div
                key={c.id}
                style={{
                  background: 'white', border: '1.5px solid #e8eaf0',
                  borderRadius: 12, padding: '14px 16px',
                  display: 'flex', justifyContent: 'space-between', alignItems: 'center'
                }}
              >
                <div>
                  <div style={{ fontWeight: 600, fontSize: 15, color: '#111827' }}>
                    {c.monto > 0
                      ? `$${c.monto.toLocaleString('es-CO')}`
                      : 'Monto por verificar'}
                  </div>
                  <div style={{ fontSize: 12, color: '#6b7280', marginTop: 2 }}>
                    {c.fecha
                      ? new Date(c.fecha + 'T12:00:00').toLocaleDateString('es-CO', {
                          day: 'numeric', month: 'long', year: 'numeric'
                        })
                      : '—'}
                  </div>
                  {c.estado && (
                    <div style={{
                      display: 'inline-block', marginTop: 4,
                      fontSize: 11, padding: '2px 8px', borderRadius: 20,
                      background: c.estado === 'pendiente_verificacion' ? '#fffbeb' : '#f0fdf4',
                      color: estadoPagoColor[c.estado] ?? '#6b7280',
                      fontWeight: 600
                    }}>
                      {c.estado === 'pendiente_verificacion' ? '⏳ Pendiente' : '✅ Verificado'}
                    </div>
                  )}
                </div>
                {c.url_comprobante ? (
  
    href={c.url_comprobante}
    target="_blank"
    rel="noopener noreferrer"
    style={{
      padding: '8px 12px', background: '#f0f2ff',
      color: '#0f1787', borderRadius: 8, fontSize: 12,
      fontWeight: 600, textDecoration: 'none',
      flexShrink: 0, marginLeft: 12
    }}
  >
    Ver →
  </a>
) : null}
                    href={c.url_comprobante}
                    target="_blank"
                    rel="noopener noreferrer"
                    style={{
                      padding: '8px 12px', background: '#f0f2ff',
                      color: '#0f1787', borderRadius: 8, fontSize: 12,
                      fontWeight: 600, textDecoration: 'none',
                      flexShrink: 0, marginLeft: 12
                    }}
                  >
                    Ver →
                  </a>
                )}
              </div>
            ))}
          </div>
        </div>
      ) : (
        <div style={{
          textAlign: 'center', padding: '32px 20px',
          color: '#9ca3af', fontSize: 14
        }}>
          <div style={{ fontSize: 40, marginBottom: 8 }}>📭</div>
          <p style={{ margin: 0 }}>No hay comprobantes registrados aún</p>
        </div>
      )}
    </div>
  )
}
