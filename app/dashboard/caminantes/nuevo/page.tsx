'use client'
import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'
import { ChevronLeft, Check } from 'lucide-react'

const TALLAS = ['XS', 'S', 'M', 'L', 'XL']
const TIPOS_DOC = ['C.C.', 'TI', 'C.E.', 'Pasaporte']
const SACRAMENTOS_OPTS = ['Bautismo', 'Comunión', 'Confirmación', 'Matrimonio']

type Campo = {
  nombre: string
  tipo_documento: string
  numero_documento: string
  celular: string
  correo: string
  direccion: string
  barrio: string
  telefono_fijo: string
  fecha_nacimiento: string
  edad: string
  talla_camiseta: string
  sacramentos: string[]
  es_sorpresa: boolean
  alergias: string
  restricciones_alimentarias: string
  medicamentos: string
  eps: string
  observaciones: string
  contacto1_nombre: string
  contacto1_parentesco: string
  contacto1_celular: string
  contacto2_nombre: string
  contacto2_parentesco: string
  contacto2_celular: string
}

const VACIO: Campo = {
  nombre: '', tipo_documento: 'C.C.', numero_documento: '', celular: '',
  correo: '', direccion: '', barrio: '', telefono_fijo: '',
  fecha_nacimiento: '', edad: '', talla_camiseta: '', sacramentos: [],
  es_sorpresa: false, alergias: '', restricciones_alimentarias: '',
  medicamentos: '', eps: '', observaciones: '',
  contacto1_nombre: '', contacto1_parentesco: '', contacto1_celular: '',
  contacto2_nombre: '', contacto2_parentesco: '', contacto2_celular: '',
}

function Label({ children, required }: { children: React.ReactNode; required?: boolean }) {
  return (
    <div style={{ fontSize: 12, fontWeight: 600, color: '#6b7280', letterSpacing: '0.03em', textTransform: 'uppercase', marginBottom: 6 }}>
      {children}{required && <span style={{ color: '#dc2626', marginLeft: 3 }}>*</span>}
    </div>
  )
}

function Input({ value, onChange, placeholder, type = 'text' }: {
  value: string; onChange: (v: string) => void; placeholder?: string; type?: string
}) {
  return (
    <input
      value={value}
      onChange={e => onChange(e.target.value)}
      placeholder={placeholder}
      type={type}
      style={{
        width: '100%', boxSizing: 'border-box', padding: '11px 14px',
        border: '0.5px solid #e5e7eb', borderRadius: 10, fontSize: 14,
        color: '#0d0d14', background: '#fff', outline: 'none', fontFamily: 'inherit',
      }}
    />
  )
}

function Seccion({ titulo, children }: { titulo: string; children: React.ReactNode }) {
  return (
    <div style={{ background: '#fff', borderRadius: 16, padding: '20px 18px', border: '0.5px solid #e5e7eb' }}>
      <div style={{ fontSize: 13, fontWeight: 700, color: '#0f1787', letterSpacing: '0.05em', textTransform: 'uppercase', marginBottom: 18 }}>
        {titulo}
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
        {children}
      </div>
    </div>
  )
}

