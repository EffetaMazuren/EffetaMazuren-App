'use client';
import { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase';

interface Seguimiento {
  id: string;
  caminante_nombre: string;
  servidor_inscripcion_id: string;
  es_sorpresa: boolean;
  llamo: boolean;
  contesto: boolean;
  envio_cartas: boolean;
  envio_fotos: boolean;
  donde_palancas: string | null;
  notas: string | null;
  conoce_alguien: string | null;
  updated_at: string;
}

const RETIRO_ID = '21da7588-f7d9-4bf8-a6f6-ae6c8258c00e';
const APPS_SCRIPT_URL = process.env.NEXT_PUBLIC_APPS_SCRIPT_PALANCAS_URL || '';

const SERVIDORES_PALANCAS_IDS = [
  '87a34a20-e973-4b76-92a0-4817f01e6778',
  'fc5f960c-70cc-4c85-be11-14484abb70ff',
  'ebc59dbf-b3e1-4d5d-8c89-d8facf50680d',
  'b201c88d-d651-4889-abac-c74ac8a2ffda',
  '2852cef9-b8df-4ac1-9f21-e0c6226c63a2',
  'c3ece132-f88e-4432-b6dd-5c6b879a1860',
  'f22ec19a-079b-46cb-bbac-3f75804d008a',
  '1b4de35a-1165-4364-a0f5-31d5938dabbd',
  '56bf1b6c-965c-4b55-937b-d6df8bb05cd8',
];

const APODOS: Record<string, string> = {
  '87a34a20-e973-4b76-92a0-4817f01e6778': 'Ale',
  'fc5f960c-70cc-4c85-be11-14484abb70ff': 'David',
  'ebc59dbf-b3e1-4d5d-8c89-d8facf50680d': 'Andrés',
  'b201c88d-d651-4889-abac-c74ac8a2ffda': 'Pau Rodriguez',
  '2852cef9-b8df-4ac1-9f21-e0c6226c63a2': 'Santi',
  'c3ece132-f88e-4432-b6dd-5c6b879a1860': 'Pau Agudelo',
  'f22ec19a-079b-46cb-bbac-3f75804d008a': 'Mapis',
  '1b4de35a-1165-4364-a0f5-31d5938dabbd': 'Lu Cuellar',
  '56bf1b6c-965c-4b55-937b-d6df8bb05cd8': 'Diego',
};

export default function DashboardPalancasPage() {
  const [seguimiento, setSeguimiento] = useState<Seguimiento[]>([]);
  const [servidores, setServidores] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(true);
  const [accesoDenegado, setAccesoDenegado] = useState(false);
  const [filtroServidor, setFiltroServidor] = useState('todos');
  const [filtroEstado, setFiltroEstado] = useState('todos');
  const [busqueda, setBusqueda] = useState('');
  const [reasignando, setReasignando] = useState<string | null>(null);
  const [guardandoReasignacion, setGuardandoReasignacion] = useState<string | null>(null);
  const [expandido, setExpandido] = useState<string | null>(null);

  useEffect(() => { cargarDatos(); }, []);

  async function cargarDatos() {
    setLoading(true);

    // Verificar acceso: rol=lider O es_lider_palancas=true
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) { setAccesoDenegado(true); setLoading(false); return; }

    const { data: usuario } = await supabase
      .from('usuarios')
      .select('rol')
      .eq('id', user.id)
      .single();

    if (usuario?.rol !== 'lider') {
      // Verificar si es servidor con es_lider_palancas
      const { data: srv } = await supabase
        .from('servidores_inscripcion')
        .select('es_lider_palancas')
        .eq('usuario_id', user.id)
        .eq('retiro_id', RETIRO_ID)
        .single();

      if (!srv?.es_lider_palancas) {
        setAccesoDenegado(true);
        setLoading(false);
        return;
      }
    }

    const { data: srvData } = await supabase
      .from('servidores_inscripcion')
      .select('id, nombre')
      .in('id', SERVIDORES_PALANCAS_IDS)
      .order('nombre');

    const mapaServidores: Record<string, string> = {};
    (srvData || []).forEach((s: { id: string; nombre: string }) => {
      mapaServidores[s.id] = APODOS[s.id] || s.nombre;
    });
    setServidores(mapaServidores);

    const { data } = await supabase
      .from('palancas_seguimiento')
      .select('*')
      .eq('retiro_id', RETIRO_ID)
      .order('caminante_nombre');

    setSeguimiento(data || []);
    setLoading(false);
  }

  async function reasignarServidor(seguimientoId: string, nuevoServidorId: string, caminanteNombre: string) {
    setGuardandoReasignacion(seguimientoId);

    await supabase
      .from('palancas_seguimiento')
      .update({ servidor_inscripcion_id: nuevoServidorId })
      .eq('id', seguimientoId);

    if (APPS_SCRIPT_URL) {
      try {
        const actual = seguimiento.find(s => s.id === seguimientoId);
        if (actual) {
          await fetch(APPS_SCRIPT_URL, {
            method: 'POST',
            body: JSON.stringify({
              type: 'sync_palanca',
              caminante_nombre: caminanteNombre,
              servidor_nombre: APODOS[nuevoServidorId] || '',
              servidor_inscripcion_id: nuevoServidorId,
              es_sorpresa: actual.es_sorpresa,
              llamo: actual.llamo,
              envio_cartas: actual.envio_cartas,
              envio_fotos: actual.envio_fotos,
              donde_palancas: actual.donde_palancas || '',
              notas: actual.notas || '',
              conoce_alguien: actual.conoce_alguien || '',
            }),
          });
        }
      } catch (_) {}
    }

    setSeguimiento(prev => prev.map(s =>
      s.id === seguimientoId ? { ...s, servidor_inscripcion_id: nuevoServidorId } : s
    ));
    setReasignando(null);
    setGuardandoReasignacion(null);
  }

  const total = seguimiento.length;
  const llamaron = seguimiento.filter(s => s.llamo).length;
  const enviaron_cartas = seguimiento.filter(s => s.envio_cartas).length;
  const enviaron_fotos = seguimiento.filter(s => s.envio_fotos).length;
  const sorpresas = seguimiento.filter(s => s.es_sorpresa).length;
  const completos = seguimiento.filter(s => s.llamo && s.envio_cartas && s.envio_fotos).length;

  const servidoresUnicos = [...new Set(seguimiento.map(s => s.servidor_inscripcion_id))];

  const filtrados = seguimiento.filter(s => {
    const pasaServidor = filtroServidor === 'todos' || s.servidor_inscripcion_id === filtroServidor;
    const pasaEstado = filtroEstado === 'todos'
      || (filtroEstado === 'completos' && s.llamo && s.envio_cartas && s.envio_fotos)
      || (filtroEstado === 'pendientes' && (!s.llamo || !s.envio_cartas || !s.envio_fotos))
      || (filtroEstado === 'sorpresas' && s.es_sorpresa)
      || (filtroEstado === 'sin_llamar' && !s.llamo);
    const pasaBusqueda = busqueda === '' ||
      s.caminante_nombre.toLowerCase().includes(busqueda.toLowerCase()) ||
      (APODOS[s.servidor_inscripcion_id] || '').toLowerCase().includes(busqueda.toLowerCase());
    return pasaServidor && pasaEstado && pasaBusqueda;
  });

  if (loading) return (
    <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: '60vh' }}>
      <p style={{ color: '#6b7280', fontSize: 14 }}>Cargando...</p>
    </div>
  );

  if (accesoDenegado) return (
    <div style={{ padding: 24 }}>
      <p style={{ color: '#dc2626', fontSize: 14 }}>No tienes acceso a esta sección.</p>
    </div>
  );

  return (
    <div style={{ background: '#f7f8fc', minHeight: '100vh', paddingBottom: 40 }}>
      <div style={{ background: '#0f1787', padding: '28px 24px 24px' }}>
        <p style={{ color: 'rgba(255,255,255,0.6)', fontSize: 12, margin: '0 0 4px', letterSpacing: 1 }}>DASHBOARD LÍDERES</p>
        <h1 style={{ color: '#fff', fontSize: 22, fontWeight: 700, margin: '0 0 16px', fontFamily: 'Georgia, serif', letterSpacing: 1 }}>Grupo Palancas</h1>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 8 }}>
          {[
            { label: 'Total', valor: total, color: 'rgba(255,255,255,0.15)' },
            { label: 'Llamaron', valor: llamaron, color: 'rgba(255,255,255,0.15)' },
            { label: 'Completos', valor: completos, color: 'rgba(22,163,74,0.3)' },
            { label: 'Cartas', valor: enviaron_cartas, color: 'rgba(255,255,255,0.15)' },
            { label: 'Fotos', valor: enviaron_fotos, color: 'rgba(255,255,255,0.15)' },
            { label: 'Sorpresas', valor: sorpresas, color: 'rgba(217,119,6,0.3)' },
          ].map(m => (
            <div key={m.label} style={{ background: m.color, borderRadius: 10, padding: '10px 12px' }}>
              <p style={{ color: 'rgba(255,255,255,0.7)', fontSize: 11, margin: '0 0 2px' }}>{m.label}</p>
              <p style={{ color: '#fff', fontSize: 20, fontWeight: 700, margin: 0 }}>{m.valor}</p>
            </div>
          ))}
        </div>

        <div style={{ marginTop: 14 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
            <p style={{ color: 'rgba(255,255,255,0.7)', fontSize: 12, margin: 0 }}>Progreso general</p>
            <p style={{ color: '#fff', fontSize: 12, fontWeight: 600, margin: 0 }}>{total > 0 ? Math.round((completos / total) * 100) : 0}%</p>
          </div>
          <div style={{ height: 6, background: 'rgba(255,255,255,0.2)', borderRadius: 3 }}>
            <div style={{ height: '100%', background: '#4ade80', borderRadius: 3, width: `${total > 0 ? (completos / total) * 100 : 0}%`, transition: 'width 0.5s' }} />
          </div>
        </div>
      </div>

      <div style={{ padding: '16px 16px 0', display: 'flex', flexDirection: 'column', gap: 10 }}>
        {/* Barra de búsqueda */}
        <div style={{ position: 'relative' }}>
          <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="#9ca3af" strokeWidth="2" strokeLinecap="round" style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)' }}>
            <circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/>
          </svg>
          <input
            value={busqueda}
            onChange={e => setBusqueda(e.target.value)}
            placeholder="Buscar caminante o servidor..."
            style={{
              width: '100%', padding: '10px 12px 10px 36px', borderRadius: 10,
              border: '0.5px solid #e8eaf0', fontSize: 13, color: '#111827',
              background: '#fff', boxSizing: 'border-box', outline: 'none',
            }}
          />
          {busqueda && (
            <button onClick={() => setBusqueda('')} style={{ position: 'absolute', right: 10, top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', cursor: 'pointer', color: '#9ca3af', fontSize: 16 }}>×</button>
          )}
        </div>

        {/* Filtro por servidor */}
        <div style={{ overflowX: 'auto', paddingBottom: 4 }}>
          <div style={{ display: 'flex', gap: 6, width: 'max-content' }}>
            <button onClick={() => setFiltroServidor('todos')} style={{
              padding: '6px 14px', borderRadius: 20, fontSize: 12, fontWeight: 500, cursor: 'pointer', border: '0.5px solid', whiteSpace: 'nowrap',
              background: filtroServidor === 'todos' ? '#0f1787' : '#fff',
              color: filtroServidor === 'todos' ? '#fff' : '#374151',
              borderColor: filtroServidor === 'todos' ? '#0f1787' : '#e8eaf0',
            }}>Todos</button>
            {servidoresUnicos.map(id => (
              <button key={id} onClick={() => setFiltroServidor(id)} style={{
                padding: '6px 14px', borderRadius: 20, fontSize: 12, fontWeight: 500, cursor: 'pointer', border: '0.5px solid', whiteSpace: 'nowrap',
                background: filtroServidor === id ? '#0f1787' : '#fff',
                color: filtroServidor === id ? '#fff' : '#374151',
                borderColor: filtroServidor === id ? '#0f1787' : '#e8eaf0',
              }}>{APODOS[id] || id}</button>
            ))}
          </div>
        </div>

        {/* Filtro por estado */}
        <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
          {[
            { val: 'todos', label: 'Todos' },
            { val: 'pendientes', label: 'Con pendientes' },
            { val: 'sin_llamar', label: 'Sin llamar' },
            { val: 'sorpresas', label: 'Sorpresas' },
            { val: 'completos', label: 'Completos' },
          ].map(f => (
            <button key={f.val} onClick={() => setFiltroEstado(f.val)} style={{
              padding: '5px 12px', borderRadius: 20, fontSize: 12, fontWeight: 500, cursor: 'pointer', border: '0.5px solid',
              background: filtroEstado === f.val ? '#111827' : '#fff',
              color: filtroEstado === f.val ? '#fff' : '#374151',
              borderColor: filtroEstado === f.val ? '#111827' : '#e8eaf0',
            }}>{f.label}</button>
          ))}
        </div>
      </div>

      <div style={{ padding: '10px 16px 0' }}>
        <p style={{ fontSize: 12, color: '#6b7280', margin: 0 }}>Mostrando {filtrados.length} de {total} caminantes</p>
      </div>

      <div style={{ padding: 16, display: 'flex', flexDirection: 'column', gap: 10 }}>
        {filtrados.map(s => {
          const completo = s.llamo && s.envio_cartas && s.envio_fotos;
          const abierto = expandido === s.id;
          const apodoServidor = APODOS[s.servidor_inscripcion_id] || servidores[s.servidor_inscripcion_id] || '—';

          return (
            <div key={s.id} style={{ background: '#fff', borderRadius: 14, border: `0.5px solid ${completo ? '#bbf7d0' : '#e8eaf0'}`, overflow: 'hidden' }}>
              <button onClick={() => setExpandido(abierto ? null : s.id)} style={{
                width: '100%', padding: '12px 16px', display: 'flex', alignItems: 'center',
                justifyContent: 'space-between', background: 'none', border: 'none', cursor: 'pointer', textAlign: 'left',
              }}>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 4, flexWrap: 'wrap' }}>
                    <p style={{ fontSize: 14, fontWeight: 600, color: '#111827', margin: 0 }}>{s.caminante_nombre}</p>
                    {s.es_sorpresa && (
                      <span style={{ fontSize: 10, fontWeight: 600, background: '#fef3c7', color: '#92400e', padding: '2px 7px', borderRadius: 10 }}>SORPRESA</span>
                    )}
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
                    <span style={{ fontSize: 11, color: '#6b7280' }}>{apodoServidor}</span>
                    <span style={{ color: '#d1d5db', fontSize: 10 }}>·</span>
                    {[
                      { label: 'Llamó', val: s.llamo },
                      { label: 'Cartas', val: s.envio_cartas },
                      { label: 'Fotos', val: s.envio_fotos },
                    ].map(item => (
                      <span key={item.label} style={{
                        fontSize: 11, padding: '1px 7px', borderRadius: 10, fontWeight: 500,
                        background: item.val ? '#dcfce7' : '#f3f4f6',
                        color: item.val ? '#15803d' : '#9ca3af',
                      }}>{item.label}</span>
                    ))}
                  </div>
                </div>
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#9ca3af" strokeWidth="2" strokeLinecap="round" style={{ transform: abierto ? 'rotate(180deg)' : 'none', transition: 'transform 0.2s', flexShrink: 0, marginLeft: 8 }}>
                  <polyline points="6 9 12 15 18 9"/>
                </svg>
              </button>

              {abierto && (
                <div style={{ borderTop: '0.5px solid #f3f4f6', padding: '14px 16px' }}>
                  <div style={{ marginBottom: 14 }}>
                    <p style={{ fontSize: 11, fontWeight: 600, color: '#6b7280', letterSpacing: 1, margin: '0 0 8px', textTransform: 'uppercase' }}>Servidor asignado</p>
                    {reasignando === s.id ? (
                      <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                        <select
                          defaultValue={s.servidor_inscripcion_id}
                          onChange={e => reasignarServidor(s.id, e.target.value, s.caminante_nombre)}
                          disabled={guardandoReasignacion === s.id}
                          style={{ padding: '8px 10px', borderRadius: 8, border: '0.5px solid #e5e7eb', fontSize: 13, color: '#111827', background: '#f9fafb' }}
                        >
                          {SERVIDORES_PALANCAS_IDS.filter(id => id !== '56bf1b6c-965c-4b55-937b-d6df8bb05cd8').map(id => (
                            <option key={id} value={id}>{APODOS[id] || id}</option>
                          ))}
                        </select>
                        <button onClick={() => setReasignando(null)} style={{ fontSize: 12, color: '#6b7280', background: 'none', border: 'none', cursor: 'pointer', textAlign: 'left' }}>Cancelar</button>
                      </div>
                    ) : (
                      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                        <p style={{ fontSize: 14, color: '#111827', margin: 0, fontWeight: 500 }}>{apodoServidor}</p>
                        <button onClick={() => setReasignando(s.id)} style={{
                          fontSize: 12, color: '#0f1787', background: '#eef0ff', border: '0.5px solid #c7d0ff',
                          padding: '5px 12px', borderRadius: 8, cursor: 'pointer', fontWeight: 500,
                        }}>Reasignar</button>
                      </div>
                    )}
                  </div>

                  <p style={{ fontSize: 11, fontWeight: 600, color: '#6b7280', letterSpacing: 1, margin: '0 0 8px', textTransform: 'uppercase' }}>Estado</p>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 6, marginBottom: 12 }}>
                    {[
                      { label: 'Llamó al contacto', val: s.llamo },
                      { label: 'Contestaron', val: s.contesto },
                      { label: 'Envió cartas', val: s.envio_cartas },
                      { label: 'Envió fotos perdón', val: s.envio_fotos },
                    ].map(item => (
                      <div key={item.label} style={{
                        display: 'flex', alignItems: 'center', gap: 6, padding: '7px 10px', borderRadius: 8,
                        background: item.val ? '#f0fdf4' : '#f9fafb',
                        border: `0.5px solid ${item.val ? '#bbf7d0' : '#e5e7eb'}`,
                      }}>
                        <div style={{ width: 14, height: 14, borderRadius: 3, flexShrink: 0, background: item.val ? '#16a34a' : '#e5e7eb', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                          {item.val && <svg width="9" height="9" viewBox="0 0 12 12" fill="none"><polyline points="2 6 5 9 10 3" stroke="white" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/></svg>}
                        </div>
                        <span style={{ fontSize: 11, color: item.val ? '#15803d' : '#9ca3af', fontWeight: item.val ? 500 : 400 }}>{item.label}</span>
                      </div>
                    ))}
                  </div>

                  {(s.donde_palancas || s.notas || s.conoce_alguien) && (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                      {[
                        { label: 'Dónde dejaron las palancas', val: s.donde_palancas },
                        { label: 'Algo importante', val: s.notas },
                        { label: 'Conoce a alguien del retiro', val: s.conoce_alguien },
                      ].filter(n => n.val).map(n => (
                        <div key={n.label} style={{ background: '#fafafa', border: '0.5px solid #f0f0f0', borderRadius: 8, padding: '8px 10px' }}>
                          <p style={{ fontSize: 11, color: '#9ca3af', margin: '0 0 2px' }}>{n.label}</p>
                          <p style={{ fontSize: 13, color: '#374151', margin: 0 }}>{n.val}</p>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}
            </div>
          );
        })}

        {filtrados.length === 0 && (
          <div style={{ textAlign: 'center', padding: '40px 20px' }}>
            <p style={{ color: '#6b7280', fontSize: 14 }}>No hay caminantes con ese filtro.</p>
          </div>
        )}
      </div>
    </div>
  );
}
