'use client';

import { useState, useEffect, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabase';

const RETIRO_ID = '21da7588-f7d9-4bf8-a6f6-ae6c8258c00e';

interface Servidor {
  id: string;
  nombre: string;
  rol: string | null;
  correo: string | null;
}

interface Pago {
  valor: number;
}

interface Reunion {
  id: string;
  nombre: string;
  fecha: string;
}

interface Asistencia {
  reunion_id: string;
}

interface Mensaje {
  id: string;
  texto: string;
  autor_nombre: string;
  created_at: string;
  updated_at: string;
  editado: boolean;
  destinatario_id: string | null;
}

function getVersiculoPreview() {
  const VERSICULOS_PREVIEW = [
    { ref: 'Filipenses 4:13', texto: 'Todo lo puedo en Cristo que me fortalece.' },
    { ref: 'Jeremías 29:11', texto: 'Porque yo sé los pensamientos que tengo acerca de vosotros, dice el Señor, pensamientos de paz.' },
    { ref: 'Salmos 46:10', texto: 'Estad quietos, y conoced que yo soy Dios.' },
    { ref: 'Juan 14:27', texto: 'La paz os dejo, mi paz os doy; yo no os la doy como el mundo la da.' },
    { ref: 'Isaías 40:31', texto: 'Pero los que esperan en el Señor renovarán sus fuerzas.' },
    { ref: 'Romanos 8:28', texto: 'Y sabemos que a los que aman a Dios, todas las cosas les ayudan a bien.' },
    { ref: 'Salmos 23:1', texto: 'El Señor es mi pastor; nada me faltará.' },
    { ref: '1 Juan 4:8', texto: 'El que no ama, no ha conocido a Dios; porque Dios es amor.' },
    { ref: 'Mateo 11:28', texto: 'Venid a mí todos los que estáis trabajados y cargados, y yo os haré descansar.' },
    { ref: 'Salmos 27:1', texto: 'El Señor es mi luz y mi salvación; ¿de quién temeré?' },
    { ref: 'Juan 3:16', texto: 'Porque de tal manera amó Dios al mundo, que ha dado a su Hijo unigénito.' },
    { ref: 'Gálatas 5:22', texto: 'Mas el fruto del Espíritu es amor, gozo, paz, paciencia, benignidad, bondad, fe.' },
    { ref: 'Proverbios 3:5', texto: 'Fíate del Señor de todo tu corazón, y no te apoyes en tu propia prudencia.' },
    { ref: 'Salmos 118:24', texto: 'Este es el día que hizo el Señor; nos gozaremos y alegraremos en él.' },
    { ref: 'Marcos 10:45', texto: 'El Hijo del Hombre no vino para ser servido, sino para servir.' },
    { ref: '1 Corintios 13:13', texto: 'Y ahora permanecen la fe, la esperanza y el amor, pero el mayor de ellos es el amor.' },
    { ref: 'Hebreos 12:1', texto: 'Corramos con paciencia la carrera que tenemos por delante.' },
    { ref: 'Josué 1:9', texto: 'Esfuérzate y sé valiente; no temas ni desmayes, porque el Señor tu Dios estará contigo.' },
    { ref: 'Isaías 41:10', texto: 'No temas, porque yo estoy contigo; no desmayes, porque yo soy tu Dios.' },
    { ref: '2 Timoteo 1:7', texto: 'Porque no nos ha dado Dios espíritu de cobardía, sino de poder, de amor y de dominio propio.' },
    { ref: 'Lamentaciones 3:23', texto: 'Nuevas son cada mañana; grande es tu fidelidad.' },
    { ref: 'Juan 15:13', texto: 'Nadie tiene mayor amor que este, que uno ponga su vida por sus amigos.' },
    { ref: 'Miqueas 6:8', texto: 'Solamente hacer justicia, y amar misericordia, y humillarte ante tu Dios.' },
    { ref: 'Sofonías 3:17', texto: 'El Señor está en medio de ti, poderoso, él salvará.' },
  ];
  const periodos = Math.floor(Date.now() / (12 * 60 * 60 * 1000));
  return VERSICULOS_PREVIEW[periodos % VERSICULOS_PREVIEW.length];
}

function norm(s: string) {
  return s.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').trim();
}

export default function ServidorPage() {
  const router = useRouter();
  const [servidor, setServidor] = useState<Servidor | null>(null);
  const [pagos, setPagos] = useState<Pago[]>([]);
  const [proximaReunion, setProximaReunion] = useState<Reunion | null>(null);
  const [asistencias, setAsistencias] = useState<Asistencia[]>([]);
  const [mensajes, setMensajes] = useState<Mensaje[]>([]);
  const [esAngelito, setEsAngelito] = useState(false);
  const [cargando, setCargando] = useState(true);

  const inscripcionIdRef = useRef<string | null>(null);
  const versiculoPreview = getVersiculoPreview();

  useEffect(() => {
    cargarDatos();
  }, []);

  async function cargarDatos() {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) { router.push('/'); return; }

    // 1. Intentar obtener datos de la tabla usuarios
    let servidorData: Servidor | null = null;
    const { data: usuarioData } = await supabase
      .from('usuarios')
      .select('id, nombre, rol, correo')
      .eq('id', user.id)
      .single();

    if (usuarioData) {
      servidorData = usuarioData;
    } else {
      // 2. FALLBACK: buscar directamente en servidores_inscripcion
      //    (ocurre cuando usuario_id quedó NULL y no se creó fila en usuarios)
      const { data: inscFallback } = await supabase
        .from('servidores_inscripcion')
        .select('id, nombre, es_interno')
        .eq('usuario_id', user.id)
        .eq('retiro_id', RETIRO_ID)
        .single();

      if (inscFallback) {
        // Construir objeto servidor desde la inscripción
        servidorData = {
          id: user.id,
          nombre: inscFallback.nombre ?? '',
          rol: null,
          correo: user.email ?? null,
        };

        // Intentar crear la fila faltante en usuarios para que la próxima vez funcione normal
        await supabase.from('usuarios').upsert({
          id: user.id,
          nombre: inscFallback.nombre ?? '',
          correo: user.email ?? null,
          rol: null,
        }, { onConflict: 'id' });

        // También linkear el usuario_id en servidores_inscripcion si faltaba
        // (doble seguro, aunque ya debería estar linkeado si llegamos aquí por usuario_id)
      } else {
        // No hay inscripción — sí mandar a registro
        router.push('/servidor/registro');
        return;
      }
    }

    setServidor(servidorData);

    // Buscar inscripción con es_interno
    const { data: inscripcion } = await supabase
      .from('servidores_inscripcion')
      .select('id, es_interno, nombre')
      .eq('usuario_id', user.id)
      .eq('retiro_id', RETIRO_ID)
      .single();

    if (inscripcion) {
      inscripcionIdRef.current = inscripcion.id;

      const { data: pagosData } = await supabase
        .from('pagos')
        .select('valor')
        .eq('persona_id', inscripcion.id)
        .eq('tipo_persona', 'servidor');
      if (pagosData) setPagos(pagosData);

      const { data: asistenciasData } = await supabase
        .from('asistencias')
        .select('reunion_id')
        .eq('servidor_inscripcion_id', inscripcion.id);
      if (asistenciasData) setAsistencias(asistenciasData);

      // Verificar si es externo sin roles asignados → angelito
      if (inscripcion.es_interno === false) {
        const { data: rolesData } = await supabase
          .from('roles_retiro')
          .select('encargados')
          .eq('retiro_id', RETIRO_ID);

        const nombreNorm = norm(inscripcion.nombre ?? '');
        const tokens = nombreNorm.split(' ').filter((t: string) => t.length > 2);

        const tieneRol = (rolesData ?? []).some((r: any) => {
          return (r.encargados ?? []).some((enc: string) => {
            const encNorm = norm(enc);
            if (encNorm === nombreNorm) return true;
            const tokensEnc = encNorm.split(' ').filter((t: string) => t.length > 2);
            const coincidencias = tokens.filter((t: string) => tokensEnc.includes(t)).length;
            return coincidencias >= 3;
          });
        });

        if (!tieneRol) setEsAngelito(true);
      }
    }

    const hoy = new Date().toISOString().split('T')[0];
    const { data: reunionesData } = await supabase
      .from('reuniones')
      .select('id, nombre, fecha')
      .eq('retiro_id', RETIRO_ID)
      .eq('cancelada', false)
      .gte('fecha', hoy)
      .order('fecha', { ascending: true })
      .limit(1);
    if (reunionesData && reunionesData.length > 0) setProximaReunion(reunionesData[0]);

    const inscripcionIdParaMensajes = inscripcion?.id ?? null;
    const { data: msgsGenerales } = await supabase
      .from('mensajes_retiro')
      .select('id, texto, autor_nombre, created_at, updated_at, editado, destinatario_id')
      .eq('retiro_id', RETIRO_ID)
      .is('destinatario_id', null)
      .order('created_at', { ascending: false })
      .limit(10);
    const mensajesCombinados: Mensaje[] = [...(msgsGenerales ?? []) as Mensaje[]];
    if (inscripcionIdParaMensajes) {
      const { data: msgsPersonales } = await supabase
        .from('mensajes_retiro')
        .select('id, texto, autor_nombre, created_at, updated_at, editado, destinatario_id')
        .eq('retiro_id', RETIRO_ID)
        .eq('destinatario_id', inscripcionIdParaMensajes)
        .order('created_at', { ascending: false })
        .limit(10);
      mensajesCombinados.push(...(msgsPersonales ?? []) as Mensaje[]);
    }
    mensajesCombinados.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
    setMensajes(mensajesCombinados);

    setCargando(false);
  }

  useEffect(() => {
    const channel = supabase
      .channel('mensajes-servidor')
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'mensajes_retiro', filter: `retiro_id=eq.${RETIRO_ID}` }, (payload) => {
        const nuevo = payload.new as Mensaje;
        const inscId = inscripcionIdRef.current;
        if (!nuevo.destinatario_id || nuevo.destinatario_id === inscId) {
          setMensajes(prev => [nuevo, ...prev]);
        }
      })
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'mensajes_retiro' }, (payload) => {
        const updated = payload.new as Mensaje;
        setMensajes(prev => prev.map(m => m.id === updated.id ? { ...m, texto: updated.texto, editado: updated.editado, updated_at: updated.updated_at } : m));
      })
      .on('postgres_changes', { event: 'DELETE', schema: 'public', table: 'mensajes_retiro' }, (payload) => {
        setMensajes(prev => prev.filter(m => m.id !== payload.old.id));
      })
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, []);

  const totalPagado = pagos.reduce((acc, p) => acc + (p.valor || 0), 0);
  const cuotaTotal = 260000;
  const porcentajePago = Math.min(100, Math.round((totalPagado / cuotaTotal) * 100));
  const estadoPago = totalPagado >= cuotaTotal ? 'completo' : totalPagado > 0 ? 'parcial' : 'sin_pago';
  const colorEstado = estadoPago === 'completo' ? '#16a34a' : estadoPago === 'parcial' ? '#d97706' : '#6b7280';
  const textoEstado = estadoPago === 'completo' ? 'Pago completo' : estadoPago === 'parcial' ? 'Pago parcial' : 'Sin pagos';

  function formatFechaReunion(fecha: string) {
    const d = new Date(fecha + 'T00:00:00');
    return d.toLocaleDateString('es-CO', { weekday: 'long', day: 'numeric', month: 'long' });
  }

  function formatHora(iso: string) {
    return new Date(iso).toLocaleString('es-CO', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' });
  }

  if (cargando) {
    return (
      <div style={{ minHeight: '100vh', background: '#f7f8fc', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <p style={{ color: '#6b7280', fontFamily: 'system-ui, sans-serif' }}>Cargando...</p>
      </div>
    );
  }

  if (!servidor) {
    return (
      <div style={{ minHeight: '100vh', background: '#f7f8fc', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '20px' }}>
        <div style={{ textAlign: 'center' }}>
          <p style={{ color: '#374151', fontFamily: 'system-ui, sans-serif', marginBottom: '16px' }}>No se encontró tu cuenta de servidor.</p>
          <button onClick={() => router.push('/servidor/registro')} style={{ background: '#0f1787', color: 'white', border: 'none', borderRadius: '10px', padding: '12px 24px', cursor: 'pointer', fontFamily: 'system-ui, sans-serif' }}>
            Registrarse
          </button>
        </div>
      </div>
    );
  }

  const nombre = servidor.nombre ? servidor.nombre.split(' ')[0] : 'Servidor';

  return (
    <div style={{ minHeight: '100vh', background: '#f7f8fc', fontFamily: 'system-ui, sans-serif' }}>
      {/* Hero navy */}
      <div style={{ background: '#0f1787', padding: '40px 20px 48px', position: 'relative', overflow: 'hidden' }}>
        <div style={{ position: 'absolute', top: '-30px', right: '-30px', width: '150px', height: '150px', borderRadius: '50%', background: 'rgba(255,255,255,0.04)' }} />
        <div style={{ position: 'absolute', bottom: '-40px', left: '-20px', width: '120px', height: '120px', borderRadius: '50%', background: 'rgba(255,255,255,0.03)' }} />
        <div style={{ position: 'relative', zIndex: 1 }}>
          <p style={{ color: 'rgba(255,255,255,0.6)', fontSize: '13px', margin: '0 0 6px', letterSpacing: '1px' }}>EFFETÁ MAZUREN</p>
          <h1 style={{ color: 'white', fontSize: '26px', fontWeight: 600, margin: '0 0 4px' }}>Hola, {nombre}</h1>
          <p style={{ color: 'rgba(255,255,255,0.65)', fontSize: '14px', margin: 0 }}>{servidor.rol || 'Servidor'} · Retiro 2026</p>
        </div>
      </div>

      <div style={{ maxWidth: '500px', margin: '-20px auto 0', padding: '0 16px 100px', position: 'relative', zIndex: 2 }}>

        {/* ── BANNER ANGELITO ── */}
        {esAngelito && (
          <div style={{
            background: 'linear-gradient(135deg, #7c3aed 0%, #a855f7 100%)',
            borderRadius: '16px', padding: '20px', marginBottom: '12px', color: 'white',
            position: 'relative', overflow: 'hidden',
          }}>
            <div style={{ position: 'absolute', top: '-20px', right: '-20px', width: '100px', height: '100px', borderRadius: '50%', background: 'rgba(255,255,255,0.06)' }} />
            <div style={{ display: 'flex', alignItems: 'flex-start', gap: '14px', position: 'relative', zIndex: 1 }}>
              <div style={{ fontSize: '32px', flexShrink: 0, lineHeight: 1 }}>👼</div>
              <div>
                <p style={{ margin: '0 0 6px', fontSize: '15px', fontWeight: 700, color: 'white' }}>
                  Eres angelito
                </p>
                <p style={{ margin: 0, fontSize: '13px', color: 'rgba(255,255,255,0.85)', lineHeight: 1.6 }}>
                  Nos puedes acompañar a cuidar el Santísimo, la parte más importante de todo el retiro.
                </p>
              </div>
            </div>
          </div>
        )}

        {/* Card versículo */}
        <button
          onClick={() => router.push('/servidor/versiculo')}
          style={{ width: '100%', background: 'white', border: '1px solid #e8eaf0', borderRadius: '16px', padding: '18px', marginBottom: '12px', cursor: 'pointer', textAlign: 'left', display: 'flex', alignItems: 'center', gap: '14px', boxSizing: 'border-box' }}
        >
          <div style={{ width: '44px', height: '44px', borderRadius: '12px', background: '#eef0ff', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
            <svg width="22" height="22" fill="none" stroke="#0f1787" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" viewBox="0 0 24 24">
              <path d="M4 19.5A2.5 2.5 0 016.5 17H20" /><path d="M6.5 2H20v20H6.5A2.5 2.5 0 014 19.5v-15A2.5 2.5 0 016.5 2z" />
            </svg>
          </div>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '4px' }}>
              <p style={{ margin: 0, color: '#0f1787', fontSize: '14px', fontWeight: 600 }}>Versículo del día</p>
              <span style={{ background: '#eef0ff', color: '#0f1787', fontSize: '11px', fontWeight: 500, borderRadius: '20px', padding: '2px 8px', flexShrink: 0 }}>{versiculoPreview.ref}</span>
            </div>
            <p style={{ margin: 0, color: '#6b7280', fontSize: '13px', lineHeight: '1.5', fontStyle: 'italic', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>&ldquo;{versiculoPreview.texto}&rdquo;</p>
            <p style={{ margin: '4px 0 0', color: '#9ca3af', fontSize: '11px' }}>Toca para leer y escribir tu reflexión</p>
          </div>
          <svg width="16" height="16" fill="none" stroke="#9ca3af" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" viewBox="0 0 24 24" style={{ flexShrink: 0 }}>
            <path d="M9 18l6-6-6-6" />
          </svg>
        </button>

        {/* ── MENSAJES DE LÍDERES ── */}
        <div style={{ background: mensajes.length > 0 ? '#0f1787' : 'white', border: mensajes.length > 0 ? 'none' : '1px solid #e8eaf0', borderRadius: '16px', padding: '18px', marginBottom: '12px', overflow: 'hidden', position: 'relative' }}>
          {mensajes.length > 0 && (
            <div style={{ position: 'absolute', top: '-20px', right: '-20px', width: '100px', height: '100px', borderRadius: '50%', background: 'rgba(255,255,255,0.04)' }} />
          )}
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: mensajes.length > 0 ? '14px' : '0' }}>
            <div style={{ width: '32px', height: '32px', borderRadius: '10px', background: mensajes.length > 0 ? 'rgba(255,255,255,0.15)' : '#fef3c7', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
              <svg width="16" height="16" fill="none" stroke={mensajes.length > 0 ? '#fff' : '#d97706'} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" viewBox="0 0 24 24">
                <path d="M21 15a2 2 0 01-2 2H7l-4 4V5a2 2 0 012-2h14a2 2 0 012 2z" />
              </svg>
            </div>
            <div>
              <p style={{ margin: 0, fontSize: '14px', fontWeight: 600, color: mensajes.length > 0 ? 'white' : '#374151' }}>Mensajes del equipo</p>
              {mensajes.length === 0 && <p style={{ margin: 0, fontSize: '12px', color: '#9ca3af' }}>Sin mensajes nuevos</p>}
            </div>
            {mensajes.length > 0 && (
              <span style={{ marginLeft: 'auto', background: 'rgba(255,255,255,0.2)', color: 'white', fontSize: '11px', fontWeight: 600, borderRadius: '20px', padding: '2px 10px' }}>
                {mensajes.length}
              </span>
            )}
          </div>
          {mensajes.length > 0 && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
              {mensajes.map((msg, idx) => (
                <div key={msg.id} style={{ background: idx === 0 ? 'rgba(255,255,255,0.15)' : 'rgba(255,255,255,0.08)', borderRadius: '12px', padding: '12px 14px', border: idx === 0 ? '0.5px solid rgba(255,255,255,0.3)' : 'none' }}>
                  <p style={{ margin: '0 0 6px', color: 'white', fontSize: '14px', lineHeight: '1.5' }}>{msg.texto}</p>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 4 }}>
                    <span style={{ fontSize: '11px', color: 'rgba(255,255,255,0.6)', fontWeight: 500 }}>{msg.autor_nombre}</span>
                    <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
                      {msg.editado && <span style={{ fontSize: '10px', color: 'rgba(255,255,255,0.4)', fontStyle: 'italic' }}>editado</span>}
                      <span style={{ fontSize: '10px', color: 'rgba(255,255,255,0.4)' }}>{formatHora(msg.created_at)}</span>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Card pago */}
        <div style={{ background: 'white', border: '1px solid #e8eaf0', borderRadius: '16px', padding: '20px', marginBottom: '12px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '14px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <svg width="18" height="18" fill="none" stroke="#374151" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" viewBox="0 0 24 24">
                <rect x="1" y="4" width="22" height="16" rx="2" ry="2" /><line x1="1" y1="10" x2="23" y2="10" />
              </svg>
              <span style={{ color: '#374151', fontSize: '14px', fontWeight: 500 }}>Mi pago</span>
            </div>
            <span style={{ background: colorEstado + '15', color: colorEstado, fontSize: '12px', fontWeight: 500, borderRadius: '20px', padding: '3px 10px' }}>{textoEstado}</span>
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '10px' }}>
            <span style={{ color: '#6b7280', fontSize: '13px' }}>Pagado</span>
            <span style={{ color: '#1f2937', fontSize: '13px', fontWeight: 500 }}>${totalPagado.toLocaleString('es-CO')}</span>
          </div>
          <div style={{ background: '#f3f4f6', borderRadius: '100px', height: '6px', marginBottom: '10px' }}>
            <div style={{ background: colorEstado, borderRadius: '100px', height: '6px', width: porcentajePago + '%', transition: 'width 0.5s ease' }} />
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-between' }}>
            <span style={{ color: '#9ca3af', fontSize: '12px' }}>{porcentajePago}% completado</span>
            <span style={{ color: '#9ca3af', fontSize: '12px' }}>Total: $260.000</span>
          </div>
        </div>

        {/* Card próxima reunión */}
        {proximaReunion && (
          <div style={{ background: 'white', border: '1px solid #e8eaf0', borderRadius: '16px', padding: '20px', marginBottom: '12px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '10px' }}>
              <svg width="18" height="18" fill="none" stroke="#374151" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" viewBox="0 0 24 24">
                <rect x="3" y="4" width="18" height="18" rx="2" ry="2" /><line x1="16" y1="2" x2="16" y2="6" /><line x1="8" y1="2" x2="8" y2="6" /><line x1="3" y1="10" x2="21" y2="10" />
              </svg>
              <span style={{ color: '#374151', fontSize: '14px', fontWeight: 500 }}>Próxima reunión</span>
            </div>
            <p style={{ margin: '0 0 4px', color: '#1f2937', fontSize: '15px', fontWeight: 500 }}>{proximaReunion.nombre}</p>
            <p style={{ margin: 0, color: '#6b7280', fontSize: '13px' }}>{formatFechaReunion(proximaReunion.fecha)}</p>
          </div>
        )}

        {/* Accesos rápidos */}
        <p style={{ color: '#9ca3af', fontSize: '12px', letterSpacing: '1px', textTransform: 'uppercase', margin: '4px 0 12px' }}>Accesos rápidos</p>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
          <button onClick={() => router.push('/servidor/asistencias')} style={{ background: 'white', border: '1px solid #e8eaf0', borderRadius: '14px', padding: '18px 14px', cursor: 'pointer', textAlign: 'left', display: 'flex', flexDirection: 'column', gap: '8px' }}>
            <div style={{ width: '36px', height: '36px', borderRadius: '10px', background: '#f0fdf4', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <svg width="18" height="18" fill="none" stroke="#16a34a" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" viewBox="0 0 24 24">
                <rect x="3" y="4" width="18" height="18" rx="2" ry="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/><polyline points="9 16 11 18 15 14"/>
              </svg>
            </div>
            <div>
              <p style={{ margin: '0 0 2px', color: '#1f2937', fontSize: '13px', fontWeight: 500 }}>Asistencia</p>
              <p style={{ margin: 0, color: '#9ca3af', fontSize: '12px' }}>{asistencias.length} registros</p>
            </div>
          </button>

          <button onClick={() => router.push('/servidor/reembolso')} style={{ background: 'white', border: '1px solid #e8eaf0', borderRadius: '14px', padding: '18px 14px', cursor: 'pointer', textAlign: 'left', display: 'flex', flexDirection: 'column', gap: '8px' }}>
            <div style={{ width: '36px', height: '36px', borderRadius: '10px', background: '#fffbeb', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <svg width="18" height="18" fill="none" stroke="#d97706" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" viewBox="0 0 24 24">
                <path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/>
              </svg>
            </div>
            <div>
              <p style={{ margin: '0 0 2px', color: '#1f2937', fontSize: '13px', fontWeight: 500 }}>Facturas</p>
              <p style={{ margin: 0, color: '#9ca3af', fontSize: '12px' }}>Subir reembolso</p>
            </div>
          </button>

          <button onClick={() => router.push('/servidor/pago')} style={{ background: 'white', border: '1px solid #e8eaf0', borderRadius: '14px', padding: '18px 14px', cursor: 'pointer', textAlign: 'left', display: 'flex', flexDirection: 'column', gap: '8px' }}>
            <div style={{ width: '36px', height: '36px', borderRadius: '10px', background: '#eef0ff', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <svg width="18" height="18" fill="none" stroke="#0f1787" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" viewBox="0 0 24 24">
                <line x1="12" y1="1" x2="12" y2="23"/><path d="M17 5H9.5a3.5 3.5 0 000 7h5a3.5 3.5 0 010 7H6"/>
              </svg>
            </div>
            <div>
              <p style={{ margin: '0 0 2px', color: '#1f2937', fontSize: '13px', fontWeight: 500 }}>Mi pago</p>
              <p style={{ margin: 0, color: '#9ca3af', fontSize: '12px' }}>Ver comprobante</p>
            </div>
          </button>

          <button onClick={() => router.push('/servidor/retiro')} style={{ background: 'white', border: '1px solid #e8eaf0', borderRadius: '14px', padding: '18px 14px', cursor: 'pointer', textAlign: 'left', display: 'flex', flexDirection: 'column', gap: '8px' }}>
            <div style={{ width: '36px', height: '36px', borderRadius: '10px', background: '#fdf2f8', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <svg width="18" height="18" fill="none" stroke="#7c3aed" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" viewBox="0 0 24 24">
                <path d="M17 21v-2a4 4 0 00-4-4H5a4 4 0 00-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 00-3-3.87"/><path d="M16 3.13a4 4 0 010 7.75"/>
              </svg>
            </div>
            <div>
              <p style={{ margin: '0 0 2px', color: '#1f2937', fontSize: '13px', fontWeight: 500 }}>Mi retiro</p>
              <p style={{ margin: 0, color: '#9ca3af', fontSize: '12px' }}>Rol y mesa</p>
            </div>
          </button>
        </div>

        <button
          onClick={async () => { await supabase.auth.signOut(); router.push('/'); }}
          style={{ width: '100%', background: 'none', border: '1px solid #e8eaf0', borderRadius: '12px', padding: '14px', marginTop: '24px', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px' }}
        >
          <svg width="16" height="16" fill="none" stroke="#6b7280" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" viewBox="0 0 24 24">
            <path d="M9 21H5a2 2 0 01-2-2V5a2 2 0 012-2h4"/><polyline points="16 17 21 12 16 7"/><line x1="21" y1="12" x2="9" y2="12"/>
          </svg>
          <span style={{ color: '#6b7280', fontSize: '14px' }}>Cerrar sesión</span>
        </button>

      </div>
    </div>
  );
}
