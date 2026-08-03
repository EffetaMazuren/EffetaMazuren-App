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
  servidor_inscripcion_id: string;
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
const APPS_SCRIPT_URL = 'https://script.google.com/macros/s/AKfycbz_QYfs6yiwRH1aQRt2smJoQIgRQ-bzFzWK3fgDFrbD6ApiaUygGIEYJUVcxp7Mf00oOw/exec';

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

const PALANCAS_NOMBRE_A_ID: Record<string, string> = {
  'alejandra arcila cantor':          '87a34a20-e973-4b76-92a0-4817f01e6778',
  'david martinez rincon':            'fc5f960c-70cc-4c85-be11-14484abb70ff',
  'andres muñoz':                     'ebc59dbf-b3e1-4d5d-8c89-d8facf50680d',
  'andrés muñoz':                     'ebc59dbf-b3e1-4d5d-8c89-d8facf50680d',
  'maria paula rodriguez zuñiga':     'b201c88d-d651-4889-abac-c74ac8a2ffda',
  'maría paula rodríguez zúñiga':     'b201c88d-d651-4889-abac-c74ac8a2ffda',
  'santiago ruiz cardozo':            '2852cef9-b8df-4ac1-9f21-e0c6226c63a2',
  'paula agudelo':                    'c3ece132-f88e-4432-b6dd-5c6b879a1860',
  'maria paula diaz wittingham':      'f22ec19a-079b-46cb-bbac-3f75804d008a',
  'maría paula díaz wittingham':      'f22ec19a-079b-46cb-bbac-3f75804d008a',
  'lucia cuellar':                    '1b4de35a-1165-4364-a0f5-31d5938dabbd',
  'lucía cuéllar':                    '1b4de35a-1165-4364-a0f5-31d5938dabbd',
  'diego urrego fonseca':             '56bf1b6c-965c-4b55-937b-d6df8bb05cd8',
};

function norm(s: string) {
  return s.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').trim();
}

