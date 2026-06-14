'use client'
import { useEffect, useState, Suspense } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { supabase } from '@/lib/supabase'
import { ChevronLeft, Upload, X, Image } from 'lucide-react'

type Categoria = { id: string; nombre: string }

function fmt(n: number) { return `$${Number(n).toLocaleString('es-CO')}` }

const CATS_PARROQUIA = ['Inscripciones caminantes', 'Inscripciones servidores', 'Casa de retiros']

function RegistrarContent() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const tipoInicial = (searchParams.get('tipo') ?? 'ingreso') as 'ingreso' | 'egreso'

  const [tipo, setTipo] = useState<'ingreso' | 'egreso'>(tipoInicial)
  const [categorias, setCategorias] = useState<Categoria[]>([])
  const [categoriaId, setCategoriaId] = useState('')
  const [valor, setValor] = useState('')
  const [descripcion, setDescripcion] = useState('')
  const [fecha, setFecha] = useState(new Date().toISOString().split('T')[0])
  const [archivo, setArchivo] = useState<File | null>(null)
  const [previsualizacion, setPrevisualizacion] = useState<string | null>(null)
  const [guardando, setGuardando] = useState(false)
  const [retiroId, setRetiroId] = useState('')
  const [usuarioId, setUsuarioId] = useState('')

  useEffect(() => {
    async function cargar() {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) return
      setUsuarioId(user.id)

      const { data: r } = await supabase.from('retiros').select('id').eq('estado', 'activo').single()
      if (!r) return
      setRetiroId(r.id)

      const { data: cats } = await supabase
        .from('categorias_financieras')
        .select('id, nombre')
        .eq('retiro_id', r.id)
        .eq('activa', true)
        .order('orden')
      if (cats) setCategorias(cats.filter(c => !CATS_PARROQUIA.includes(c.nombre)))
    }
    cargar()
  }, [])

  function seleccionarArchivo(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    setArchivo(file)
    const reader = new FileReader()
    reader.onload = () => setPrevisualizacion(reader.result as string)
    reader.readAsDataURL(file)
  }

  function quitarArchivo() {
    setArchivo(null)
    setPrevisualizacion(null)
  }

  async function guardar() {
    if (!categoriaId || !valor || !descripcion) return
    setGuardando(true)

    let comprobante_url = null
    let comprobante_nombre = null

    // Subir comprobante si hay archivo
    if (archivo) {
      const ext = archivo.name.split('.').pop()
      const nombreArchivo = `finanzas/${retiroId}/${Date.now()}.${ext}`
      const { data: uploadData, error: uploadError } = await supabase.storage
        .from('comprobantes-pagos')
        .upload(nombreArchivo, archivo, { contentType: archivo.type, upsert: false })

      if (!uploadError && uploadData) {
        const { data: urlData } = supabase.storage
          .from('comprobantes-pagos')
          .getPublicUrl(nombreArchivo)
        comprobante_url = urlData.publicUrl
        comprobante_nombre = archivo.name
      }
    }

    const { error } = await supabase.from('transacciones').insert({
      retiro_id: retiroId,
      usuario_id: usuarioId,
      categoria_id: categoriaId,
      tipo,
      valor: Number(valor.replace(/\D/g, '')),
      descripcion,
      fecha,
      comprobante_url,
      comprobante_nombre,
    })

    setGuardando(false)
    if (!error) router.push('/dashboard/finanzas')
  }

  const valorNum = Number(valor.replace(/\D/g, ''))
  const listo = categoriaId && valor && descripcion

  return (
    <div style={{ background: '#f7f8fc', minHeight: '100vh', paddingBottom: 40 }}>

      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '18px 20px 14px' }}>
        <button onClick={() => router.back()} style={{ width: 34, height: 34, borderRadius: '50%', background: '#fff', border: '0.5px solid #e5e7eb', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer' }}>
          <ChevronLeft size={18} color="#6b7280" />
        </button>
        <div style={{ fontSize: 17, fontWeight: 500, color: '#0d0d14' }}>Registrar movimiento</div>
      </div>

      <div style={{ padding: '0 20px', display: 'flex', flexDirection: 'column', gap: 14 }}>

        {/* Tipo */}
        <div style={{ background: '#fff', borderRadius: 14, padding: 6, border: '0.5px solid #e5e7eb', display: 'flex', gap: 4 }}>
          {(['ingreso', 'egreso'] as const).map(t => (
            <button key={t} onClick={() => setTipo(t)} style={{
              flex: 1, padding: '10px', borderRadius: 10, fontSize: 14, fontWeight: 500, cursor: 'pointer', border: 'none',
              background: tipo === t ? (t === 'ingreso' ? '#dcfce7' : '#fee2e2') : 'transparent',
              color: tipo === t ? (t === 'ingreso' ? '#166534' : '#991b1b') : '#9ca3af'
            }}>
              {t === 'ingreso' ? '↑ Ingreso' : '↓ Egreso'}
            </button>
          ))}
        </div>

        {/* Valor */}
        <div style={{ background: '#fff', borderRadius: 14, padding: '16px', border: '0.5px solid #e5e7eb' }}>
          <div style={{ fontSize: 11, fontWeight: 600, color: '#9ca3af', marginBottom: 8, textTransform: 'uppercase', letterSpacing: '0.05em' }}>Valor</div>
          <input
            type="number"
            placeholder="0"
            value={valor}
            onChange={e => setValor(e.target.value)}
            style={{ width: '100%', border: 'none', outline: 'none', fontSize: 28, fontWeight: 600, color: '#0d0d14', background: 'transparent' }}
          />
          {valorNum > 0 && <div style={{ fontSize: 12, color: '#9ca3af', marginTop: 4 }}>{fmt(valorNum)}</div>}
        </div>

        {/* Descripción */}
        <div style={{ background: '#fff', borderRadius: 14, padding: '16px', border: '0.5px solid #e5e7eb' }}>
          <div style={{ fontSize: 11, fontWeight: 600, color: '#9ca3af', marginBottom: 8, textTransform: 'uppercase', letterSpacing: '0.05em' }}>Descripción</div>
          <input
            placeholder="¿De qué es este movimiento?"
            value={descripcion}
            onChange={e => setDescripcion(e.target.value)}
            style={{ width: '100%', border: 'none', outline: 'none', fontSize: 15, color: '#0d0d14', background: 'transparent' }}
          />
        </div>

        {/* Categoría */}
        <div style={{ background: '#fff', borderRadius: 14, padding: '16px', border: '0.5px solid #e5e7eb' }}>
          <div style={{ fontSize: 11, fontWeight: 600, color: '#9ca3af', marginBottom: 10, textTransform: 'uppercase', letterSpacing: '0.05em' }}>Categoría</div>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
            {categorias.map(c => (
              <button key={c.id} onClick={() => setCategoriaId(c.id)} style={{
                padding: '7px 14px', borderRadius: 20, fontSize: 13, cursor: 'pointer',
                border: '0.5px solid #e5e7eb',
                background: categoriaId === c.id ? '#0f1787' : '#f7f8fc',
                color: categoriaId === c.id ? '#fff' : '#374151',
                fontWeight: categoriaId === c.id ? 600 : 400
              }}>
                {c.nombre}
              </button>
            ))}
          </div>
        </div>

        {/* Fecha */}
        <div style={{ background: '#fff', borderRadius: 14, padding: '16px', border: '0.5px solid #e5e7eb' }}>
          <div style={{ fontSize: 11, fontWeight: 600, color: '#9ca3af', marginBottom: 8, textTransform: 'uppercase', letterSpacing: '0.05em' }}>Fecha</div>
          <input
            type="date"
            value={fecha}
            onChange={e => setFecha(e.target.value)}
            style={{ width: '100%', border: 'none', outline: 'none', fontSize: 15, color: '#0d0d14', background: 'transparent' }}
          />
        </div>

        {/* Comprobante */}
        <div style={{ background: '#fff', borderRadius: 14, padding: '16px', border: '0.5px solid #e5e7eb' }}>
          <div style={{ fontSize: 11, fontWeight: 600, color: '#9ca3af', marginBottom: 10, textTransform: 'uppercase', letterSpacing: '0.05em' }}>Comprobante <span style={{ fontWeight: 400, textTransform: 'none', letterSpacing: 0 }}>(opcional)</span></div>

          {!previsualizacion ? (
            <label style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 8, padding: '24px', borderRadius: 12, border: '1.5px dashed #e5e7eb', cursor: 'pointer', background: '#f7f8fc' }}>
              <input type="file" accept="image/*" onChange={seleccionarArchivo} style={{ display: 'none' }} />
              <Upload size={22} color="#9ca3af" />
              <span style={{ fontSize: 13, color: '#9ca3af' }}>Toca para subir imagen</span>
              <span style={{ fontSize: 11, color: '#d1d5db' }}>JPG, PNG, HEIC</span>
            </label>
          ) : (
            <div style={{ position: 'relative' }}>
              <img src={previsualizacion} alt="Comprobante" style={{ width: '100%', borderRadius: 10, maxHeight: 220, objectFit: 'cover' }} />
              <button onClick={quitarArchivo} style={{ position: 'absolute', top: 8, right: 8, width: 28, height: 28, borderRadius: '50%', background: 'rgba(0,0,0,0.5)', border: 'none', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer' }}>
                <X size={14} color="#fff" />
              </button>
              <div style={{ marginTop: 8, fontSize: 12, color: '#9ca3af' }}>{archivo?.name}</div>
            </div>
          )}
        </div>

        {/* Botón guardar */}
        <button
          onClick={guardar}
          disabled={!listo || guardando}
          style={{
            background: !listo ? '#e5e7eb' : '#0f1787',
            color: !listo ? '#9ca3af' : '#fff',
            border: 'none', borderRadius: 14, padding: 16,
            fontSize: 15, fontWeight: 500, cursor: !listo ? 'not-allowed' : 'pointer',
            marginTop: 4
          }}
        >
          {guardando ? 'Guardando...' : 'Guardar movimiento'}
        </button>

      </div>
    </div>
  )
}

export default function RegistrarPage() {
  return (
    <Suspense fallback={<div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: '100vh' }}><div style={{ color: '#9ca3af' }}>Cargando...</div></div>}>
      <RegistrarContent />
    </Suspense>
  )
}
