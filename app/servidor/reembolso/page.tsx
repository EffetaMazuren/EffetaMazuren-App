'use client';
import { useState, useEffect, useRef } from 'react';
import { supabase } from '@/lib/supabase';

const RETIRO_ID = '21da7588-f7d9-4bf8-a6f6-ae6c8258c00e';

export default function ReembolsoPage() {
  const [servidorId, setServidorId] = useState<string | null>(null);
  const [usuarioId, setUsuarioId] = useState<string | null>(null);
  const [categorias, setCategorias] = useState<any[]>([]);
  const [valor, setValor] = useState('');
  const [descripcion, setDescripcion] = useState('');
  const [tipo, setTipo] = useState<'egreso' | 'ingreso'>('egreso');
  const [categoriaId, setCategoriaId] = useState('');
  const [archivo, setArchivo] = useState<File | null>(null);
  const [enviando, setEnviando] = useState(false);
  const [error, setError] = useState('');
  const [exito, setExito] = useState('');
  const [historial, setHistorial] = useState<any[]>([]);
  const fileRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => {
      if (!data.user) return;
      setUsuarioId(data.user.id);
      const sid = data.user.user_metadata?.servidor_inscripcion_id;
      setServidorId(sid);
      if (data.user.id) cargarHistorial(data.user.id);
    });
    cargarCategorias();
  }, []);

  async function cargarCategorias() {
    const { data } = await supabase
      .from('categorias_financieras')
      .select('id, nombre, tipo_movimiento')
      .eq('retiro_id', RETIRO_ID)
      .eq('activa', true)
      .order('nombre');
    setCategorias(data || []);
  }

  async function cargarHistorial(uid: string) {
    const { data } = await supabase
      .from('transacciones')
      .select('*, categoria:categoria_id(nombre)')
      .eq('usuario_id', uid)
      .order('created_at', { ascending: false });
    setHistorial(data || []);
  }

  // Filtrar categorías según tipo seleccionado
  const categoriasFiltradas = categorias.filter(c =>
    !c.tipo_movimiento || c.tipo_movimiento === tipo || c.tipo_movimiento === 'ambos'
  );

  async function enviar() {
    setError(''); setExito('');
    if (!valor || !descripcion || !archivo || !categoriaId) {
      setError('Completa todos los campos, selecciona una categoría y adjunta el comprobante.');
      return;
    }
    if (!usuarioId) {
      setError('No se encontró tu sesión. Intenta cerrar y volver a entrar.');
      return;
    }
    setEnviando(true);
    try {
      const ext = archivo.name.split('.').pop();
      const path = `servidores/${servidorId || usuarioId}/reembolso_${Date.now()}.${ext}`;
      const { error: uploadErr } = await supabase.storage
        .from('comprobantes-pagos')
        .upload(path, archivo, { upsert: true });
      if (uploadErr) throw new Error('Error subiendo archivo: ' + uploadErr.message);

      const { data: urlData } = supabase.storage
        .from('comprobantes-pagos')
        .getPublicUrl(path);

      const { error: insertErr } = await supabase
        .from('transacciones')
        .insert({
          retiro_id: RETIRO_ID,
          usuario_id: usuarioId,
          servidor_inscripcion_id: servidorId,
          tipo,
          estado: 'pendiente',
          valor: parseFloat(valor),
          descripcion,
          categoria_id: categoriaId,
          comprobante_url: urlData.publicUrl,
          comprobante_nombre: archivo.name,
          fecha: new Date().toISOString().split('T')[0],
        });
      if (insertErr) throw new Error('Error al registrar: ' + insertErr.message);

      setExito('¡Solicitud enviada! Un líder la revisará pronto.');
      setValor(''); setDescripcion(''); setArchivo(null); setCategoriaId(''); setTipo('egreso');
      if (fileRef.current) fileRef.current.value = '';
      cargarHistorial(usuarioId);
    } catch (e: any) {
      setError(e.message);
    } finally {
      setEnviando(false);
    }
  }

  const estadoColor: Record<string, string> = {
    pendiente: '#d97706',
    aprobado: '#16a34a',
    rechazado: '#dc2626',
  };

  return (
    <div style={{ minHeight: '100vh', background: '#f7f8fc', paddingBottom: 100 }}>
      <div style={{ maxWidth: 480, margin: '0 auto', padding: '24px 16px' }}>
        <h1 style={{ fontSize: 22, fontWeight: 700, color: '#0f1787', marginBottom: 24 }}>
          🧾 Facturas y reembolsos
        </h1>

        {/* Formulario */}
        <div style={{ background: '#fff', borderRadius: 16, padding: 24, marginBottom: 24, boxShadow: '0 1px 8px rgba(0,0,0,0.07)' }}>
          <h2 style={{ fontSize: 16, fontWeight: 600, color: '#1e293b', marginBottom: 20 }}>
            Nueva solicitud
          </h2>

          {/* Tipo */}
          <label style={{ fontSize: 13, color: '#64748b', fontWeight: 500, display: 'block', marginBottom: 6 }}>
            ¿Es un ingreso o un egreso?
          </label>
          <div style={{ display: 'flex', gap: 8, marginBottom: 16 }}>
            <button
              onClick={() => { setTipo('egreso'); setCategoriaId(''); }}
              style={{ flex: 1, padding: '10px', borderRadius: 10, border: `2px solid ${tipo === 'egreso' ? '#dc2626' : '#e2e8f0'}`, background: tipo === 'egreso' ? '#fef2f2' : '#fff', color: tipo === 'egreso' ? '#dc2626' : '#94a3b8', fontWeight: 600, fontSize: 14, cursor: 'pointer' }}
            >↓ Egreso</button>
            <button
              onClick={() => { setTipo('ingreso'); setCategoriaId(''); }}
              style={{ flex: 1, padding: '10px', borderRadius: 10, border: `2px solid ${tipo === 'ingreso' ? '#16a34a' : '#e2e8f0'}`, background: tipo === 'ingreso' ? '#f0fdf4' : '#fff', color: tipo === 'ingreso' ? '#16a34a' : '#94a3b8', fontWeight: 600, fontSize: 14, cursor: 'pointer' }}
            >↑ Ingreso</button>
          </div>

          {/* Categoría */}
          <label style={{ fontSize: 13, color: '#64748b', fontWeight: 500, display: 'block', marginBottom: 6 }}>
            Categoría
          </label>
          <select
            value={categoriaId}
            onChange={e => setCategoriaId(e.target.value)}
            style={{ width: '100%', padding: '10px 14px', border: '1.5px solid #e2e8f0', borderRadius: 10, fontSize: 14, marginBottom: 16, background: '#fff', boxSizing: 'border-box' }}
          >
            <option value="">Seleccionar categoría...</option>
            {categoriasFiltradas.map(c => (
              <option key={c.id} value={c.id}>{c.nombre}</option>
            ))}
          </select>

          {/* Monto */}
          <label style={{ fontSize: 13, color: '#64748b', fontWeight: 500, display: 'block', marginBottom: 6 }}>
            Monto (COP)
          </label>
          <input
            type="number"
            value={valor}
            onChange={e => setValor(e.target.value)}
            placeholder="10000"
            style={{ width: '100%', padding: '10px 14px', border: '1.5px solid #e2e8f0', borderRadius: 10, fontSize: 15, marginBottom: 16, boxSizing: 'border-box' }}
          />

          {/* Descripción */}
          <label style={{ fontSize: 13, color: '#64748b', fontWeight: 500, display: 'block', marginBottom: 6 }}>
            ¿Para qué fue?
          </label>
          <textarea
            value={descripcion}
            onChange={e => setDescripcion(e.target.value)}
            rows={3}
            placeholder="Ej: Materiales para la mesa de bienvenida"
            style={{ width: '100%', padding: '10px 14px', border: '1.5px solid #e2e8f0', borderRadius: 10, fontSize: 15, marginBottom: 16, boxSizing: 'border-box', resize: 'vertical' }}
          />

          {/* Archivo */}
          <label style={{ fontSize: 13, color: '#64748b', fontWeight: 500, display: 'block', marginBottom: 6 }}>
            Factura o foto del recibo
          </label>
          <div
            onClick={() => fileRef.current?.click()}
            style={{ border: '2px dashed #c7d2fe', borderRadius: 10, padding: '16px', textAlign: 'center', cursor: 'pointer', marginBottom: 16, background: archivo ? '#f0fdf4' : '#f8fafc' }}
          >
            {archivo
              ? <span style={{ color: '#16a34a', fontSize: 14 }}>📎 {archivo.name}</span>
              : <span style={{ color: '#94a3b8', fontSize: 14 }}>Toca para adjuntar imagen o PDF</span>
            }
          </div>
          <input ref={fileRef} type="file" accept="image/*,application/pdf" style={{ display: 'none' }} onChange={e => setArchivo(e.target.files?.[0] || null)} />

          {error && (
            <div style={{ background: '#fef2f2', border: '1px solid #fecaca', color: '#dc2626', borderRadius: 8, padding: '10px 14px', fontSize: 13, marginBottom: 12 }}>
              {error}
            </div>
          )}
          {exito && (
            <div style={{ background: '#f0fdf4', border: '1px solid #bbf7d0', color: '#16a34a', borderRadius: 8, padding: '10px 14px', fontSize: 13, marginBottom: 12 }}>
              {exito}
            </div>
          )}

          <button
            onClick={enviar}
            disabled={enviando}
            style={{ width: '100%', background: enviando ? '#94a3b8' : '#0f1787', color: '#fff', border: 'none', borderRadius: 10, padding: '14px', fontSize: 15, fontWeight: 600, cursor: enviando ? 'not-allowed' : 'pointer' }}
          >
            {enviando ? 'Enviando...' : 'Enviar solicitud'}
          </button>
        </div>

        {/* Historial */}
        {historial.length > 0 && (
          <div style={{ background: '#fff', borderRadius: 16, padding: 24, boxShadow: '0 1px 8px rgba(0,0,0,0.07)' }}>
            <h2 style={{ fontSize: 16, fontWeight: 600, color: '#1e293b', marginBottom: 16 }}>
              Mis solicitudes
            </h2>
            {historial.map(t => (
              <div key={t.id} style={{ borderBottom: '1px solid #f1f5f9', paddingBottom: 12, marginBottom: 12 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <div>
                    <span style={{ fontWeight: 600, color: '#1e293b' }}>
                      {t.tipo === 'egreso' ? '↓' : '↑'} ${parseInt(t.valor).toLocaleString('es-CO')}
                    </span>
                    {t.categoria?.nombre && (
                      <span style={{ fontSize: 11, color: '#94a3b8', marginLeft: 8 }}>· {t.categoria.nombre}</span>
                    )}
                  </div>
                  <span style={{ fontSize: 12, fontWeight: 600, color: estadoColor[t.estado || 'pendiente'], background: '#f8fafc', padding: '3px 10px', borderRadius: 20 }}>
                    {t.estado || 'pendiente'}
                  </span>
                </div>
                <p style={{ fontSize: 13, color: '#64748b', margin: '4px 0 0' }}>{t.descripcion}</p>
                {t.comprobante_url && (
                  <button
                    onClick={() => window.open(t.comprobante_url, '_blank')}
                    style={{ fontSize: 12, color: '#0f1787', background: 'none', border: 'none', cursor: 'pointer', padding: 0, marginTop: 4 }}
                  >
                    Ver comprobante →
                  </button>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
