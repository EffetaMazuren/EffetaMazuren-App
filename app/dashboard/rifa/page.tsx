'use client';
import { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabase';
import { useRetiroActual } from '@/lib/retiro-context';
import RifaGrid, { EstadoNumero } from '@/components/RifaGrid';

const PRECIO_BOLETA = 20000;

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
  const [boletos, setBoletos] = useState<Boleto[]>([]);
  const [loading, setLoading] = useState(true);
  const [procesando, setProcesando] = useState<string | null>(null);
  const [filtro, setFiltro] = useState<'pendiente' | 'confirmado' | 'rechazado'>('pendiente');

  useEffect(() => {
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
    else await cargar();
    setProcesando(null);
  }

  async function rechazar(id: string) {
    if (!confirm('¿Rechazar este comprobante? El número quedará disponible de nuevo.')) return;
    setProcesando(id);
    const { error } = await supabase.from('rifa_boletos').update({ estado: 'rechazado' }).eq('id', id);
    if (error) alert('Error: ' + error.message);
    else await cargar();
    setProcesando(null);
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
          <p style={{ fontSize: 13, fontWeight: 600, color: '#1e293b', marginBottom: 12 }}>Números (00–99)</p>
          <RifaGrid estados={estados} />
          <div style={{ display: 'flex', gap: 14, marginTop: 12, fontSize: 12, color: '#6b7280' }}>
            <span><span style={{ display: 'inline-block', width: 10, height: 10, borderRadius: 3, background: '#fff', border: '1.5px solid #e5e7eb', marginRight: 4 }} />Disponible</span>
            <span><span style={{ display: 'inline-block', width: 10, height: 10, borderRadius: 3, background: '#fef3c7', border: '1.5px solid #fde68a', marginRight: 4 }} />Pendiente</span>
            <span><span style={{ display: 'inline-block', width: 10, height: 10, borderRadius: 3, background: '#f3f4f6', border: '1.5px solid #e5e7eb', marginRight: 4 }} />Vendido</span>
          </div>
        </div>

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

                <button
                  onClick={() => window.open(b.comprobante_url, '_blank')}
                  style={{ display: 'inline-flex', alignItems: 'center', gap: 6, fontSize: 13, color: '#0f1787', background: '#eef2ff', border: 'none', borderRadius: 8, padding: '8px 14px', cursor: 'pointer', marginBottom: 16, fontWeight: 500 }}
                >
                  📄 Ver comprobante {b.comprobante_nombre ? `(${b.comprobante_nombre})` : ''}
                </button>

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
    </div>
  );
}