export default function NuevoCaminantePage() {
  const router = useRouter()
  const [form, setForm] = useState<Campo>(VACIO)
  const [guardando, setGuardando] = useState(false)
  const [error, setError] = useState('')
  const [exito, setExito] = useState(false)

  const set = (k: keyof Campo) => (v: string | boolean | string[]) =>
    setForm(f => ({ ...f, [k]: v }))

  const toggleSacramento = (s: string) => {
    setForm(f => ({
      ...f,
      sacramentos: f.sacramentos.includes(s)
        ? f.sacramentos.filter(x => x !== s)
        : [...f.sacramentos, s],
    }))
  }

  async function guardar() {
    setError('')
    if (!form.nombre.trim()) { setError('El nombre es obligatorio.'); return }
    if (!form.numero_documento.trim()) { setError('El número de documento es obligatorio.'); return }

    setGuardando(true)
    try {
      const { data: r } = await supabase
        .from('retiros').select('id').eq('estado', 'activo').single()
      if (!r) { setError('No hay retiro activo.'); setGuardando(false); return }

      const payload: Record<string, unknown> = {
        retiro_id: r.id,
        nombre: form.nombre.trim(),
        tipo_documento: form.tipo_documento,
        numero_documento: form.numero_documento.trim().replace(/\./g, ''),
        celular: form.celular.trim() || null,
        correo: form.correo.trim() || null,
        direccion: form.direccion.trim() || null,
        barrio: form.barrio.trim() || null,
        telefono_fijo: form.telefono_fijo.trim() || null,
        fecha_nacimiento: form.fecha_nacimiento || null,
        edad: form.edad ? parseInt(form.edad) : null,
        talla_camiseta: form.talla_camiseta || null,
        sacramentos: form.sacramentos.length > 0 ? form.sacramentos : null,
        es_sorpresa: form.es_sorpresa,
        alergias: form.alergias.trim() || null,
        restricciones_alimentarias: form.restricciones_alimentarias.trim() || null,
        medicamentos: form.medicamentos.trim() || null,
        eps: form.eps.trim() || null,
        observaciones: form.observaciones.trim() || null,
        estado_correo: 'sin_enviar',
        inscrito_oficialmente: false,
      }

      const { data: nuevo, error: errIns } = await supabase
        .from('caminantes')
        .insert(payload)
        .select('id')
        .single()

      if (errIns || !nuevo) {
        setError('Error al guardar: ' + (errIns?.message ?? 'respuesta vacía'))
        setGuardando(false); return
      }

      const cid = nuevo.id

      if (form.contacto1_nombre.trim()) {
        await supabase.from('contactos_emergencia').insert({
          persona_id: cid, tipo_persona: 'caminante',
          nombre: form.contacto1_nombre.trim(),
          parentesco: form.contacto1_parentesco.trim() || null,
          celular: form.contacto1_celular.trim() || null,
          orden: 1,
        })
      }

      if (form.contacto2_nombre.trim()) {
        await supabase.from('contactos_emergencia').insert({
          persona_id: cid, tipo_persona: 'caminante',
          nombre: form.contacto2_nombre.trim(),
          parentesco: form.contacto2_parentesco.trim() || null,
          celular: form.contacto2_celular.trim() || null,
          orden: 2,
        })
      }

      setExito(true)
      setTimeout(() => router.push('/dashboard/caminantes'), 1400)
    } catch (e: unknown) {
      setError('Error inesperado: ' + (e instanceof Error ? e.message : String(e)))
      setGuardando(false)
    }
  }

  if (exito) {
    return (
      <div style={{ minHeight: '100vh', background: '#f7f8fc', display: 'flex', alignItems: 'center', justifyContent: 'center', flexDirection: 'column', gap: 16, padding: 32 }}>
        <div style={{ width: 64, height: 64, borderRadius: '50%', background: '#dcfce7', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <Check size={32} color="#16a34a" />
        </div>
        <div style={{ fontSize: 18, fontWeight: 600, color: '#0d0d14' }}>Caminante registrado</div>
        <div style={{ fontSize: 14, color: '#9ca3af' }}>Volviendo a la lista…</div>
      </div>
    )
  }

  return (
    <div style={{ background: '#f7f8fc', minHeight: '100vh', paddingBottom: 100 }}>

      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '18px 20px 14px' }}>
        <button onClick={() => router.back()} style={{ width: 34, height: 34, borderRadius: '50%', background: '#fff', border: '0.5px solid #e5e7eb', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer' }}>
          <ChevronLeft size={18} color="#6b7280" />
        </button>
        <div style={{ fontSize: 17, fontWeight: 500, color: '#0d0d14' }}>Registrar caminante</div>
      </div>

      <div style={{ padding: '0 20px', display: 'flex', flexDirection: 'column', gap: 14 }}>

        {/* Sorpresa toggle */}
        <button onClick={() => set('es_sorpresa')(!form.es_sorpresa)}
          style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', background: form.es_sorpresa ? '#ede9fe' : '#fff', border: form.es_sorpresa ? '1px solid #a78bfa' : '0.5px solid #e5e7eb', borderRadius: 14, padding: '14px 18px', cursor: 'pointer' }}>
          <div>
            <div style={{ fontSize: 14, fontWeight: 500, color: form.es_sorpresa ? '#5b21b6' : '#0d0d14' }}>Retiro sorpresa 🤫</div>
            <div style={{ fontSize: 12, color: '#9ca3af', marginTop: 2 }}>El caminante no sabe que viene al retiro</div>
          </div>
          <div style={{ width: 22, height: 22, borderRadius: '50%', background: form.es_sorpresa ? '#7c3aed' : '#f3f4f6', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
            {form.es_sorpresa && <Check size={13} color="#fff" />}
          </div>
        </button>

        {/* DATOS PERSONALES */}
        <Seccion titulo="Datos personales">
          <div>
            <Label required>Nombres y apellidos</Label>
            <Input value={form.nombre} onChange={set('nombre')} placeholder="Nombre completo" />
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '120px 1fr', gap: 10 }}>
            <div>
              <Label>Tipo doc.</Label>
              <select value={form.tipo_documento} onChange={e => set('tipo_documento')(e.target.value)}
                style={{ width: '100%', padding: '11px 10px', border: '0.5px solid #e5e7eb', borderRadius: 10, fontSize: 14, color: '#0d0d14', background: '#fff', outline: 'none', fontFamily: 'inherit' }}>
                {TIPOS_DOC.map(t => <option key={t}>{t}</option>)}
              </select>
            </div>
            <div>
              <Label required>Número de documento</Label>
              <Input value={form.numero_documento} onChange={set('numero_documento')} placeholder="Sin puntos" />
            </div>
          </div>

          <div>
            <Label>Fecha de nacimiento</Label>
            <Input value={form.fecha_nacimiento} onChange={set('fecha_nacimiento')} type="date" />
          </div>

          <div>
            <Label>Edad</Label>
            <Input value={form.edad} onChange={set('edad')} placeholder="Ej: 22" type="number" />
          </div>

          <div>
            <Label>Celular</Label>
            <Input value={form.celular} onChange={set('celular')} placeholder="3XXXXXXXXX" type="tel" />
          </div>

          <div>
            <Label>Teléfono fijo</Label>
            <Input value={form.telefono_fijo} onChange={set('telefono_fijo')} placeholder="Opcional" type="tel" />
          </div>

          <div>
            <Label>Correo electrónico</Label>
            <Input value={form.correo} onChange={set('correo')} placeholder="correo@ejemplo.com" type="email" />
          </div>
        </Seccion>

        {/* UBICACIÓN */}
        <Seccion titulo="Ubicación">
          <div>
            <Label>Dirección de residencia</Label>
            <Input value={form.direccion} onChange={set('direccion')} placeholder="Calle / Carrera / Diagonal…" />
          </div>
          <div>
            <Label>Barrio / Conjunto</Label>
            <Input value={form.barrio} onChange={set('barrio')} placeholder="Nombre del barrio o conjunto" />
          </div>
        </Seccion>

        {/* RETIRO */}
        <Seccion titulo="Datos del retiro">
          <div>
            <Label>Talla de camiseta</Label>
            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
              {TALLAS.map(t => (
                <button key={t} onClick={() => set('talla_camiseta')(form.talla_camiseta === t ? '' : t)}
                  style={{ padding: '8px 16px', borderRadius: 10, fontSize: 13, fontWeight: 500, cursor: 'pointer', border: form.talla_camiseta === t ? '1.5px solid #0f1787' : '0.5px solid #e5e7eb', background: form.talla_camiseta === t ? '#0f1787' : '#fff', color: form.talla_camiseta === t ? '#fff' : '#374151' }}>
                  {t}
                </button>
              ))}
            </div>
          </div>

          <div>
            <Label>Sacramentos recibidos</Label>
            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
              {SACRAMENTOS_OPTS.map(s => (
                <button key={s} onClick={() => toggleSacramento(s)}
                  style={{ padding: '8px 14px', borderRadius: 10, fontSize: 13, fontWeight: 500, cursor: 'pointer', border: form.sacramentos.includes(s) ? '1.5px solid #0f1787' : '0.5px solid #e5e7eb', background: form.sacramentos.includes(s) ? '#0f1787' : '#fff', color: form.sacramentos.includes(s) ? '#fff' : '#374151' }}>
                  {s}
                </button>
              ))}
            </div>
          </div>
        </Seccion>

        {/* SALUD */}
        <Seccion titulo="Información médica">
          <div>
            <Label>EPS</Label>
            <Input value={form.eps} onChange={set('eps')} placeholder="Ej: Sura, Nueva EPS…" />
          </div>
          <div>
            <Label>Alergias</Label>
            <Input value={form.alergias} onChange={set('alergias')} placeholder="Ej: Polen, mariscos… o dejar vacío" />
          </div>
          <div>
            <Label>Restricciones alimentarias</Label>
            <Input value={form.restricciones_alimentarias} onChange={set('restricciones_alimentarias')} placeholder="Ej: Vegetariano, sin gluten… o dejar vacío" />
          </div>
          <div>
            <Label>Medicamentos</Label>
            <Input value={form.medicamentos} onChange={set('medicamentos')} placeholder="Nombre y dosis… o dejar vacío" />
          </div>
        </Seccion>

        {/* CONTACTOS */}
        <Seccion titulo="Contacto de emergencia 1">
          <div>
            <Label>Nombre</Label>
            <Input value={form.contacto1_nombre} onChange={set('contacto1_nombre')} placeholder="Nombre completo" />
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
            <div>
              <Label>Parentesco</Label>
              <Input value={form.contacto1_parentesco} onChange={set('contacto1_parentesco')} placeholder="Ej: Mamá" />
            </div>
            <div>
              <Label>Celular</Label>
              <Input value={form.contacto1_celular} onChange={set('contacto1_celular')} placeholder="3XXXXXXXXX" type="tel" />
            </div>
          </div>
        </Seccion>

        <Seccion titulo="Contacto de emergencia 2">
          <div>
            <Label>Nombre</Label>
            <Input value={form.contacto2_nombre} onChange={set('contacto2_nombre')} placeholder="Nombre completo" />
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
            <div>
              <Label>Parentesco</Label>
              <Input value={form.contacto2_parentesco} onChange={set('contacto2_parentesco')} placeholder="Ej: Papá" />
            </div>
            <div>
              <Label>Celular</Label>
              <Input value={form.contacto2_celular} onChange={set('contacto2_celular')} placeholder="3XXXXXXXXX" type="tel" />
            </div>
          </div>
        </Seccion>

        {/* OBSERVACIONES */}
        <Seccion titulo="Observaciones">
          <div>
            <Label>Notas internas</Label>
            <textarea
              value={form.observaciones}
              onChange={e => set('observaciones')(e.target.value)}
              placeholder="Cualquier información adicional relevante para los líderes…"
              rows={4}
              style={{ width: '100%', boxSizing: 'border-box', padding: '11px 14px', border: '0.5px solid #e5e7eb', borderRadius: 10, fontSize: 14, color: '#0d0d14', background: '#fff', outline: 'none', fontFamily: 'inherit', resize: 'vertical', lineHeight: 1.6 }}
            />
          </div>
        </Seccion>

        {/* ERROR */}
        {error && (
          <div style={{ background: '#fee2e2', border: '0.5px solid #fca5a5', borderRadius: 10, padding: '12px 16px', fontSize: 13, color: '#991b1b' }}>
            {error}
          </div>
        )}
      </div>

      {/* Botón fijo */}
      <div style={{ position: 'fixed', bottom: 0, left: 0, right: 0, padding: '16px 20px', background: 'rgba(247,248,252,0.95)', backdropFilter: 'blur(8px)', borderTop: '0.5px solid #e5e7eb' }}>
        <button
          onClick={guardar}
          disabled={guardando}
          style={{ width: '100%', background: guardando ? '#9ca3af' : '#0f1787', color: '#fff', border: 'none', borderRadius: 14, padding: 16, fontSize: 15, fontWeight: 600, cursor: guardando ? 'not-allowed' : 'pointer' }}>
          {guardando ? 'Guardando…' : 'Registrar caminante'}
        </button>
      </div>
    </div>
  )
}
