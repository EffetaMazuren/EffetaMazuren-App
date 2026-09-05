'use client';
import { useState, useEffect, useRef } from 'react';
import { supabase } from '@/lib/supabase';
import { useRetiroActual } from '@/lib/retiro-context';
import RifaGrid, { EstadoNumero } from '@/components/RifaGrid';

const PRECIO_BOLETA = 20000;
const RIFA_SHEET_URL = 'https://docs.google.com/spreadsheets/d/19mMBsI9PH8FzKvgS7fYLwblLEuVyI6kab86U7Dl8WqA/edit?usp=sharing';

type Boleto = {
  id: string;
  numero: number;
  comprador_nombre: string;
  comprador_documento: string;
  comprador_telefono: string;
  vendedor_nombre: string;
  comprobante_url: string;
  comprobante_nombre: string | null;
  estado: 'pendiente' | 'confirmado' | 'rechazado';
  created_at: string;
};

export default function RifaLiderPage() {
  const { id: RETIRO_ID } = useRetiroActual();
  const [usuarioId, setUsuarioId] = useState<string | null>(null);
  const [boletos, setBoletos] = useState<Boleto[]>([]);
  const [loading, setLoading] = useState(true);
  const [procesando, setProcesando] = useState<string | null>(null);
  const [filtro, setFiltro] = useState<'pendiente' | 'confirmado' | 'rechazado'>('pendiente');
  const [numeroInfo, setNumeroInfo] = useState<Boleto | null>(null);

  // Registrar venta directamente desde el tablero de líder
  const [mostrarFormVenta, setMostrarFormVenta] = useState(false);
  const [numeroSeleccionado, setNumeroSeleccionado] = useState<number | null>(null);
  const [compradorNombre, setCompradorNombre] = useState('');
  const [compradorDocumento, setCompradorDocumento] = useState('');
  const [compradorTelefono, setCompradorTelefono] = useState('');
  const [vendedorNombre, setVendedorNombre] = useState('');
  const [archivoRifa, setArchivoRifa] = useState<File | null>(null);
  const [enviandoRifa, setEnviandoRifa] = useState(false);
  const [errorRifa, setErrorRifa] = useState('');
  const [exitoRifa, setExitoRifa] = useState('');
  const fileRifaRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => setUsuarioId(data.user?.id ?? null));
    cargar();
    const channel = supabase
      .channel('rifa-lider')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'rifa_boletos', filter: `retiro_id=eq.${RETIRO_ID}` }, () => cargar())
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, []);

  async function cargar() {
    const { data } = await supabase
      .from('rifa_boletos')
      .select('*')
      .eq('retiro_id', RETIRO_ID)
      .order('created_at', { ascending: false });
    setBoletos(data || []);
    setLoading(false);
  }

  async function aprobar(id: string) {
    setProcesando(id);
    const { error } = await supabase.from('rifa_boletos').update({ estado: 'confirmado' }).eq('id', id);
    if (error) alert('Error: ' + error.message);
    else { await cargar(); setNumeroInfo(null); }
    setProcesando(null);
  }

  async function rechazar(id: string) {
    if (!confirm('¿Rechazar este comprobante? El número quedará disponible de nuevo.')) return;
    setProcesando(id);
    const { error } = await supabase.from('rifa_boletos').update({ estado: 'rechazado' }).eq('id', id);
    if (error) alert('Error: ' + error.message);
    else { await cargar(); setNumeroInfo(null); }
    setProcesando(null);
  }

  async function eliminar(id: string, numero: number) {
    if (!confirm(`¿Eliminar por completo la boleta № ${String(numero).padStart(2, '0')}? Esto no se puede deshacer y el número quedará disponible de nuevo.`)) return;
    setProcesando(id);
    try {
      const res = await fetch(`/api/rifa/${id}`, { method: 'DELETE' });
      const data = await res.json();
      if (!data.success) throw new Error(data.error || 'Error al eliminar');
      await cargar();
      setNumeroInfo(null);
    } catch (e: any) {
      alert('Error: ' + e.message);
    }
    setProcesando(null);
  }

  async function enviarVenta() {
    setErrorRifa(''); setExitoRifa('');
    if (numeroSeleccionado === null || !compradorNombre || !compradorDocumento || !compradorTelefono || !vendedorNombre || !archivoRifa) {
      setErrorRifa('Elige un número, completa los datos del comprador, quién vendió, y adjunta el comprobante.');
      return;
    }
    setEnviandoRifa(true);
    try {
      const ext = archivoRifa.name.split('.').pop();
      const path = `rifa/${RETIRO_ID}/boleta_${numeroSeleccionado}_${Date.now()}.${ext}`;
      const { error: uploadErr } = await supabase.storage
        .from('comprobantes-pagos')
        .upload(path, archivoRifa, { upsert: true });
      if (uploadErr) throw new Error('Error subiendo el comprobante: ' + uploadErr.message);

      const { data: urlData } = supabase.storage.from('comprobantes-pagos').getPublicUrl(path);

      const res = await fetch('/api/rifa/registrar', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          retiroId: RETIRO_ID,
          numero: numeroSeleccionado,
          compradorNombre, compradorDocumento, compradorTelefono, vendedorNombre,
          comprobanteUrl: urlData.publicUrl,
          comprobanteNombre: archivoRifa.name,
          registradoPor: usuarioId,
          estado: 'confirmado',
        }),
      });
      const data = await res.json();
      if (!data.success) throw new Error(data.error || 'Error registrando la boleta');

      setExitoRifa(`¡Boleta ${String(numeroSeleccionado).padStart(2, '0')} registrada y confirmada!`);
      setNumeroSeleccionado(null); setCompradorNombre(''); setCompradorDocumento(''); setCompradorTelefono(''); setVendedorNombre(''); setArchivoRifa(null);
      if (fileRifaRef.current) fileRifaRef.current.value = '';
      cargar();
    } catch (e: any) {
      setErrorRifa(e.message);
    } finally {
      setEnviandoRifa(false);
    }
  }

  const pendientes = boletos.filter(b => b.estado === 'pendiente');
  const confirmados = boletos.filter(b => b.estado === 'confirmado');
  const vendidos = pendientes.length + confirmados.length;
  const recaudado = confirmados.length * PRECIO_BOLETA;

  const estados: Record<number, EstadoNumero> = {};
  boletos.forEach(b => { if (b.estado !== 'rechazado') estados[b.numero] = b.estado as EstadoNumero; });

  const filtradas = boletos.filter(b => b.estado === filtro);

  const tabStyle = (tab: string) => ({
    padding: '8px 20px', borderRadius: 8, border: 'none', cursor: 'pointer' as const,
    fontWeight: 600 as const, fontSize: 14,
    background: filtro === tab ? '#0f1787' : '#f1f5f9',
    color: filtro === tab ? '#fff' : '#64748b',
  });

  const estadoColor: Record<string, string> = { pendiente: '#d97706', confirmado: '#16a34a', rechazado: '#dc2626' };
  const estadoEmoji: Record<string, string> = { pendiente: '⏳', confirmado: '✅', rechazado: '❌' };

  function verInfoNumero(n: number) {
    const b = boletos.find(bb => bb.numero === n && bb.estado !== 'rechazado');
    if (b) setNumeroInfo(b);
  }

  return (
    <div style={{ minHeight: '100vh', background: '#f7f8fc' }}>
      <div style={{ maxWidth: 800, margin: '0 auto', padding: '32px 16px' }}>

        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
          <h1 style={{ fontSize: 26, fontWeight: 700, color: '#0f1787', margin: 0 }}>Rifa</h1>
          <button
            onClick={() => window.location.href = '/dashboard'}
            style={{ background: '#f1f5f9', border: 'none', borderRadius: 8, padding: '8px 16px', cursor: 'pointer', color: '#64748b', fontWeight: 500 }}
          >
            ← Volver
          </button>
        </div>

        <div style={{ display: 'flex', gap: 10, marginBottom: 20, flexWrap: 'wrap' }}>
          {RIFA_SHEET_URL && (
            <button
              onClick={() => window.open(RIFA_SHEET_URL, '_blank')}
              style={{ display: 'flex', alignItems: 'center', gap: 8, background: '#0f9d58', color: '#fff', border: 'none', borderRadius: 10, padding: '10px 16px', fontWeight: 600, fontSize: 13, cursor: 'pointer' }}
            >
              📊 Ver Google Sheet
            </button>
          )}
          <button
            onClick={() => { setMostrarFormVenta(v => !v); setNumeroSeleccionado(null); setErrorRifa(''); setExitoRifa(''); }}
            style={{ display: 'flex', alignItems: 'center', gap: 8, background: mostrarFormVenta ? '#f1f5f9' : '#0f1787', color: mostrarFormVenta ? '#374151' : '#fff', border: 'none', borderRadius: 10, padding: '10px 16px', fontWeight: 600, fontSize: 13, cursor: 'pointer' }}
          >
            {mostrarFormVenta ? '✕ Cancelar registro' : '+ Registrar venta'}
          </button>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 10, marginBottom: 24 }}>
          <div style={{ background: '#fff', borderRadius: 14, padding: 16, border: '0.5px solid #e8eaf0' }}>
            <p style={{ fontSize: 11, color: '#9ca3af', margin: '0 0 4px', textTransform: 'uppercase', fontWeight: 600 }}>Vendidas</p>
            <p style={{ fontSize: 22, fontWeight: 700, color: '#0f1787', margin: 0 }}>{vendidos}<span style={{ fontSize: 14, color: '#9ca3af', fontWeight: 500 }}>/100</span></p>
          </div>
          <div style={{ background: '#fff', borderRadius: 14, padding: 16, border: '0.5px solid #e8eaf0' }}>
            <p style={{ fontSize: 11, color: '#9ca3af', margin: '0 0 4px', textTransform: 'uppercase', fontWeight: 600 }}>Recaudado</p>
            <p style={{ fontSize: 22, fontWeight: 700, color: '#16a34a', margin: 0 }}>${recaudado.toLocaleString('es-CO')}</p>
          </div>
          <div style={{ background: '#fff', borderRadius: 14, padding: 16, border: '0.5px solid #e8eaf0' }}>
            <p style={{ fontSize: 11, color: '#9ca3af', margin: '0 0 4px', textTransform: 'uppercase', fontWeight: 600 }}>Por revisar</p>
            <p style={{ fontSize: 22, fontWeight: 700, color: '#d97706', margin: 0 }}>{pendientes.length}</p>
          </div>
        </div>

        <div style={{ background: '#fff', borderRadius: 16, padding: 20, border: '0.5px solid #e8eaf0', marginBottom: 24 }}>
          <p style={{ fontSize: 13, fontWeight: 600, color: '#1e293b', marginBottom: 12 }}>
            Números (00–99){mostrarFormVenta ? ' · toca uno disponible para venderlo' : ' · toca uno vendido o pendiente para ver el detalle'}
          </p>
          <RifaGrid
            estados={estados}
            seleccionado={numeroSeleccionado}
            onSelect={mostrarFormVenta ? setNumeroSeleccionado : undefined}
            onClickTomado={verInfoNumero}
          />
          <div style={{ display: 'flex', gap: 14, marginTop: 12, fontSize: 12, color: '#6b7280' }}>
            <span><span style={{ display: 'inline-block', width: 10, height: 10, borderRadius: 3, background: '#fff', border: '1.5px solid #e5e7eb', marginRight: 4 }} />Disponible</span>
            <span><span style={{ display: 'inline-block', width: 10, height: 10, borderRadius: 3, background: '#fef3c7', border: '1.5px solid #fde68a', marginRight: 4 }} />Pendiente</span>
            <span><span style={{ display: 'inline-block', width: 10, height: 10, borderRadius: 3, background: '#f3f4f6', border: '1.5px solid #e5e7eb', marginRight: 4 }} />Vendido</span>
          </div>
        </div>

        {mostrarFormVenta && numeroSeleccionado !== null && (
          <div style={{ background: '#fff', borderRadius: 16, padding: 24, border: '0.5px solid #e8eaf0', marginBottom: 24 }}>
            <p style={{ fontSize: 14, fontWeight: 600, color: '#0f1787', marginBottom: 14 }}>
              Registrar venta — Número {String(numeroSeleccionado).padStart(2, '0')}
            </p>

            <label style={{ fontSize: 13, color: '#64748b', fontWeight: 500, display: 'block', marginBottom: 6 }}>Nombre de quien pagó</label>
            <input value={compradorNombre} onChange={e => setCompradorNombre(e.target.value)}
              style={{ width: '100%', padding: '10px 14px', border: '1.5px solid #e2e8f0', borderRadius: 10, fontSize: 15, marginBottom: 14, boxSizing: 'border-box' }} />

            <label style={{ fontSize: 13, color: '#64748b', fontWeight: 500, display: 'block', marginBottom: 6 }}>Cédula</label>
            <input value={compradorDocumento} onChange={e => setCompradorDocumento(e.target.value)}
              style={{ width: '100%', padding: '10px 14px', border: '1.5px solid #e2e8f0', borderRadius: 10, fontSize: 15, marginBottom: 14, boxSizing: 'border-box' }} />

            <label style={{ fontSize: 13, color: '#64748b', fontWeight: 500, display: 'block', marginBottom: 6 }}>Teléfono</label>
            <input value={compradorTelefono} onChange={e => setCompradorTelefono(e.target.value)}
              style={{ width: '100%', padding: '10px 14px', border: '1.5px solid #e2e8f0', borderRadius: 10, fontSize: 15, marginBottom: 14, boxSizing: 'border-box' }} />

            <label style={{ fontSize: 13, color: '#64748b', fontWeight: 500, display: 'block', marginBottom: 6 }}>¿Quién vendió la boleta?</label>
            <input value={vendedorNombre} onChange={e => setVendedorNombre(e.target.value)} placeholder="Nombre del servidor"
              style={{ width: '100%', padding: '10px 14px', border: '1.5px solid #e2e8f0', borderRadius: 10, fontSize: 15, marginBottom: 14, boxSizing: 'border-box' }} />

            <label style={{ fontSize: 13, color: '#64748b', fontWeight: 500, display: 'block', marginBottom: 6 }}>Comprobante de pago</label>
            <div
              onClick={() => fileRifaRef.current?.click()}
              style={{ border: '2px dashed #c7d2fe', borderRadius: 10, padding: '16px', textAlign: 'center', cursor: 'pointer', marginBottom: 16, background: archivoRifa ? '#f0fdf4' : '#f8fafc' }}
            >
              {archivoRifa
                ? <span style={{ color: '#16a34a', fontSize: 14 }}>📎 {archivoRifa.name}</span>
                : <span style={{ color: '#94a3b8', fontSize: 14 }}>Toca para adjuntar imagen o PDF</span>
              }
            </div>
            <input ref={fileRifaRef} type="file" accept="image/*,application/pdf" style={{ display: 'none' }} onChange={e => setArchivoRifa(e.target.files?.[0] || null)} />

            {errorRifa && (
              <div style={{ background: '#fef2f2', border: '1px solid #fecaca', color: '#dc2626', borderRadius: 8, padding: '10px 14px', fontSize: 13, marginBottom: 12 }}>
                {errorRifa}
              </div>
            )}
            {exitoRifa && (
              <div style={{ background: '#f0fdf4', border: '1px solid #bbf7d0', color: '#16a34a', borderRadius: 8, padding: '10px 14px', fontSize: 13, marginBottom: 12 }}>
                {exitoRifa}
              </div>
            )}

            <button
              onClick={enviarVenta}
              disabled={enviandoRifa}
              style={{ width: '100%', background: enviandoRifa ? '#94a3b8' : '#0f1787', color: '#fff', border: 'none', borderRadius: 10, padding: '14px', fontSize: 15, fontWeight: 600, cursor: enviandoRifa ? 'not-allowed' : 'pointer' }}
            >
              {enviandoRifa ? 'Registrando...' : `Confirmar venta ${String(numeroSeleccionado).padStart(2, '0')}`}
            </button>
          </div>
        )}

        <div style={{ display: 'flex', gap: 8, marginBottom: 24 }}>
          {(['pendiente', 'confirmado', 'rechazado'] as const).map(tab => (
            <button key={tab} onClick={() => setFiltro(tab)} style={tabStyle(tab)}>
              {tab.charAt(0).toUpperCase() + tab.slice(1)}
              {tab === 'pendiente' && pendientes.length > 0 && (
                <span style={{ background: '#dc2626', color: '#fff', borderRadius: 20, fontSize: 11, padding: '1px 7px', marginLeft: 6 }}>
                  {pendientes.length}
                </span>
              )}
            </button>
          ))}
        </div>

        {loading ? (
          <p style={{ color: '#94a3b8', textAlign: 'center', padding: 40 }}>Cargando...</p>
        ) : filtradas.length === 0 ? (
          <div style={{ background: '#fff', borderRadius: 16, padding: 40, textAlign: 'center', color: '#94a3b8', fontSize: 15 }}>
            {filtro === 'pendiente' ? '✅ No hay boletas pendientes' : `No hay boletas ${filtro}s`}
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
            {filtradas.map(b => (
              <div key={b.id} style={{ background: '#fff', borderRadius: 16, padding: 24, boxShadow: '0 1px 8px rgba(0,0,0,0.07)' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 12 }}>
                  <div>
                    <span style={{ fontWeight: 700, fontSize: 22, color: '#0f1787' }}>№ {String(b.numero).padStart(2, '0')}</span>
                    <p style={{ margin: '4px 0 0', fontSize: 13, color: '#64748b', fontWeight: 500 }}>👤 {b.comprador_nombre} · {b.comprador_documento}</p>
                    <p style={{ margin: '2px 0 0', fontSize: 13, color: '#64748b' }}>📞 {b.comprador_telefono}</p>
                    <p style={{ margin: '2px 0 0', fontSize: 13, color: '#64748b' }}>🎟️ Vendió: {b.vendedor_nombre}</p>
                  </div>
                  <span style={{ fontSize: 12, fontWeight: 600, color: estadoColor[b.estado], background: '#f8fafc', padding: '4px 12px', borderRadius: 20, border: `1px solid ${estadoColor[b.estado]}20` }}>
                    {estadoEmoji[b.estado]} {b.estado}
                  </span>
                </div>

                <div style={{ display: 'flex', gap: 8, marginBottom: 16, flexWrap: 'wrap' }}>
                  <button
                    onClick={() => window.open(b.comprobante_url, '_blank')}
                    style={{ display: 'inline-flex', alignItems: 'center', gap: 6, fontSize: 13, color: '#0f1787', background: '#eef2ff', border: 'none', borderRadius: 8, padding: '8px 14px', cursor: 'pointer', fontWeight: 500 }}
                  >
                    📄 Ver comprobante {b.comprobante_nombre ? `(${b.comprobante_nombre})` : ''}
                  </button>
                  <button
                    onClick={() => eliminar(b.id, b.numero)}
                    disabled={procesando === b.id}
                    style={{ display: 'inline-flex', alignItems: 'center', gap: 6, fontSize: 13, color: '#dc2626', background: '#fef2f2', border: 'none', borderRadius: 8, padding: '8px 14px', cursor: procesando === b.id ? 'not-allowed' : 'pointer', fontWeight: 500 }}
                  >
                    🗑️ Eliminar
                  </button>
                </div>

                {b.estado === 'pendiente' && (
                  <div style={{ display: 'flex', gap: 10, borderTop: '1px solid #f1f5f9', paddingTop: 16 }}>
                    <button
                      onClick={() => aprobar(b.id)}
                      disabled={procesando === b.id}
                      style={{ flex: 1, background: procesando === b.id ? '#94a3b8' : '#16a34a', color: '#fff', border: 'none', borderRadius: 10, padding: '12px', fontWeight: 600, fontSize: 14, cursor: procesando === b.id ? 'not-allowed' : 'pointer' }}
                    >
                      ✓ Confirmar pago
                    </button>
                    <button
                      onClick={() => rechazar(b.id)}
                      disabled={procesando === b.id}
                      style={{ background: '#fef2f2', color: '#dc2626', border: '1.5px solid #fecaca', borderRadius: 10, padding: '12px 20px', fontWeight: 600, fontSize: 14, cursor: procesando === b.id ? 'not-allowed' : 'pointer' }}
                    >
                      ✗
                    </button>
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>

      {numeroInfo && (
        <div
          onClick={() => setNumeroInfo(null)}
          style={{ position: 'fixed', inset: 0, background: 'rgba(15,23,42,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20, zIndex: 50 }}
        >
          <div onClick={e => e.stopPropagation()} style={{ background: '#fff', borderRadius: 18, padding: 24, maxWidth: 380, width: '100%', boxShadow: '0 10px 40px rgba(0,0,0,0.2)' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 14 }}>
              <span style={{ fontWeight: 700, fontSize: 26, color: '#0f1787' }}>№ {String(numeroInfo.numero).padStart(2, '0')}</span>
              <span style={{ fontSize: 12, fontWeight: 600, color: estadoColor[numeroInfo.estado], background: '#f8fafc', padding: '4px 12px', borderRadius: 20, border: `1px solid ${estadoColor[numeroInfo.estado]}20` }}>
                {estadoEmoji[numeroInfo.estado]} {numeroInfo.estado}
              </span>
            </div>
            <p style={{ margin: '4px 0 0', fontSize: 14, color: '#334155', fontWeight: 500 }}>👤 {numeroInfo.comprador_nombre} · {numeroInfo.comprador_documento}</p>
            <p style={{ margin: '4px 0 0', fontSize: 14, color: '#334155' }}>📞 {numeroInfo.comprador_telefono}</p>
            <p style={{ margin: '4px 0 16px', fontSize: 14, color: '#334155' }}>🎟️ Vendió: {numeroInfo.vendedor_nombre}</p>

            <button
              onClick={() => window.open(numeroInfo.comprobante_url, '_blank')}
              style={{ display: 'flex', width: '100%', justifyContent: 'center', alignItems: 'center', gap: 6, fontSize: 13, color: '#0f1787', background: '#eef2ff', border: 'none', borderRadius: 8, padding: '10px 14px', cursor: 'pointer', marginBottom: 16, fontWeight: 500 }}
            >
              📄 Ver comprobante {numeroInfo.comprobante_nombre ? `(${numeroInfo.comprobante_nombre})` : ''}
            </button>

            {numeroInfo.estado === 'pendiente' && (
              <div style={{ display: 'flex', gap: 10 }}>
                <button
                  onClick={() => aprobar(numeroInfo.id)}
                  disabled={procesando === numeroInfo.id}
                  style={{ flex: 1, background: procesando === numeroInfo.id ? '#94a3b8' : '#16a34a', color: '#fff', border: 'none', borderRadius: 10, padding: '12px', fontWeight: 600, fontSize: 14, cursor: procesando === numeroInfo.id ? 'not-allowed' : 'pointer' }}
                >
                  ✓ Confirmar pago
                </button>
                <button
                  onClick={() => rechazar(numeroInfo.id)}
                  disabled={procesando === numeroInfo.id}
                  style={{ background: '#fef2f2', color: '#dc2626', border: '1.5px solid #fecaca', borderRadius: 10, padding: '12px 20px', fontWeight: 600, fontSize: 14, cursor: procesando === numeroInfo.id ? 'not-allowed' : 'pointer' }}
                >
                  ✗
                </button>
              </div>
            )}

            <button
              onClick={() => eliminar(numeroInfo.id, numeroInfo.numero)}
              disabled={procesando === numeroInfo.id}
              style={{ width: '100%', display: 'flex', justifyContent: 'center', alignItems: 'center', gap: 6, fontSize: 13, color: '#dc2626', background: '#fef2f2', border: 'none', borderRadius: 8, padding: '10px 14px', cursor: procesando === numeroInfo.id ? 'not-allowed' : 'pointer', fontWeight: 500, marginTop: 10 }}
            >
              🗑️ Eliminar boleta
            </button>

            <button
              onClick={() => setNumeroInfo(null)}
              style={{ width: '100%', background: 'none', border: 'none', color: '#64748b', fontSize: 13, padding: '12px 0 0', cursor: 'pointer' }}
            >
              Cerrar
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
