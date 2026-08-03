'use client';
import { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabase';

const RETIRO_ID = '21da7588-f7d9-4bf8-a6f6-ae6c8258c00e';

export default function ReembolsosPage() {
  const [solicitudes, setSolicitudes] = useState<any[]>([]);
  const [categorias, setCategorias] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [procesando, setProcesando] = useState<string | null>(null);
  const [filtro, setFiltro] = useState<'pendiente' | 'aprobado' | 'rechazado'>('pendiente');

  useEffect(() => { cargar(); }, []);

  async function cargar() {
    setLoading(true);
    const [{ data: trans }, { data: cats }] = await Promise.all([
      supabase
        .from('transacciones')
        .select(`*, servidor_inscripcion:servidor_inscripcion_id(nombre), categoria:categoria_id(nombre)`)
        .eq('retiro_id', RETIRO_ID)
        .order('created_at', { ascending: false }),
      supabase.from('categorias_financieras').select('*').eq('retiro_id', RETIRO_ID).order('nombre'),
    ]);
    setSolicitudes(trans || []);
    setCategorias(cats || []);
    setLoading(false);
  }

  async function aprobar(id: string, categoriaId: string, tipo: 'ingreso' | 'egreso') {
    if (!categoriaId) { alert('Selecciona una categoría antes de aprobar.'); return; }
    setProcesando(id);
    const { error } = await supabase
      .from('transacciones')
      .update({ estado: 'aprobado', categoria_id: categoriaId, tipo })
      .eq('id', id);
    if (error) alert('Error: ' + error.message);
    else await cargar();
    setProcesando(null);
  }

  async function rechazar(id: string) {
    if (!confirm('¿Rechazar esta solicitud?')) return;
    setProcesando(id);
    const { error } = await supabase
      .from('transacciones')
      .update({ estado: 'rechazado' })
      .eq('id', id);
    if (error) alert('Error: ' + error.message);
    else await cargar();
    setProcesando(null);
  }

  const filtradas = solicitudes.filter(s => (s.estado || 'pendiente') === filtro);
  const pendientes = solicitudes.filter(s => (s.estado || 'pendiente') === 'pendiente').length;

  const tabStyle = (tab: string) => ({
    padding: '8px 20px', borderRadius: 8, border: 'none', cursor: 'pointer' as const,
    fontWeight: 600 as const, fontSize: 14,
    background: filtro === tab ? '#0f1787' : '#f1f5f9',
    color: filtro === tab ? '#fff' : '#64748b',
  });

  return (
    <div style={{ minHeight: '100vh', background: '#f7f8fc' }}>
      <div style={{ maxWidth: 800, margin: '0 auto', padding: '32px 16px' }}>

        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 28 }}>
          <div>
            <h1 style={{ fontSize: 26, fontWeight: 700, color: '#0f1787', margin: 0 }}>
              Solicitudes de reembolso
            </h1>
            {pendientes > 0 && (
              <p style={{ color: '#d97706', fontSize: 14, margin: '4px 0 0', fontWeight: 500 }}>
                ⚠️ {pendientes} solicitud{pendientes > 1 ? 'es' : ''} pendiente{pendientes > 1 ? 's' : ''}
              </p>
            )}
          </div>
          <button
            onClick={() => window.location.href = '/dashboard'}
            style={{ background: '#f1f5f9', border: 'none', borderRadius: 8, padding: '8px 16px', cursor: 'pointer', color: '#64748b', fontWeight: 500 }}
          >
            ← Volver
          </button>
        </div>

        <div style={{ display: 'flex', gap: 8, marginBottom: 24 }}>
          {(['pendiente', 'aprobado', 'rechazado'] as const).map(tab => (
            <button key={tab} onClick={() => setFiltro(tab)} style={tabStyle(tab)}>
              {tab.charAt(0).toUpperCase() + tab.slice(1)}
              {tab === 'pendiente' && pendientes > 0 && (
                <span style={{ background: '#dc2626', color: '#fff', borderRadius: 20, fontSize: 11, padding: '1px 7px', marginLeft: 6 }}>
                  {pendientes}
                </span>
              )}
            </button>
          ))}
        </div>

        {loading ? (
          <p style={{ color: '#94a3b8', textAlign: 'center', padding: 40 }}>Cargando...</p>
        ) : filtradas.length === 0 ? (
          <div style={{ background: '#fff', borderRadius: 16, padding: 40, textAlign: 'center', color: '#94a3b8', fontSize: 15 }}>
            {filtro === 'pendiente' ? '✅ No hay solicitudes pendientes' : `No hay solicitudes ${filtro}s`}
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
            {filtradas.map(s => (
              <SolicitudCard
                key={s.id}
                s={s}
                categorias={categorias}
                procesando={procesando}
                onAprobar={aprobar}
                onRechazar={rechazar}
              />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

function SolicitudCard({ s, categorias, procesando, onAprobar, onRechazar }: any) {
  const [catId, setCatId] = useState(s.categoria_id || '');
  const [tipo, setTipo] = useState<'ingreso' | 'egreso'>(s.tipo || 'egreso');

  const estadoColor: Record<string, string> = {
    pendiente: '#d97706',
    aprobado: '#16a34a',
    rechazado: '#dc2626',
  };
  const estadoEmoji: Record<string, string> = {
    pendiente: '⏳',
    aprobado: '✅',
    rechazado: '❌',
  };

  const estado = s.estado || 'pendiente';

  return (
    <div style={{ background: '#fff', borderRadius: 16, padding: 24, boxShadow: '0 1px 8px rgba(0,0,0,0.07)' }}>

      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 12 }}>
        <div>
          <span style={{ fontWeight: 700, fontSize: 22, color: '#0f1787' }}>
            ${parseInt(s.valor).toLocaleString('es-CO')} COP
          </span>
          <p style={{ margin: '4px 0 0', fontSize: 13, color: '#64748b', fontWeight: 500 }}>
            👤 {s.servidor_inscripcion?.nombre || 'Servidor'}
          </p>
        </div>
        <span style={{ fontSize: 12, fontWeight: 600, color: estadoColor[estado], background: '#f8fafc', padding: '4px 12px', borderRadius: 20, border: `1px solid ${estadoColor[estado]}20` }}>
          {estadoEmoji[estado]} {estado}
        </span>
      </div>

      <p style={{ fontSize: 14, color: '#334155', marginBottom: 8, lineHeight: 1.5, background: '#f8fafc', borderRadius: 8, padding: '10px 12px' }}>
        {s.descripcion || '(Sin descripción)'}
      </p>

      <div style={{ display: 'flex', gap: 16, marginBottom: 14, fontSize: 12, color: '#94a3b8' }}>
        <span>📅 {s.fecha ? new Date(s.fecha).toLocaleDateString('es-CO', { day: 'numeric', month: 'long' }) : '—'}</span>
        {s.categoria?.nombre && <span>🏷️ {s.categoria.nombre}</span>}
        {estado === 'aprobado' && (
          <span style={{ color: s.tipo === 'ingreso' ? '#16a34a' : '#dc2626', fontWeight: 600 }}>
            {s.tipo === 'ingreso' ? '↑ Ingreso' : '↓ Egreso'}
          </span>
        )}
      </div>

      {s.comprobante_url && (
        <button
          onClick={() => window.open(s.comprobante_url, '_blank')}
          style={{ display: 'inline-flex', alignItems: 'center', gap: 6, fontSize: 13, color: '#0f1787', background: '#eef2ff', border: 'none', borderRadius: 8, padding: '8px 14px', cursor: 'pointer', marginBottom: 16, fontWeight: 500 }}
        >
          📄 Ver comprobante {s.comprobante_nombre ? `(${s.comprobante_nombre})` : ''}
        </button>
      )}

      {estado === 'pendiente' && (
        <div style={{ borderTop: '1px solid #f1f5f9', paddingTop: 16 }}>

          <label style={{ fontSize: 13, color: '#64748b', fontWeight: 500, display: 'block', marginBottom: 6 }}>
            ¿Es un ingreso o un egreso?
          </label>
          <div style={{ display: 'flex', gap: 8, marginBottom: 14 }}>
            <button
              onClick={() => setTipo('egreso')}
              style={{ flex: 1, padding: '10px', borderRadius: 10, border: `2px solid ${tipo === 'egreso' ? '#dc2626' : '#e2e8f0'}`, background: tipo === 'egreso' ? '#fef2f2' : '#fff', color: tipo === 'egreso' ? '#dc2626' : '#94a3b8', fontWeight: 600, fontSize: 14, cursor: 'pointer' }}
            >
              ↓ Egreso
            </button>
            <button
              onClick={() => setTipo('ingreso')}
              style={{ flex: 1, padding: '10px', borderRadius: 10, border: `2px solid ${tipo === 'ingreso' ? '#16a34a' : '#e2e8f0'}`, background: tipo === 'ingreso' ? '#f0fdf4' : '#fff', color: tipo === 'ingreso' ? '#16a34a' : '#94a3b8', fontWeight: 600, fontSize: 14, cursor: 'pointer' }}
            >
              ↑ Ingreso
            </button>
          </div>

          <label style={{ fontSize: 13, color: '#64748b', fontWeight: 500, display: 'block', marginBottom: 6 }}>
            Categoría financiera
          </label>
          <select
            value={catId}
            onChange={e => setCatId(e.target.value)}
            style={{ width: '100%', padding: '10px 14px', border: '1.5px solid #e2e8f0', borderRadius: 10, fontSize: 14, marginBottom: 12, background: '#fff' }}
          >
            <option value="">Seleccionar categoría...</option>
            {categorias.map((c: any) => (
              <option key={c.id} value={c.id}>{c.nombre}</option>
            ))}
          </select>

          <div style={{ display: 'flex', gap: 10 }}>
            <button
              onClick={() => onAprobar(s.id, catId, tipo)}
              disabled={procesando === s.id || !catId}
              style={{ flex: 1, background: procesando === s.id || !catId ? '#94a3b8' : '#16a34a', color: '#fff', border: 'none', borderRadius: 10, padding: '12px', fontWeight: 600, fontSize: 14, cursor: procesando === s.id || !catId ? 'not-allowed' : 'pointer' }}
            >
              ✓ Aprobar y clasificar
            </button>
            <button
              onClick={() => onRechazar(s.id)}
              disabled={procesando === s.id}
              style={{ background: '#fef2f2', color: '#dc2626', border: '1.5px solid #fecaca', borderRadius: 10, padding: '12px 20px', fontWeight: 600, fontSize: 14, cursor: procesando === s.id ? 'not-allowed' : 'pointer' }}
            >
              ✗
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