export default function PalancasServidorPage() {
  const [modo, setModo] = useState<'cargando' | 'servidor' | 'lider' | 'error'>('cargando');
  const [error, setError] = useState('');

  // Estado servidor
  const [caminantes, setCaminantes] = useState<CaminanteConContactos[]>([]);
  const [servidorId, setServidorId] = useState('');
  const [servidorNombre, setServidorNombre] = useState('');
  const [expandido, setExpandido] = useState<string | null>(null);
  const [guardando, setGuardando] = useState<string | null>(null);
  const [filtro, setFiltro] = useState<'todos' | 'pendientes'>('todos');

  // Estado líder
  const [seguimientoLider, setSeguimientoLider] = useState<Caminante[]>([]);
  const [filtroServidor, setFiltroServidor] = useState('todos');
  const [filtroEstado, setFiltroEstado] = useState('todos');
  const [busqueda, setBusqueda] = useState('');
  const [expandidoLider, setExpandidoLider] = useState<string | null>(null);
  const [reasignando, setReasignando] = useState<string | null>(null);
  const [guardandoReasig, setGuardandoReasig] = useState<string | null>(null);

  useEffect(() => { cargarDatos(); }, []);

  async function cargarDatos() {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) { setError('No autenticado'); setModo('error'); return; }

    // Buscar inscripción
    let srv: { id: string; nombre: string; grupo: string | null; palancas_lider: boolean } | null = null;
    const { data: srvPorId } = await supabase
      .from('servidores_inscripcion')
      .select('id, nombre, grupo, palancas_lider')
      .eq('usuario_id', user.id)
      .eq('retiro_id', RETIRO_ID)
      .single();

    if (srvPorId) {
      srv = srvPorId;
    } else {
      const inscripcionId = user.user_metadata?.servidor_inscripcion_id;
      if (inscripcionId) {
        const { data: srvPorMeta } = await supabase
          .from('servidores_inscripcion')
          .select('id, nombre, grupo, palancas_lider')
          .eq('id', inscripcionId)
          .single();
        if (srvPorMeta) srv = srvPorMeta;
      }
    }

    if (!srv) { setError('No tienes acceso a esta sección.'); setModo('error'); return; }

    // Si es líder de palancas → vista líder
    if (srv.palancas_lider) {
      await cargarDatosLider();
      setModo('lider');
      return;
    }

    // Verificar si es del grupo palancas
    if (srv.grupo !== 'palancas') {
      const srvIdPorNombre = PALANCAS_NOMBRE_A_ID[norm(srv.nombre)];
      if (!srvIdPorNombre) {
        setError('No tienes acceso a esta sección.');
        setModo('error');
        return;
      }
      await supabase
        .from('servidores_inscripcion')
        .update({ grupo: 'palancas', usuario_id: user.id })
        .eq('id', srvIdPorNombre)
        .is('usuario_id', null);
      srv = { ...srv, id: srvIdPorNombre, grupo: 'palancas' };
    }

    setServidorId(srv.id);
    setServidorNombre(srv.nombre);
    await cargarCaminantesServidor(srv.id, srv.nombre);
    setModo('servidor');
  }

  async function cargarCaminantesServidor(srvId: string, srvNombre: string) {
    const { data: seguimiento } = await supabase
      .from('palancas_seguimiento')
      .select('*')
      .eq('servidor_inscripcion_id', srvId)
      .eq('retiro_id', RETIRO_ID)
      .order('caminante_nombre');

    if (!seguimiento) return;

    const nombresSet = seguimiento.map((c: any) => c.caminante_nombre);
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
    (todosCaminantes || []).forEach((c: any) => { nombreAId[c.nombre.trim().toLowerCase()] = c.id; });

    const contactosPorId: Record<string, { c1: ContactoInfo | null; c2: ContactoInfo | null }> = {};
    (todosContactos || []).forEach((c: any) => {
      if (!contactosPorId[c.persona_id]) contactosPorId[c.persona_id] = { c1: null, c2: null };
      if (c.orden === 1) contactosPorId[c.persona_id].c1 = { nombre: c.nombre, parentesco: c.parentesco, celular: c.celular };
      if (c.orden === 2) contactosPorId[c.persona_id].c2 = { nombre: c.nombre, parentesco: c.parentesco, celular: c.celular };
    });

    const enriquecidos: CaminanteConContactos[] = seguimiento.map((c: any) => {
      const caminanteId = nombreAId[c.caminante_nombre.trim().toLowerCase()] || '';
      const contactos = contactosPorId[caminanteId] || { c1: null, c2: null };
      return { ...c, contacto1: contactos.c1, contacto2: contactos.c2 };
    });

    setCaminantes(enriquecidos);
  }

  async function cargarDatosLider() {
    const { data } = await supabase
      .from('palancas_seguimiento')
      .select('*')
      .eq('retiro_id', RETIRO_ID)
      .order('caminante_nombre');
    setSeguimientoLider(data || []);
  }

  async function guardarCambios(caminanteId: string) {
    const caminante = caminantes.find(c => c.id === caminanteId);
    if (!caminante) return;
    setGuardando(caminanteId);

    await supabase.from('palancas_seguimiento').update({
      es_sorpresa: caminante.es_sorpresa,
      llamo: caminante.llamo,
      contesto: caminante.contesto,
      envio_cartas: caminante.envio_cartas,
      envio_fotos: caminante.envio_fotos,
      donde_palancas: caminante.donde_palancas,
      notas: caminante.notas,
      conoce_alguien: caminante.conoce_alguien,
    }).eq('id', caminante.id);

    try {
      await fetch('/api/sync-palanca', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
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
    } catch (e) { console.error('Error sync:', e); }

    setGuardando(null);
  }

  async function reasignarServidor(seguimientoId: string, nuevoServidorId: string, caminanteNombre: string) {
    setGuardandoReasig(seguimientoId);
    await supabase.from('palancas_seguimiento').update({ servidor_inscripcion_id: nuevoServidorId }).eq('id', seguimientoId);
    try {
      const actual = seguimientoLider.find(s => s.id === seguimientoId);
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
    setSeguimientoLider(prev => prev.map(s => s.id === seguimientoId ? { ...s, servidor_inscripcion_id: nuevoServidorId } : s));
    setReasignando(null);
    setGuardandoReasig(null);
  }

  function actualizarCampo(id: string, campo: keyof Caminante, valor: boolean | string) {
    setCaminantes(prev => prev.map(c => c.id === id ? { ...c, [campo]: valor } : c));
  }

  // ── LOADING ──
  if (modo === 'cargando') return (
    <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: '60vh' }}>
      <p style={{ color: '#6b7280', fontSize: 14 }}>Cargando...</p>
    </div>
  );

  // ── ERROR ──
  if (modo === 'error') return (
    <div style={{ padding: 24 }}>
      <p style={{ color: '#dc2626', fontSize: 14 }}>{error}</p>
    </div>
  );

  // ── VISTA LÍDER ──
  if (modo === 'lider') {
    const total = seguimientoLider.length;
    const llamaron = seguimientoLider.filter(s => s.llamo).length;
    const enviaron_cartas = seguimientoLider.filter(s => s.envio_cartas).length;
    const enviaron_fotos = seguimientoLider.filter(s => s.envio_fotos).length;
    const sorpresas = seguimientoLider.filter(s => s.es_sorpresa).length;
    const completos = seguimientoLider.filter(s => s.llamo && s.envio_cartas && s.envio_fotos).length;
    const servidoresUnicos = [...new Set(seguimientoLider.map(s => s.servidor_inscripcion_id))];

    const filtrados = seguimientoLider.filter(s => {
      const pasaServidor = filtroServidor === 'todos' || s.servidor_inscripcion_id === filtroServidor;
      const pasaEstado = filtroEstado === 'todos'
        || (filtroEstado === 'completos' && s.llamo && s.envio_cartas && s.envio_fotos)
        || (filtroEstado === 'pendientes' && (!s.llamo || !s.envio_cartas || !s.envio_fotos))
        || (filtroEstado === 'sorpresas' && s.es_sorpresa)
        || (filtroEstado === 'sin_llamar' && !s.llamo);
      const pasaBusqueda = busqueda === '' || s.caminante_nombre.toLowerCase().includes(busqueda.toLowerCase()) || (APODOS[s.servidor_inscripcion_id] || '').toLowerCase().includes(busqueda.toLowerCase());
      return pasaServidor && pasaEstado && pasaBusqueda;
    });

    return (
      <div style={{ background: '#f7f8fc', minHeight: '100vh', paddingBottom: 40 }}>
        <div style={{ background: '#0f1787', padding: '28px 24px 24px' }}>
          <p style={{ color: 'rgba(255,255,255,0.6)', fontSize: 12, margin: '0 0 4px', letterSpacing: 1 }}>LÍDER PALANCAS</p>
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
          <div style={{ position: 'relative' }}>
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="#9ca3af" strokeWidth="2" strokeLinecap="round" style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)' }}>
              <circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/>
            </svg>
            <input value={busqueda} onChange={e => setBusqueda(e.target.value)} placeholder="Buscar caminante o servidor..."
              style={{ width: '100%', padding: '10px 12px 10px 36px', borderRadius: 10, border: '0.5px solid #e8eaf0', fontSize: 13, color: '#111827', background: '#fff', boxSizing: 'border-box' as const, outline: 'none' }} />
            {busqueda && <button onClick={() => setBusqueda('')} style={{ position: 'absolute', right: 10, top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', cursor: 'pointer', color: '#9ca3af', fontSize: 16 }}>×</button>}
          </div>

          <div style={{ overflowX: 'auto', paddingBottom: 4 }}>
            <div style={{ display: 'flex', gap: 6, width: 'max-content' }}>
              <button onClick={() => setFiltroServidor('todos')} style={{ padding: '6px 14px', borderRadius: 20, fontSize: 12, fontWeight: 500, cursor: 'pointer', border: '0.5px solid', whiteSpace: 'nowrap' as const, background: filtroServidor === 'todos' ? '#0f1787' : '#fff', color: filtroServidor === 'todos' ? '#fff' : '#374151', borderColor: filtroServidor === 'todos' ? '#0f1787' : '#e8eaf0' }}>Todos</button>
              {servidoresUnicos.map(id => (
                <button key={id} onClick={() => setFiltroServidor(id)} style={{ padding: '6px 14px', borderRadius: 20, fontSize: 12, fontWeight: 500, cursor: 'pointer', border: '0.5px solid', whiteSpace: 'nowrap' as const, background: filtroServidor === id ? '#0f1787' : '#fff', color: filtroServidor === id ? '#fff' : '#374151', borderColor: filtroServidor === id ? '#0f1787' : '#e8eaf0' }}>{APODOS[id] || id}</button>
              ))}
            </div>
          </div>

          <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' as const }}>
            {[
              { val: 'todos', label: 'Todos' },
              { val: 'pendientes', label: 'Con pendientes' },
              { val: 'sin_llamar', label: 'Sin llamar' },
              { val: 'sorpresas', label: 'Sorpresas' },
              { val: 'completos', label: 'Completos' },
            ].map(f => (
              <button key={f.val} onClick={() => setFiltroEstado(f.val)} style={{ padding: '5px 12px', borderRadius: 20, fontSize: 12, fontWeight: 500, cursor: 'pointer', border: '0.5px solid', background: filtroEstado === f.val ? '#111827' : '#fff', color: filtroEstado === f.val ? '#fff' : '#374151', borderColor: filtroEstado === f.val ? '#111827' : '#e8eaf0' }}>{f.label}</button>
            ))}
          </div>
        </div>

        <div style={{ padding: '10px 16px 0' }}>
          <p style={{ fontSize: 12, color: '#6b7280', margin: 0 }}>Mostrando {filtrados.length} de {total} caminantes</p>
        </div>

        <div style={{ padding: 16, display: 'flex', flexDirection: 'column', gap: 10 }}>
          {filtrados.map(s => {
            const completo = s.llamo && s.envio_cartas && s.envio_fotos;
            const abierto = expandidoLider === s.id;
            const apodoServidor = APODOS[s.servidor_inscripcion_id] || '—';
            return (
              <div key={s.id} style={{ background: '#fff', borderRadius: 14, border: `0.5px solid ${completo ? '#bbf7d0' : '#e8eaf0'}`, overflow: 'hidden' }}>
                <button onClick={() => setExpandidoLider(abierto ? null : s.id)} style={{ width: '100%', padding: '12px 16px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', background: 'none', border: 'none', cursor: 'pointer', textAlign: 'left' as const }}>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 4, flexWrap: 'wrap' as const }}>
                      <p style={{ fontSize: 14, fontWeight: 600, color: '#111827', margin: 0 }}>{s.caminante_nombre}</p>
                      {s.es_sorpresa && <span style={{ fontSize: 10, fontWeight: 600, background: '#fef3c7', color: '#92400e', padding: '2px 7px', borderRadius: 10 }}>SORPRESA</span>}
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' as const }}>
                      <span style={{ fontSize: 11, color: '#6b7280' }}>{apodoServidor}</span>
                      <span style={{ color: '#d1d5db', fontSize: 10 }}>·</span>
                      {[{ label: 'Llamó', val: s.llamo }, { label: 'Cartas', val: s.envio_cartas }, { label: 'Fotos', val: s.envio_fotos }].map(item => (
                        <span key={item.label} style={{ fontSize: 11, padding: '1px 7px', borderRadius: 10, fontWeight: 500, background: item.val ? '#dcfce7' : '#f3f4f6', color: item.val ? '#15803d' : '#9ca3af' }}>{item.label}</span>
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
                      <p style={{ fontSize: 11, fontWeight: 600, color: '#6b7280', letterSpacing: 1, margin: '0 0 8px', textTransform: 'uppercase' as const }}>Servidor asignado</p>
                      {reasignando === s.id ? (
                        <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                          <select defaultValue={s.servidor_inscripcion_id} onChange={e => reasignarServidor(s.id, e.target.value, s.caminante_nombre)} disabled={guardandoReasig === s.id}
                            style={{ padding: '8px 10px', borderRadius: 8, border: '0.5px solid #e5e7eb', fontSize: 13, color: '#111827', background: '#f9fafb' }}>
                            {SERVIDORES_PALANCAS_IDS.filter(id => id !== '56bf1b6c-965c-4b55-937b-d6df8bb05cd8').map(id => (
                              <option key={id} value={id}>{APODOS[id] || id}</option>
                            ))}
                          </select>
                          <button onClick={() => setReasignando(null)} style={{ fontSize: 12, color: '#6b7280', background: 'none', border: 'none', cursor: 'pointer', textAlign: 'left' as const }}>Cancelar</button>
                        </div>
                      ) : (
                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                          <p style={{ fontSize: 14, color: '#111827', margin: 0, fontWeight: 500 }}>{apodoServidor}</p>
                          <button onClick={() => setReasignando(s.id)} style={{ fontSize: 12, color: '#0f1787', background: '#eef0ff', border: '0.5px solid #c7d0ff', padding: '5px 12px', borderRadius: 8, cursor: 'pointer', fontWeight: 500 }}>Reasignar</button>
                        </div>
                      )}
                    </div>

                    <p style={{ fontSize: 11, fontWeight: 600, color: '#6b7280', letterSpacing: 1, margin: '0 0 8px', textTransform: 'uppercase' as const }}>Estado</p>
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 6, marginBottom: 12 }}>
                      {[
                        { label: 'Llamó al contacto', val: s.llamo },
                        { label: 'Contestaron', val: s.contesto },
                        { label: 'Envió cartas', val: s.envio_cartas },
                        { label: 'Envió fotos perdón', val: s.envio_fotos },
                      ].map(item => (
                        <div key={item.label} style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '7px 10px', borderRadius: 8, background: item.val ? '#f0fdf4' : '#f9fafb', border: `0.5px solid ${item.val ? '#bbf7d0' : '#e5e7eb'}` }}>
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

  // ── VISTA SERVIDOR ──
  const caminantesFiltrados = filtro === 'pendientes'
    ? caminantes.filter(c => !c.llamo || !c.envio_cartas || !c.envio_fotos)
    : caminantes;
  const totalPendientes = caminantes.filter(c => !c.llamo || !c.envio_cartas || !c.envio_fotos).length;

  return (
    <div style={{ background: '#f7f8fc', minHeight: '100vh', paddingBottom: 100 }}>
      <div style={{ background: '#0f1787', padding: '20px 20px 16px' }}>
        <p style={{ color: 'rgba(255,255,255,0.6)', fontSize: 12, margin: '0 0 2px', letterSpacing: 1 }}>GRUPO PALANCAS</p>
        <h1 style={{ color: '#fff', fontSize: 20, fontWeight: 600, margin: '0 0 4px', fontFamily: 'Georgia, serif' }}>Mis Caminantes</h1>
        <p style={{ color: 'rgba(255,255,255,0.7)', fontSize: 13, margin: 0 }}>{caminantes.length} asignados · {totalPendientes} con pendientes</p>
      </div>

      <div style={{ display: 'flex', gap: 8, padding: '16px 16px 0' }}>
        {(['todos', 'pendientes'] as const).map(f => (
          <button key={f} onClick={() => setFiltro(f)} style={{ padding: '6px 16px', borderRadius: 20, fontSize: 13, fontWeight: 500, cursor: 'pointer', border: '0.5px solid', background: filtro === f ? '#0f1787' : '#fff', color: filtro === f ? '#fff' : '#374151', borderColor: filtro === f ? '#0f1787' : '#e8eaf0' }}>
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
              <button onClick={() => setExpandido(abierto ? null : c.id)} style={{ width: '100%', padding: '14px 16px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', background: 'none', border: 'none', cursor: 'pointer', textAlign: 'left' as const }}>
                <div style={{ flex: 1 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
                    <p style={{ fontSize: 15, fontWeight: 600, color: '#111827', margin: 0 }}>{c.caminante_nombre}</p>
                    {c.es_sorpresa && <span style={{ fontSize: 10, fontWeight: 600, background: '#fef3c7', color: '#92400e', padding: '2px 8px', borderRadius: 10 }}>SORPRESA</span>}
                  </div>
                  <div style={{ display: 'flex', gap: 6 }}>
                    {[{ label: 'Llamó', val: c.llamo }, { label: 'Cartas', val: c.envio_cartas }, { label: 'Fotos', val: c.envio_fotos }].map(item => (
                      <span key={item.label} style={{ fontSize: 11, padding: '2px 8px', borderRadius: 10, fontWeight: 500, background: item.val ? '#dcfce7' : '#f3f4f6', color: item.val ? '#15803d' : '#9ca3af' }}>{item.label}</span>
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
                      <p style={{ fontSize: 11, fontWeight: 600, color: '#6b7280', letterSpacing: 1, margin: '0 0 8px', textTransform: 'uppercase' as const }}>Contactos</p>
                      {[c.contacto1, c.contacto2].filter(Boolean).map((ct, i) => ct && (
                        <div key={i} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '8px 0', borderBottom: i === 0 && c.contacto2 ? '0.5px solid #f3f4f6' : 'none' }}>
                          <div>
                            <p style={{ fontSize: 13, fontWeight: 500, color: '#111827', margin: '0 0 1px' }}>{ct.nombre}</p>
                            <p style={{ fontSize: 12, color: '#6b7280', margin: 0 }}>{ct.parentesco}</p>
                          </div>
                          <button onClick={() => window.open(`tel:${ct.celular}`, '_self')} style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '6px 12px', borderRadius: 8, background: '#f0fdf4', border: '0.5px solid #bbf7d0', color: '#15803d', fontSize: 13, fontWeight: 500, cursor: 'pointer' }}>
                            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M22 16.92v3a2 2 0 01-2.18 2 19.79 19.79 0 01-8.63-3.07A19.5 19.5 0 013.07 9.81a19.79 19.79 0 01-3.07-8.67A2 2 0 012 1h3a2 2 0 012 1.72c.127.96.361 1.903.7 2.81a2 2 0 01-.45 2.11L6.91 8.91a16 16 0 006.18 6.18l1.27-1.27a2 2 0 012.11-.45c.907.339 1.85.573 2.81.7A2 2 0 0122 16.92z"/></svg>
                            {ct.celular}
                          </button>
                        </div>
                      ))}
                    </div>
                  )}

                  <p style={{ fontSize: 11, fontWeight: 600, color: '#6b7280', letterSpacing: 1, margin: '0 0 10px', textTransform: 'uppercase' as const }}>Seguimiento</p>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, marginBottom: 12 }}>
                    {[
                      { campo: 'llamo' as const, label: '¿Ya llamó al contacto?' },
                      { campo: 'contesto' as const, label: '¿Contestaron?' },
                      { campo: 'envio_cartas' as const, label: '¿Envió cartas?' },
                      { campo: 'envio_fotos' as const, label: '¿Envió fotos perdón?' },
                    ].map(item => (
                      <button key={item.campo} onClick={() => actualizarCampo(c.id, item.campo, !c[item.campo])} style={{ padding: '10px 12px', borderRadius: 10, border: '0.5px solid', cursor: 'pointer', textAlign: 'left' as const, background: c[item.campo] ? '#f0fdf4' : '#f9fafb', borderColor: c[item.campo] ? '#bbf7d0' : '#e5e7eb' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                          <div style={{ width: 16, height: 16, borderRadius: 4, border: `1.5px solid ${c[item.campo] ? '#16a34a' : '#d1d5db'}`, background: c[item.campo] ? '#16a34a' : 'transparent', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                            {c[item.campo] && <svg width="10" height="10" viewBox="0 0 12 12" fill="none"><polyline points="2 6 5 9 10 3" stroke="white" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/></svg>}
                          </div>
                          <span style={{ fontSize: 12, color: c[item.campo] ? '#15803d' : '#6b7280', fontWeight: c[item.campo] ? 500 : 400 }}>{item.label}</span>
                        </div>
                      </button>
                    ))}
                  </div>

                  <div style={{ marginBottom: 10 }}>
                    <p style={{ fontSize: 12, color: '#6b7280', margin: '0 0 4px' }}>¿Dónde dejaron las palancas?</p>
                    <select value={c.donde_palancas || ''} onChange={e => actualizarCampo(c.id, 'donde_palancas', e.target.value)}
                      style={{ width: '100%', padding: '8px 10px', borderRadius: 8, border: '0.5px solid #e5e7eb', fontSize: 13, color: c.donde_palancas ? '#111827' : '#9ca3af', background: '#f9fafb', boxSizing: 'border-box' as const, outline: 'none' }}>
                      <option value="">Seleccionar...</option>
                      <option value="CASA DANI CUELLAR">Casa Dani Cuéllar</option>
                      <option value="CASA ANTO RIVERA">Casa Anto Rivera</option>
                      <option value="CASA ANDRES MUÑOZ">Casa Andrés Muñoz</option>
                      <option value="CASA SANTI CARDOZO">Casa Santi Cardozo</option>
                      <option value="Correo">Correo</option>
                    </select>
                  </div>

                  {[
                    { campo: 'notas' as const, label: 'Algo importante que debamos saber', placeholder: 'Notas relevantes...' },
                    { campo: 'conoce_alguien' as const, label: '¿Conoce a alguien del retiro?', placeholder: '¿A quién?' },
                  ].map(item => (
                    <div key={item.campo} style={{ marginBottom: 10 }}>
                      <p style={{ fontSize: 12, color: '#6b7280', margin: '0 0 4px' }}>{item.label}</p>
                      <textarea value={c[item.campo] || ''} onChange={e => actualizarCampo(c.id, item.campo, e.target.value)} placeholder={item.placeholder} rows={2}
                        style={{ width: '100%', padding: '8px 10px', borderRadius: 8, border: '0.5px solid #e5e7eb', fontSize: 13, color: '#111827', background: '#f9fafb', resize: 'vertical' as const, fontFamily: 'inherit', boxSizing: 'border-box' as const }} />
                    </div>
                  ))}

                  <button onClick={() => guardarCambios(c.id)} disabled={guardando === c.id}
                    style={{ width: '100%', padding: '12px', borderRadius: 10, border: 'none', cursor: 'pointer', background: guardando === c.id ? '#e5e7eb' : '#0f1787', color: guardando === c.id ? '#9ca3af' : '#fff', fontSize: 14, fontWeight: 600, marginTop: 4 }}>
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
