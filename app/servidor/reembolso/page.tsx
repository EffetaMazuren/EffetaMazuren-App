'use client'

import { useEffect, useState, useRef } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'

const RETIRO_ID = '21da7588-f7d9-4bf8-a6f6-ae6c8258c00e'
const BUCKET = 'comprobantes-pagos'

interface Factura {
  id: string
  monto: number
  fecha: string
  descripcion: string | null
  url_comprobante: string | null
  estado: string | null
}

export default function ReembolsoServidor() {
  const router = useRouter()
  const fileRef = useRef<HTMLInputElement>(null)
  const [facturas, setFacturas] = useState<Factura[]>([])
  const [inscripcionId, setInscripcionId] = useState('')
  const [loading, setLoading] = useState(true)
  const [subiendo, setSubiendo] = useState(false)
  const [error, setError] = useState('')
  const [exito, setExito] = useState('')
  const [monto, setMonto] = useState('')
  const [descripcion, setDescripcion] = useState('')
  const [archivoSeleccionado, setArchivoSeleccionado] = useState<File | null>(null)

  useEffect(() => {
    const cargar = async () => {
      const { data: { session } } = await supabase.auth.getSession()
      if (!session) { router.push('/'); return }

      const { data: srv } = await supabase
        .from('servidores_inscripcion')
        .select('id')
        .eq('usuario_id', session.user.id)
        .eq('retiro_id', RETIRO_ID)
        .single()

      if (!srv) return
      setInscripcionId(srv.id)

      const { data } = await supabase
        .from('transacciones')
        .select('id, monto, fecha, descripcion, url_comprobante, estado')
        .eq('servidor_inscripcion_id', srv.id)
        .eq('tipo', 'egreso')
        .order('fecha', { ascending: false })

      setFacturas(data ?? [])
      setLoading(false)
    }
    cargar()
  }, [router])

  const handleArchivoChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    if (!['image/jpeg', 'image/png', 'image/webp', 'application/pdf'].includes(file.type)) {
      setError('Solo se permiten imágenes (JPG, PNG, WEBP) o PDF')
      return
    }
    if (file.size > 5 * 1024 * 1024) {
      setError('El archivo no puede pesar más de 5 MB')
      return
    }
    setArchivoSeleccionado(file)
    setError('')
  }

  const enviarReembolso = async () => {
    if (!monto || isNaN(Number(monto.replace(/[.,]/g, '')))) {
      setError('Ingresa un monto válido')
      return
    }
    if (!descripcion.trim()) {
      setError('Describe para qué fue la compra')
      return
    }
    if (!archivoSeleccionado) {
      setError('Debes adjuntar la factura o foto del recibo')
      return
    }

    setSubiendo(true)
    setError('')

    const ext = archivoSeleccionado.name.split('.').pop()
    const nombre = `finanzas/${RETIRO_ID}/reembolso_${inscripcionId}_${Date.now()}.${ext}`

    const { error: upErr } = await supabase.storage
      .from(BUCKET)
      .upload(nombre, archivoSeleccionado, { upsert: false })

    if (upErr) {
      setError('Error al subir archivo: ' + upErr.message)
      setSubiendo(false)
      return
    }

    const { data: urlData } = supabase.storage.from(BUCKET).getPublicUrl(nombre)

    const montoNum = parseInt(monto.replace(/[.,\s]/g, ''), 10)
    const { error: txErr } = await supabase
      .from('transacciones')
      .insert({
        servidor_inscripcion_id: inscripcionId,
        retiro_id: RETIRO_ID,
        monto: montoNum,
        fecha: new Date().toISOString().split('T')[0],
        url_comprobante: urlData.publicUrl,
        descripcion: descripcion.trim(),
        estado: 'pendiente_aprobacion',
        tipo: 'egreso'
      })

    if (txErr) {
      setError('Error al registrar: ' + txErr.message)
    } else {
      setExito('✅ Solicitud de reembolso enviada. Un líder la revisará pronto.')
      setMonto('')
      setDescripcion('')
      setArchivoSeleccionado(null)
      if (fileRef.current) fileRef.current.value = ''

      const { data } = await supabase
        .from('transacciones')
        .select('id, monto, fecha, descripcion, url_comprobante, estado')
        .eq('servidor_inscripcion_id', inscripcionId)
        .eq('tipo', 'egreso')
        .order('fecha', { ascending: false })
      setFacturas(data ?? [])
    }

    setSubiendo(false)
  }

  const abrirArchivo = (url: string) => {
    window.open(url, '_blank', 'noopener,noreferrer')
  }

  const totalPendiente = facturas
    .filter(f => f.estado === 'pendiente_aprobacion')
    .reduce((s, f) => s + (f.monto || 0), 0)

  const totalAprobado = facturas
    .filter(f => f.estado === 'aprobado')
    .reduce((s, f) => s + (f.monto || 0), 0)

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

  return (
    <div style={{ padding: '20px 16px', maxWidth: 480, margin: '0 auto' }}>
      <h1 style={{ fontSize: 20, fontWeight: 700, color: '#111827', margin: '0 0 20px' }}>
        🧾 Reembolsos
      </h1>

      {facturas.length > 0 && (
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginBottom: 20 }}>
          <div style={{
            background: '#fffbeb', border: '1.5px solid #fde68a',
            borderRadius: 12, padding: '14px 16px'
          }}>
            <div style={{ fontSize: 12, color: '#6b7280', marginBottom: 4 }}>POR APROBAR</div>
            <div style={{ fontSize: 20, fontWeight: 700, color: '#d97706' }}>
              ${totalPendiente.toLocaleString('es-CO')}
            </div>
          </div>
          <div style={{
            background: '#f0fdf4', border: '1.5px solid #bbf7d0',
            borderRadius: 12, padding: '14px 16px'
          }}>
            <div style={{ fontSize: 12, color: '#6b7280', marginBottom: 4 }}>APROBADO</div>
            <div style={{ fontSize: 20, fontWeight: 700, color: '#16a34a' }}>
              ${totalAprobado.toLocaleString('es-CO')}
            </div>
          </div>
        </div>
      )}

      <div style={{
        background: 'white', border: '1.5px solid #e8eaf0',
        borderRadius: 14, padding: '20px', marginBottom: 20
      }}>
        <h3 style={{ margin: '0 0 16px', fontSize: 15, color: '#111827', fontWeight: 600 }}>
          Nueva solicitud de reembolso
        </h3>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          <div>
            <label style={{ display: 'block', fontSize: 13, fontWeight: 600, color: '#374151', marginBottom: 6 }}>
              Monto (COP)
            </label>
            <input
              type="number"
              value={monto}
              onChange={e => { setMonto(e.target.value); setError('') }}
              placeholder="Ej: 45000"
              style={{
                width: '100%', padding: '11px 14px', borderRadius: 10,
                border: '1.5px solid #e2e4f0', fontSize: 15,
                outline: 'none', boxSizing: 'border-box', fontFamily: 'inherit'
              }}
            />
          </div>

          <div>
            <label style={{ display: 'block', fontSize: 13, fontWeight: 600, color: '#374151', marginBottom: 6 }}>
              Para qué fue la compra
            </label>
            <textarea
              value={descripcion}
              onChange={e => { setDescripcion(e.target.value); setError('') }}
              placeholder="Ej: Impresión de formatos para el retiro..."
              rows={3}
              style={{
                width: '100%', padding: '11px 14px', borderRadius: 10,
                border: '1.5px solid #e2e4f0', fontSize: 14,
                outline: 'none', boxSizing: 'border-box',
                fontFamily: 'inherit', resize: 'vertical', lineHeight: 1.5
              }}
            />
          </div>

          <div>
            <label style={{ display: 'block', fontSize: 13, fontWeight: 600, color: '#374151', marginBottom: 6 }}>
              Factura o foto del recibo
            </label>
            <input
              ref={fileRef}
              type="file"
              accept="image/jpeg,image/png,image/webp,application/pdf"
              onChange={handleArchivoChange}
              style={{ display: 'none' }}
              id="file-factura"
            />
            <label htmlFor="file-factura" style={{
              display: 'flex', alignItems: 'center', gap: 10,
              padding: '11px 14px', border: '1.5px dashed #c7d0ff',
              borderRadius: 10, cursor: 'pointer'
            }}>
              <span style={{ fontSize: 20 }}>📎</span>
              <span style={{ fontSize: 13, color: archivoSeleccionado ? '#111827' : '#9ca3af' }}>
                {archivoSeleccionado ? archivoSeleccionado.name : 'Seleccionar archivo'}
              </span>
            </label>
          </div>
        </div>

        {error && (
          <p style={{
            color: '#dc2626', fontSize: 13, margin: '12px 0 0',
            background: '#fef2f2', padding: '8px 12px', borderRadius: 8
          }}>{error}</p>
        )}

        {exito && (
          <p style={{
            color: '#16a34a', fontSize: 13, margin: '12px 0 0',
            background: '#f0fdf4', padding: '8px 12px', borderRadius: 8
          }}>{exito}</p>
        )}

        <button
          onClick={enviarReembolso}
          disabled={subiendo}
          style={{
            marginTop: 16, width: '100%', padding: '12px',
            background: subiendo ? '#9ca3af' : '#0f1787',
            color: 'white', border: 'none', borderRadius: 10,
            fontSize: 14, fontWeight: 600,
            cursor: subiendo ? 'not-allowed' : 'pointer'
          }}
        >
          {subiendo ? '⏳ Enviando...' : 'Enviar solicitud'}
        </button>
      </div>

      {facturas.length > 0 ? (
        <div>
          <h3 style={{ margin: '0 0 12px', fontSize: 15, color: '#374151', fontWeight: 600 }}>
            Mis solicitudes
          </h3>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {facturas.map(f => (
              <div key={f.id} style={{
                background: 'white', border: '1.5px solid #e8eaf0',
                borderRadius: 12, padding: '14px 16px'
              }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                  <div style={{ flex: 1 }}>
                    <div style={{ fontWeight: 600, fontSize: 15, color: '#111827' }}>
                      ${f.monto.toLocaleString('es-CO')}
                    </div>
                    {f.descripcion && (
                      <div style={{ fontSize: 13, color: '#374151', marginTop: 3, lineHeight: 1.4 }}>
                        {f.descripcion}
                      </div>
                    )}
                    <div style={{ fontSize: 12, color: '#6b7280', marginTop: 4 }}>
                      {f.fecha
                        ? new Date(f.fecha + 'T12:00:00').toLocaleDateString('es-CO', {
                            day: 'numeric', month: 'short', year: 'numeric'
                          })
                        : '—'}
                    </div>
                  </div>
                  <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 6, marginLeft: 12 }}>
                    <span style={{
                      fontSize: 11, padding: '3px 8px', borderRadius: 20, fontWeight: 600,
                      background: f.estado === 'aprobado' ? '#f0fdf4'
                        : f.estado === 'rechazado' ? '#fef2f2'
                        : '#fffbeb',
                      color: f.estado === 'aprobado' ? '#16a34a'
                        : f.estado === 'rechazado' ? '#dc2626'
                        : '#d97706'
                    }}>
                      {f.estado === 'aprobado' ? '✅ Aprobado'
                        : f.estado === 'rechazado' ? '❌ Rechazado'
                        : '⏳ Pendiente'}
                    </span>
                    {f.url_comprobante && (
                      <button
                        onClick={() => abrirArchivo(f.url_comprobante!)}
                        style={{
                          fontSize: 11, color: '#0f1787', fontWeight: 600,
                          background: 'none', border: 'none', cursor: 'pointer',
                          padding: 0
                        }}
                      >
                        Ver archivo →
                      </button>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      ) : (
        <div style={{
          textAlign: 'center', padding: '32px 20px',
          color: '#9ca3af', fontSize: 14
        }}>
          <div style={{ fontSize: 40, marginBottom: 8 }}>🧾</div>
          <p style={{ margin: 0 }}>No tienes solicitudes de reembolso aún</p>
        </div>
      )}
    </div>
  )
}
