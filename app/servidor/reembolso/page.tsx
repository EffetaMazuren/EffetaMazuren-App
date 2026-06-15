'use client';
import { useState, useEffect, useRef } from 'react';
import { supabase } from '@/lib/supabase';

const RETIRO_ID = '21da7588-f7d9-4bf8-a6f6-ae6c8258c00e';

export default function ReembolsoPage() {
  const [user, setUser] = useState<any>(null);
  const [servidorId, setServidorId] = useState<string | null>(null);
  const [monto, setMonto] = useState('');
  const [descripcion, setDescripcion] = useState('');
  const [archivo, setArchivo] = useState<File | null>(null);
  const [enviando, setEnviando] = useState(false);
  const [error, setError] = useState('');
  const [exito, setExito] = useState('');
  const [historial, setHistorial] = useState<any[]>([]);
  const fileRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => {
      if (!data.user) return;
      setUser(data.user);
      const sid = data.user.user_metadata?.servidor_inscripcion_id;
      setServidorId(sid);
      if (sid) cargarHistorial(sid);
    });
  }, []);

  async function cargarHistorial(sid: string) {
    const { data } = await supabase
      .from('transacciones')
      .select('*')
      .eq('servidor_inscripcion_id', sid)
      .eq('tipo', 'egreso')
      .order('fecha', { ascending: false });
    setHistorial(data || []);
  }

  async function enviar() {
    setError(''); setExito('');
    if (!monto || !descripcion || !archivo) {
      setError('Completa todos los campos y adjunta el comprobante.');
      return;
    }
    if (!servidorId) {
      setError('No se encontró tu registro de servidor. Contacta a un líder.');
      return;
    }
    setEnviando(true);
    try {
      // 1. Subir archivo
      const ext = archivo.name.split('.').pop();
      const path = `servidores/${servidorId}/reembolso_${Date.now()}.${ext}`;
      const { error: uploadErr } = await supabase.storage
        .from('comprobantes-pagos')
        .upload(path, archivo, { upsert: true });
      if (uploadErr) throw new Error('Error subiendo archivo: ' + uploadErr.message);

      const { data: urlData } = supabase.storage
        .from('comprobantes-pagos')
        .getPublicUrl(path);

      // 2. Insertar en transacciones
      const { error: insertErr } = await supabase
        .from('transacciones')
        .insert({
          servidor_inscripcion_id: servidorId,
          tipo: 'egreso',
          estado: 'pendiente',
          monto: parseFloat(monto),
          url_comprobante: urlData.publicUrl,
          descripcion,
          retiro_id: RETIRO_ID,
          fecha: new Date().toISOString(),
        });
      if (insertErr) throw new Error('Error al registrar: ' + insertErr.message);

      setExito('¡Solicitud enviada! Un líder la revisará pronto.');
      setMonto(''); setDescripcion(''); setArchivo(null);
      if (fileRef.current) fileRef.current.value = '';
      if (servidorId) cargarHistorial(servidorId);
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
  const estadoLabel: Record<string, string> = {
    pendiente: 'Pendiente',
    aprobado: 'Aprobado',
    rechazado: 'Rechazado',
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
            Nueva solicitud de reembolso
          </h2>

          <label style={{ fontSize: 13, color: '#64748b', fontWeight: 500 }}>Monto (COP)</label>
          <input
            type="number"
            value={monto}
            onChange={e => setMonto(e.target.value)}
            placeholder="10000"
            style={{ width: '100%', padding: '10px 14px', border: '1.5px solid #e2e8f0', borderRadius: 10, fontSize: 15, marginBottom: 16, marginTop: 4, boxSizing: 'border-box' }}
          />

          <label style={{ fontSize: 13, color: '#64748b', fontWeight: 500 }}>¿Para qué fue la compra?</label>
          <textarea
            value={descripcion}
            onChange={e => setDescripcion(e.target.value)}
            rows={3}
            placeholder="Ej: Materiales para la mesa de bienvenida"
            style={{ width: '100%', padding: '10px 14px', border: '1.5px solid #e2e8f0', borderRadius: 10, fontSize: 15, marginBottom: 16, marginTop: 4, boxSizing: 'border-box', resize: 'vertical' }}
          />

          <label style={{ fontSize: 13, color: '#64748b', fontWeight: 500 }}>Factura o foto del recibo</label>
          <div
            onClick={() => fileRef.current?.click()}
            style={{ border: '2px dashed #c7d2fe', borderRadius: 10, padding: '16px', textAlign: 'center', cursor: 'pointer', marginTop: 4, marginBottom: 16, background: archivo ? '#f0fdf4' : '#f8fafc' }}
          >
            {archivo ? (
              <span style={{ color: '#16a34a', fontSize: 14 }}>📎 {archivo.name}</span>
            ) : (
              <span style={{ color: '#94a3b8', fontSize: 14 }}>Toca para adjuntar imagen o PDF</span>
            )}
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
                  <span style={{ fontWeight: 600, color: '#1e293b' }}>
                    ${parseInt(t.monto).toLocaleString('es-CO')}
                  </span>
                  <span style={{ fontSize: 12, fontWeight: 600, color: estadoColor[t.estado] || '#6b7280', background: '#f8fafc', padding: '3px 10px', borderRadius: 20 }}>
                    {estadoLabel[t.estado] || t.estado}
                  </span>
                </div>
                <p style={{ fontSize: 13, color: '#64748b', margin: '4px 0 0' }}>{t.descripcion}</p>
                {t.url_comprobante && (
                  <button
                    onClick={() => window.open(t.url_comprobante, '_blank')}
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
