'use client'
import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'
import { ChevronLeft } from 'lucide-react'

export default function NuevoServidorPage() {
  const router = useRouter()
  const [retiroId, setRetiroId] = useState('')
  const [guardando, setGuardando] = useState(false)
  const [form, setForm] = useState({
    nombre: '', tipo_documento: 'C.C.', numero_documento: '',
    celular: '', correo: '', direccion: '', barrio: '',
    fecha_nacimiento: '', edad: '', talla_camiseta: 'M',
    sacramentos: '', eps: '', alergias: '', restricciones_alimentarias: '',
    medicamentos: '', observaciones: '',
  })

  useEffect(() => {
    async function cargar() {
      const { data: r } = await supabase.from('retiros').select('id').eq('estado', 'activo').single()
      if (r) setRetiroId(r.id)
    }
    cargar()
  }, [])

  function set(key: string, value: string) {
    setForm(f => ({ ...f, [key]: value }))
  }

  async function guardar() {
    if (!form.nombre || !form.numero_documento || !form.celular) return
    setGuardando(true)

    const { error } = await supabase.from('servidores_inscripcion').insert({
      retiro_id: retiroId,
      nombre: form.nombre.trim(),
      tipo_documento: form.tipo_documento,
      numero_documento: form.numero_documento.trim(),
      celular: form.celular.trim(),
      correo: form.correo.trim() || null,
      direccion: form.direccion.trim() || null,
      barrio: form.barrio.trim() || null,
      fecha_nacimiento: form.fecha_nacimiento || null,
      edad: form.edad ? Number(form.edad) : null,
      talla_camiseta: form.talla_camiseta,
      sacramentos: form.sacramentos.trim() || null,
      eps: form.eps.trim() || null,
      alergias: form.alergias.trim() || null,
      restricciones_alimentarias: form.restricciones_alimentarias.trim() || null,
      medicamentos: form.medicamentos.trim() || null,
      observaciones: form.observaciones.trim() || null,
      estado_correo: 'sin_enviar',
      inscrito_oficialmente: true,
      fecha_inscripcion: new Date().toISOString(),
    })

    setGuardando(false)
    if (!error) router.push('/dashboard/servidores')
  }

  const campo = (label: string, key: string, placeholder = '', tipo = 'text') => (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
      <label style={{ fontSize: 11, fontWeight: 600, color: '#9ca3af', textTransform: 'uppercase', letterSpacing: '0.05em' }}>{label}</label>
      <input
        type={tipo}
        value={form[key as keyof typeof form]}
        onChange={e => set(key, e.target.value)}
        placeholder={placeholder}
        style={{ border: '0.5px solid #e5e7eb', borderRadius: 10, padding: '11px 14px', fontSize: 14, color: '#0d0d14', outline: 'none', background: '#fff' }}
      />
    </div>
  )

  const listo = form.nombre && form.numero_documento && form.celular

  return (
    <div style={{ background: '#f7f8fc', minHeight: '100vh', paddingBottom: 40 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '18px 20px 14px' }}>
        <button onClick={() => router.back()} style={{ width: 34, height: 34, borderRadius: '50%', background: '#fff', border: '0.5px solid #e5e7eb', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer' }}>
          <ChevronLeft size={18} color="#6b7280" />
        </button>
        <div style={{ fontSize: 17, fontWeight: 500, color: '#0d0d14' }}>Registrar servidor</div>
      </div>

      <div style={{ padding: '0 20px', display: 'flex', flexDirection: 'column', gap: 14 }}>

        {/* Datos básicos */}
        <div style={{ background: '#fff', borderRadius: 14, padding: '16px', border: '0.5px solid #e5e7eb', display: 'flex', flexDirection: 'column', gap: 14 }}>
          <div style={{ fontSize: 12, fontWeight: 600, color: '#0f1787', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Datos básicos</div>
          {campo('Nombre completo *', 'nombre', 'Juan David García')}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            <label style={{ fontSize: 11, fontWeight: 600, color: '#9ca3af', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Tipo documento</label>
            <select value={form.tipo_documento} onChange={e => set('tipo_documento', e.target.value)}
              style={{ border: '0.5px solid #e5e7eb', borderRadius: 10, padding: '11px 14px', fontSize: 14, color: '#0d0d14', outline: 'none', background: '#fff' }}>
              <option>C.C.</option><option>T.I.</option><option>C.E.</option><option>Pasaporte</option>
            </select>
          </div>
          {campo('Número documento *', 'numero_documento', '1000123456')}
          {campo('Celular *', 'celular', '3001234567', 'tel')}
          {campo('Correo', 'correo', 'correo@gmail.com', 'email')}
        </div>

        {/* Datos personales */}
        <div style={{ background: '#fff', borderRadius: 14, padding: '16px', border: '0.5px solid #e5e7eb', display: 'flex', flexDirection: 'column', gap: 14 }}>
          <div style={{ fontSize: 12, fontWeight: 600, color: '#0f1787', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Datos personales</div>
          {campo('Fecha de nacimiento', 'fecha_nacimiento', '', 'date')}
          {campo('Edad', 'edad', '20', 'number')}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            <label style={{ fontSize: 11, fontWeight: 600, color: '#9ca3af', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Talla camiseta</label>
            <select value={form.talla_camiseta} onChange={e => set('talla_camiseta', e.target.value)}
              style={{ border: '0.5px solid #e5e7eb', borderRadius: 10, padding: '11px 14px', fontSize: 14, color: '#0d0d14', outline: 'none', background: '#fff' }}>
              <option>XS</option><option>S</option><option>M</option><option>L</option><option>XL</option><option>XXL</option>
            </select>
          </div>
          {campo('Dirección', 'direccion', 'Cll 100 # 20-30')}
          {campo('Barrio', 'barrio', 'Chapinero')}
          {campo('Sacramentos', 'sacramentos', 'Bautizo, Primera comunión')}
        </div>

        {/* Salud */}
        <div style={{ background: '#fff', borderRadius: 14, padding: '16px', border: '0.5px solid #e5e7eb', display: 'flex', flexDirection: 'column', gap: 14 }}>
          <div style={{ fontSize: 12, fontWeight: 600, color: '#0f1787', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Salud</div>
          {campo('EPS', 'eps', 'Compensar')}
          {campo('Alergias', 'alergias', 'Ninguna')}
          {campo('Restricciones alimentarias', 'restricciones_alimentarias', 'Ninguna')}
          {campo('Medicamentos', 'medicamentos', 'Ninguno')}
        </div>

        {/* Observaciones */}
        <div style={{ background: '#fff', borderRadius: 14, padding: '16px', border: '0.5px solid #e5e7eb', display: 'flex', flexDirection: 'column', gap: 6 }}>
          <label style={{ fontSize: 11, fontWeight: 600, color: '#9ca3af', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Observaciones</label>
          <textarea
            value={form.observaciones}
            onChange={e => set('observaciones', e.target.value)}
            placeholder="Notas adicionales..."
            rows={3}
            style={{ border: '0.5px solid #e5e7eb', borderRadius: 10, padding: '11px 14px', fontSize: 14, color: '#0d0d14', outline: 'none', background: '#fff', resize: 'none' }}
          />
        </div>

        <button onClick={guardar} disabled={!listo || guardando} style={{
          background: !listo ? '#e5e7eb' : '#0f1787',
          color: !listo ? '#9ca3af' : '#fff',
          border: 'none', borderRadius: 14, padding: 16,
          fontSize: 15, fontWeight: 500, cursor: !listo ? 'not-allowed' : 'pointer', marginTop: 4
        }}>
          {guardando ? 'Guardando...' : 'Registrar servidor'}
        </button>
      </div>
    </div>
  )
}
