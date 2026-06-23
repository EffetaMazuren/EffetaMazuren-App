'use client';
import { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase';

interface Caminante {
  id: string;
  caminante_nombre: string;
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

interface ContactoInfo {
  nombre: string;
  parentesco: string;
  celular: string;
}

interface CaminanteConContactos extends Caminante {
  contacto1: ContactoInfo | null;
  contacto2: ContactoInfo | null;
}

const RETIRO_ID = '21da7588-f7d9-4bf8-a6f6-ae6c8258c00e';
const APPS_SCRIPT_URL = process.env.NEXT_PUBLIC_APPS_SCRIPT_PALANCAS_URL || '';

export default function PalancasServidorPage() {
  const [caminantes, setCaminantes] = useState<CaminanteConContactos[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [servidorId, setServidorId] = useState('');
  const [servidorNombre, setServidorNombre] = useState('');
  const [expandido, setExpandido] = useState<string | null>(null);
  const [guardando, setGuardando] = useState<string | null>(null);
  const [filtro, setFiltro] = useState<'todos' | 'pendientes'>('todos');

  useEffect(() => { cargarDatos(); }, []);

  async function cargarDatos() {
    setLoading(true);
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) { setError('No autenticado'); setLoading(false); return; }

    const { data: srv } = await supabase
      .from('servidores_inscripcion')
      .select('id, nombre, grupo')
      .eq('usuario_id', user.id)
      .eq('retiro_id', RETIRO_ID)
      .single();

    if (!srv || srv.grupo !== 'palancas') {
      setError('No tienes acceso a esta sección.');
      setLoading(false);
      return;
    }

    setServidorId(srv.id);
    setServidorNombre(srv.nombre);

    const { data: seguimiento } = await supabase
      .from('palancas_seguimiento')
      .select('*')
      .eq('servidor_inscripcion_id', srv.id)
      .eq('retiro_id', RETIRO_ID)
      .order('caminante_nombre');

    if (!seguimiento) { setLoading(false); return; }

    const nombresSet = seguimiento.map(c => c.caminante_nombre);

    const { data: todosContactos } = await supabase
      .from('contactos_emergencia')
      .select('persona_id, nombre, parentesco, celular, orden')
      .eq('tipo_persona', 'caminante')
      .order('orden');

    const { data: todosCaminantes } = await supabase
      .from('caminantes')
      .select('id, nombre')
      .in('nombre', nombresSet);

    const nombreAId: Record<string, string> = {};
    (todosCaminantes || []).forEach(c => { nombreAId[c.nombre.trim().toLowerCase()] = c.id; });

    const contactosPorId: Record<string, { c1: ContactoInfo | null; c2: ContactoInfo | null }> = {};
    (todosContactos || []).forEach(c => {
      if (!contactosPorId[c.persona_id]) contactosPorId[c.persona_id] = { c1: null, c2: null };
      if (c.orden === 1) contactosPorId[c.persona_id].c1 = { nombre: c.nombre, parentesco: c.parentesco, celular: c.celular };
      if (c.orden === 2) contactosPorId[c.persona_id].c2 = { nombre: c.nombre, parentesco: c.parentesco, celular: c.celular };
    });

    const enriquecidos: CaminanteConContactos[] = seguimiento.map(c => {
      const caminanteId = nombreAId[c.caminante_nombre.trim().toLowerCase()] || '';
      const contactos = contactosPorId[caminanteId] || { c1: null, c2: null };
      return { ...c, contacto1: contactos.c1, contacto2: contactos.c2 };
    });

    setCaminantes(enriquecidos);
    setLoading(false);
  }

  async function guardarCambios(caminante: CaminanteConContactos) {
    setGuardando(caminante.id);

    const { error: dbError } = await supabase
      .from('palancas_seguimiento')
      .update({
        es_sorpresa: caminante.es_sorpresa,
        llamo: caminante.llamo,
        contesto: caminante.contesto,
        envio_cartas: caminante.envio_cartas,
        envio_fotos: caminante.envio_fotos,
        donde_palancas: caminante.donde_palancas,
        notas: caminante.notas,
        conoce_alguien: caminante.conoce_alguien,
      })
      .eq('id', caminante.id);

    if (!dbError && APPS_SCRIPT_URL) {
      try {
        await fetch(APPS_SCRIPT_URL, {
          method: 'POST',
          body: JSON.stringify({
            type: 'sync_palanca',
            caminante_nombre: caminante.caminante_nombre,
            servidor_nombre: servidorNombre,
            servidor_inscripcion_id: servidorId,
            es_sorpresa: caminante.es_sorpresa,
            llamo: caminante.llamo,
            envio_cartas: caminante.envio_cartas,
            envio_fotos: caminante.envio_fotos,
            donde_palancas: caminante.donde_palancas || '',
            notas: caminante.notas || '',
            conoce_alguien: caminante.conoce_alguien || '',
          }),
        });
      } catch (_) {}
    }

    setGuardando(null);
  }

  function actualizarCampo(id: string, campo: keyof Caminante, valor: boolean | string) {
    setCaminantes(prev => prev.map(c => c.id === id ? { ...c, [campo]: valor } : c));
  }

  const caminantesFiltrados = filtro === 'pendientes'
    ? caminantes.filter(c => !c.llamo || !c.envio_cartas || !c.envio_fotos)
    : caminantes;

  const totalPendientes = caminantes.filter(c => !c.llamo || !c.envio_cartas || !c.envio_fotos).length;

  if (loading) return (
    <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: '60vh' }}>
      <p style={{ color: '#6b7280', fontSize: 14 }}>Cargando...</p>
    </div>
  );

  if (error) return (
    <div style={{ padding: 24 }}>
      <p style={{ color: '#dc2626', fontSize: 14 }}>{error}</p>
    </div>
  );

  return (
    <div style={{ background: '#f7f8fc', minHeight: '100vh', paddingBottom: 100 }}>
      <div style={{ background: '#0f1787', padding: '20px 20px 16px' }}>
        <p style={{ color: 'rgba(255,255,255,0.6)', fontSize: 12, margin: '0 0 2px', letterSpacing: 1 }}>GRUPO PALANCAS</p>
        <h1 style={{ color: '#fff', fontSize: 20, fontWeight: 600, margin: '0 0 4px', fontFamily: 'Georgia, serif' }}>Mis Caminantes</h1>
        <p style={{ color: 'rgba(255,255,255,0.7)', fontSize: 13, margin: 0 }}>{caminantes.length} asignados · {totalPendientes} con pendientes</p>
      </div>

      <div style={{ display: 'flex', gap: 8, padding: '16px 16px 0' }}>
        {(['todos', 'pendientes'] as const).map(f => (
          <button key={f} onClick={() => setFiltro(f)} style={{
            padding: '6px 16px', borderRadius: 20, fontSize: 13, fontWeight: 500, cursor: 'pointer', border: '0.5px solid',
            background: filtro === f ? '#0f1787' : '#fff',
            color: filtro === f ? '#fff' : '#374151',
            borderColor: filtro === f ? '#0f1787' : '#e8eaf0',
          }}>
            {f === 'todos' ? `Todos (${caminantes.length})` : `Pendientes (${totalPendientes})`}
          </button>
        ))}
      </div>

      <div style={{ padding: 16, display: 'flex', flexDirection: 'column', gap: 12 }}>
        {caminantesFiltrados.map(c => {
          const abierto = expandido === c.id;
          const completo = c.llamo && c.envio_cartas && c.envio_fotos;
          return (
            <div key={c.id} style={{ background: '#fff', borderRadius: 16, border: `0.5px solid ${completo ? '#bbf7d0' : '#e8eaf0'}`, overflow: 'hidden' }}>
              <button onClick={() => setExpandido(abierto ? null : c.id)} style={{
                width: '100%', padding: '14px 16px', display: 'flex', alignItems: 'center',
                justifyContent: 'space-between', background: 'none', border: 'none', cursor: 'pointer', textAlign: 'left',
              }}>
                <div style={{ flex: 1 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
                    <p style={{ fontSize: 15, fontWeight: 600, color: '#111827', margin: 0 }}>{c.caminante_nombre}</p>
                    {c.es_sorpresa && (
                      <span style={{ fontSize: 10, fontWeight: 600, background: '#fef3c7', color: '#92400e', padding: '2px 8px', borderRadius: 10 }}>SORPRESA</span>
                    )}
                  </div>
                  <div style={{ display: 'flex', gap: 6 }}>
                    {[
                      { label: 'Llamó', val: c.llamo },
                      { label: 'Cartas', val: c.envio_cartas },
                      { label: 'Fotos', val: c.envio_fotos },
                    ].map(item => (
                      <span key={item.label} style={{
                        fontSize: 11, padding: '2px 8px', borderRadius: 10, fontWeight: 500,
                        background: item.val ? '#dcfce7' : '#f3f4f6',
                        color: item.val ? '#15803d' : '#9ca3af',
                      }}>{item.label}</span>
                    ))}
                  </div>
                </div>
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#9ca3af" strokeWidth="2" strokeLinecap="round" style={{ transform: abierto ? 'rotate(180deg)' : 'none', transition: 'transform 0.2s', flexShrink: 0 }}>
                  <polyline points="6 9 12 15 18 9"/>
                </svg>
              </button>

              {abierto && (
                <div style={{ borderTop: '0.5px solid #e8eaf0', padding: 16 }}>
                  {(c.contacto1 || c.contacto2) && (
                    <div style={{ marginBottom: 16 }}>
                      <p style={{ fontSize: 11, fontWeight: 600, color: '#6b7280', letterSpacing: 1, margin: '0 0 8px', textTransform: 'uppercase' }}>Contactos</p>
                      {[c.contacto1, c.contacto2].filter(Boolean).map((ct, i) => ct && (
                        <div key={i} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '8px 0', borderBottom: i === 0 && c.contacto2 ? '0.5px solid #f3f4f6' : 'none' }}>
                          <div>
                            <p style={{ fontSize: 13, fontWeight: 500, color: '#111827', margin: '0 0 1px' }}>{ct.nombre}</p>
                            <p style={{ fontSize: 12, color: '#6b7280', margin: 0 }}>{ct.parentesco}</p>
                          </div>
                          <button onClick={() => window.open(`tel:${ct.celular}`, '_self')} style={{
                            display: 'flex', alignItems: 'center', gap: 6, padding: '6px 12px', borderRadius: 8,
                            background: '#f0fdf4', border: '0.5px solid #bbf7d0', color: '#15803d', fontSize: 13, fontWeight: 500, cursor: 'pointer',
                          }}>
                            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M22 16.92v3a2 2 0 01-2.18 2 19.79 19.79 0 01-8.63-3.07A19.5 19.5 0 013.07 9.81a19.79 19.79 0 01-3.07-8.67A2 2 0 012 1h3a2 2 0 012 1.72c.127.96.361 1.903.7 2.81a2 2 0 01-.45 2.11L6.91 8.91a16 16 0 006.18 6.18l1.27-1.27a2 2 0 012.11-.45c.907.339 1.85.573 2.81.7A2 2 0 0122 16.92z"/></svg>
                            {ct.celular}
                          </button>
                        </div>
                      ))}
                    </div>
                  )}

                  <p style={{ fontSize: 11, fontWeight: 600, color: '#6b7280', letterSpacing: 1, margin: '0 0 10px', textTransform: 'uppercase' }}>Seguimiento</p>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, marginBottom: 12 }}>
                    {[
                      { campo: 'llamo' as const, label: '¿Ya llamó al contacto?' },
                      { campo: 'contesto' as const, label: '¿Contestaron?' },
                      { campo: 'envio_cartas' as const, label: '¿Envió cartas?' },
                      { campo: 'envio_fotos' as const, label: '¿Envió fotos perdón?' },
                    ].map(item => (
                      <button key={item.campo} onClick={() => actualizarCampo(c.id, item.campo, !c[item.campo])} style={{
                        padding: '10px 12px', borderRadius: 10, border: '0.5px solid', cursor: 'pointer', textAlign: 'left',
                        background: c[item.campo] ? '#f0fdf4' : '#f9fafb',
                        borderColor: c[item.campo] ? '#bbf7d0' : '#e5e7eb',
                      }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                          <div style={{
                            width: 16, height: 16, borderRadius: 4, border: `1.5px solid ${c[item.campo] ? '#16a34a' : '#d1d5db'}`,
                            background: c[item.campo] ? '#16a34a' : 'transparent', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
                          }}>
                            {c[item.campo] && <svg width="10" height="10" viewBox="0 0 12 12" fill="none"><polyline points="2 6 5 9 10 3" stroke="white" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/></svg>}
                          </div>
                          <span style={{ fontSize: 12, color: c[item.campo] ? '#15803d' : '#6b7280', fontWeight: c[item.campo] ? 500 : 400 }}>{item.label}</span>
                        </div>
                      </button>
                    ))}
                  </div>

                  {[
                    { campo: 'donde_palancas' as const, label: '¿Dónde dejaron las palancas?', placeholder: 'Ej: Casa de la familia, correo...' },
                    { campo: 'notas' as const, label: 'Algo importante que debamos saber', placeholder: 'Notas relevantes...' },
                    { campo: 'conoce_alguien' as const, label: '¿Conoce a alguien del retiro?', placeholder: '¿A quién?' },
                  ].map(item => (
                    <div key={item.campo} style={{ marginBottom: 10 }}>
                      <p style={{ fontSize: 12, color: '#6b7280', margin: '0 0 4px' }}>{item.label}</p>
                      <textarea
                        value={c[item.campo] || ''}
                        onChange={e => actualizarCampo(c.id, item.campo, e.target.value)}
                        placeholder={item.placeholder}
                        rows={2}
                        style={{
                          width: '100%', padding: '8px 10px', borderRadius: 8, border: '0.5px solid #e5e7eb',
                          fontSize: 13, color: '#111827', background: '#f9fafb', resize: 'vertical',
                          fontFamily: 'inherit', boxSizing: 'border-box',
                        }}
                      />
                    </div>
                  ))}

                  <button
                    onClick={() => guardarCambios(c)}
                    disabled={guardando === c.id}
                    style={{
                      width: '100%', padding: '12px', borderRadius: 10, border: 'none', cursor: 'pointer',
                      background: guardando === c.id ? '#e5e7eb' : '#0f1787',
                      color: guardando === c.id ? '#9ca3af' : '#fff',
                      fontSize: 14, fontWeight: 600, marginTop: 4,
                    }}
                  >
                    {guardando === c.id ? 'Guardando...' : 'Guardar cambios'}
                  </button>
                </div>
              )}
            </div>
          );
        })}

        {caminantesFiltrados.length === 0 && (
          <div style={{ textAlign: 'center', padding: '40px 20px' }}>
            <p style={{ color: '#6b7280', fontSize: 14 }}>
              {filtro === 'pendientes' ? '¡Todo al día! No tienes pendientes.' : 'No tienes caminantes asignados.'}
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
