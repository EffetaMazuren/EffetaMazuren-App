'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabase';
import { useRetiroActual } from '@/lib/retiro-context';
import { getVersiculoDelDia, VERSICULOS } from '@/lib/versiculos';

interface Reflexion {
  id: string;
  versiculo_ref: string;
  versiculo_texto: string;
  reflexion: string;
  created_at: string;
}

export default function VersiculoPage() {
  const router = useRouter();
  const { id: RETIRO_ID } = useRetiroActual();
  const [inscripcionId, setInscripcionId] = useState<string | null>(null);
  const [reflexiones, setReflexiones] = useState<Reflexion[]>([]);
  const [nuevaReflexion, setNuevaReflexion] = useState('');
  const [guardando, setGuardando] = useState(false);
  const [cargando, setCargando] = useState(true);
  const [mostrarFormulario, setMostrarFormulario] = useState(false);
  const [error, setError] = useState('');
  const [exito, setExito] = useState('');

  const versiculo = getVersiculoDelDia();

  useEffect(() => {
    inicializar();
  }, []);

  async function inicializar() {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) { router.push('/'); return; }

    const { data: inscripcion } = await supabase
      .from('servidores_inscripcion')
      .select('id')
      .eq('usuario_id', user.id)
      .eq('retiro_id', RETIRO_ID)
      .single();

    if (!inscripcion) { router.push('/servidor'); return; }
    setInscripcionId(inscripcion.id);
    await cargarReflexiones(inscripcion.id);
    setCargando(false);
  }

  async function cargarReflexiones(id: string) {
    const { data } = await supabase
      .from('diario_reflexion')
      .select('*')
      .eq('servidor_inscripcion_id', id)
      .order('created_at', { ascending: false });
    if (data) setReflexiones(data);
  }

  async function guardarReflexion() {
    if (!nuevaReflexion.trim() || !inscripcionId) return;
    setGuardando(true);
    setError('');
    const { error: err } = await supabase.from('diario_reflexion').insert({
      servidor_inscripcion_id: inscripcionId,
      versiculo_ref: versiculo.ref,
      versiculo_texto: versiculo.texto,
      reflexion: nuevaReflexion.trim(),
    });
    if (err) {
      setError('No se pudo guardar. Intenta de nuevo.');
    } else {
      setExito('Reflexión guardada');
      setNuevaReflexion('');
      setMostrarFormulario(false);
      await cargarReflexiones(inscripcionId);
      setTimeout(() => setExito(''), 3000);
    }
    setGuardando(false);
  }

  async function eliminarReflexion(id: string) {
    const { error: err } = await supabase.from('diario_reflexion').delete().eq('id', id);
    if (!err && inscripcionId) await cargarReflexiones(inscripcionId);
  }

  function formatFecha(iso: string) {
    const d = new Date(iso);
    return d.toLocaleDateString('es-CO', { day: 'numeric', month: 'long', year: 'numeric', hour: '2-digit', minute: '2-digit' });
  }

  if (cargando) {
    return (
      <div style={{ minHeight: '100vh', background: '#f7f8fc', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <p style={{ color: '#6b7280', fontFamily: 'system-ui, sans-serif' }}>Cargando...</p>
      </div>
    );
  }

  return (
    <div style={{ minHeight: '100vh', background: '#f7f8fc', fontFamily: 'system-ui, sans-serif' }}>
      {/* Header */}
      <div style={{ background: '#0f1787', padding: '16px 20px', display: 'flex', alignItems: 'center', gap: '12px' }}>
        <button
          onClick={() => router.push('/servidor')}
          style={{ background: 'none', border: 'none', cursor: 'pointer', padding: '4px', display: 'flex', alignItems: 'center' }}
        >
          <svg width="20" height="20" fill="none" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" viewBox="0 0 24 24">
            <path d="M19 12H5M5 12l7 7M5 12l7-7" />
          </svg>
        </button>
        <span style={{ color: 'white', fontFamily: 'Georgia, serif', letterSpacing: 2, fontSize: '15px', fontWeight: 600 }}>EFFETÁ</span>
        <span style={{ color: 'rgba(255,255,255,0.7)', fontSize: '14px' }}>— Versículo del día</span>
      </div>

      <div style={{ maxWidth: '500px', margin: '0 auto', padding: '24px 16px 100px' }}>

        {/* Card versículo principal */}
        <div style={{ background: '#0f1787', borderRadius: '20px', padding: '32px 28px', marginBottom: '24px', position: 'relative', overflow: 'hidden' }}>
          {/* Decoración de fondo */}
          <div style={{ position: 'absolute', top: '-20px', right: '-20px', width: '100px', height: '100px', borderRadius: '50%', background: 'rgba(255,255,255,0.04)' }} />
          <div style={{ position: 'absolute', bottom: '-30px', left: '-10px', width: '80px', height: '80px', borderRadius: '50%', background: 'rgba(255,255,255,0.03)' }} />

          {/* Ícono libro */}
          <div style={{ marginBottom: '20px', display: 'flex', alignItems: 'center', gap: '8px' }}>
            <svg width="18" height="18" fill="none" stroke="rgba(255,255,255,0.6)" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" viewBox="0 0 24 24">
              <path d="M4 19.5A2.5 2.5 0 016.5 17H20" /><path d="M6.5 2H20v20H6.5A2.5 2.5 0 014 19.5v-15A2.5 2.5 0 016.5 2z" />
            </svg>
            <span style={{ color: 'rgba(255,255,255,0.6)', fontSize: '12px', letterSpacing: '1px', textTransform: 'uppercase' }}>Versículo del día</span>
          </div>

          <p style={{ color: 'white', fontSize: '18px', lineHeight: '1.7', fontFamily: 'Georgia, serif', fontStyle: 'italic', marginBottom: '20px', position: 'relative', zIndex: 1 }}>
            &ldquo;{versiculo.texto}&rdquo;
          </p>

          <p style={{ color: 'rgba(255,255,255,0.7)', fontSize: '14px', fontWeight: 500, position: 'relative', zIndex: 1 }}>
            — {versiculo.ref}
          </p>

          <div style={{ marginTop: '20px', paddingTop: '16px', borderTop: '1px solid rgba(255,255,255,0.1)' }}>
            <p style={{ color: 'rgba(255,255,255,0.45)', fontSize: '11px' }}>
              Se renueva cada 12 horas · {VERSICULOS.length} versículos
            </p>
          </div>
        </div>

        {/* Mensaje de éxito */}
        {exito && (
          <div style={{ background: '#f0fdf4', border: '1px solid #bbf7d0', borderRadius: '12px', padding: '12px 16px', marginBottom: '16px', display: 'flex', alignItems: 'center', gap: '8px' }}>
            <svg width="16" height="16" fill="none" stroke="#16a34a" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" viewBox="0 0 24 24">
              <polyline points="20 6 9 17 4 12" />
            </svg>
            <span style={{ color: '#16a34a', fontSize: '14px' }}>{exito}</span>
          </div>
        )}

        {/* Error */}
        {error && (
          <div style={{ background: '#fef2f2', border: '1px solid #fecaca', borderRadius: '12px', padding: '12px 16px', marginBottom: '16px' }}>
            <p style={{ color: '#dc2626', fontSize: '14px', margin: 0 }}>{error}</p>
          </div>
        )}

        {/* Botón escribir reflexión */}
        {!mostrarFormulario && (
          <button
            onClick={() => setMostrarFormulario(true)}
            style={{ width: '100%', background: 'white', border: '1.5px solid #0f1787', borderRadius: '14px', padding: '16px', display: 'flex', alignItems: 'center', gap: '12px', cursor: 'pointer', marginBottom: '24px' }}
          >
            <div style={{ width: '36px', height: '36px', borderRadius: '10px', background: '#eef0ff', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
              <svg width="18" height="18" fill="none" stroke="#0f1787" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" viewBox="0 0 24 24">
                <path d="M12 20h9" /><path d="M16.5 3.5a2.121 2.121 0 013 3L7 19l-4 1 1-4L16.5 3.5z" />
              </svg>
            </div>
            <div style={{ textAlign: 'left' }}>
              <p style={{ margin: 0, color: '#0f1787', fontWeight: 500, fontSize: '15px' }}>Escribir reflexión</p>
              <p style={{ margin: 0, color: '#6b7280', fontSize: '13px' }}>¿Qué te dice este versículo hoy?</p>
            </div>
          </button>
        )}

        {/* Formulario de reflexión */}
        {mostrarFormulario && (
          <div style={{ background: 'white', border: '1px solid #e8eaf0', borderRadius: '16px', padding: '20px', marginBottom: '24px' }}>
            <p style={{ margin: '0 0 6px', color: '#374151', fontSize: '13px', fontWeight: 500 }}>
              {versiculo.ref}
            </p>
            <p style={{ margin: '0 0 16px', color: '#6b7280', fontSize: '13px', fontStyle: 'italic', lineHeight: '1.5' }}>
              &ldquo;{versiculo.texto.substring(0, 80)}{versiculo.texto.length > 80 ? '...' : ''}&rdquo;
            </p>
            <textarea
              value={nuevaReflexion}
              onChange={e => setNuevaReflexion(e.target.value)}
              placeholder="Escribe tu reflexión personal aquí..."
              style={{
                width: '100%', minHeight: '120px', border: '1px solid #e8eaf0', borderRadius: '10px',
                padding: '12px', fontSize: '15px', fontFamily: 'system-ui, sans-serif', resize: 'vertical',
                outline: 'none', color: '#1f2937', lineHeight: '1.6', boxSizing: 'border-box'
              }}
            />
            <div style={{ display: 'flex', gap: '10px', marginTop: '12px' }}>
              <button
                onClick={() => { setMostrarFormulario(false); setNuevaReflexion(''); }}
                style={{ flex: 1, padding: '12px', border: '1px solid #e8eaf0', borderRadius: '10px', background: 'white', color: '#6b7280', fontSize: '14px', cursor: 'pointer' }}
              >
                Cancelar
              </button>
              <button
                onClick={guardarReflexion}
                disabled={guardando || !nuevaReflexion.trim()}
                style={{
                  flex: 2, padding: '12px', border: 'none', borderRadius: '10px',
                  background: guardando || !nuevaReflexion.trim() ? '#9ca3af' : '#0f1787',
                  color: 'white', fontSize: '14px', fontWeight: 500, cursor: guardando || !nuevaReflexion.trim() ? 'not-allowed' : 'pointer'
                }}
              >
                {guardando ? 'Guardando...' : 'Guardar reflexión'}
              </button>
            </div>
          </div>
        )}

        {/* Historial de reflexiones */}
        {reflexiones.length > 0 && (
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '16px' }}>
              <svg width="16" height="16" fill="none" stroke="#6b7280" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" viewBox="0 0 24 24">
                <path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z" /><polyline points="14 2 14 8 20 8" /><line x1="16" y1="13" x2="8" y2="13" /><line x1="16" y1="17" x2="8" y2="17" /><polyline points="10 9 9 9 8 9" />
              </svg>
              <p style={{ margin: 0, color: '#374151', fontSize: '15px', fontWeight: 500 }}>Mi diario de reflexión</p>
              <span style={{ background: '#eef0ff', color: '#0f1787', fontSize: '12px', fontWeight: 500, borderRadius: '20px', padding: '2px 8px' }}>
                {reflexiones.length}
              </span>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
              {reflexiones.map((r) => (
                <div key={r.id} style={{ background: 'white', border: '1px solid #e8eaf0', borderRadius: '16px', padding: '18px', position: 'relative' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '10px' }}>
                    <div>
                      <p style={{ margin: 0, color: '#0f1787', fontSize: '12px', fontWeight: 500 }}>{r.versiculo_ref}</p>
                      <p style={{ margin: '2px 0 0', color: '#9ca3af', fontSize: '11px' }}>{formatFecha(r.created_at)}</p>
                    </div>
                    <button
                      onClick={() => eliminarReflexion(r.id)}
                      style={{ background: 'none', border: 'none', cursor: 'pointer', padding: '4px', color: '#d1d5db' }}
                    >
                      <svg width="15" height="15" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" viewBox="0 0 24 24">
                        <polyline points="3 6 5 6 21 6" /><path d="M19 6v14a2 2 0 01-2 2H7a2 2 0 01-2-2V6m3 0V4a1 1 0 011-1h4a1 1 0 011 1v2" />
                      </svg>
                    </button>
                  </div>

                  <div style={{ borderLeft: '3px solid #eef0ff', paddingLeft: '12px', marginBottom: '12px' }}>
                    <p style={{ margin: 0, color: '#6b7280', fontSize: '12px', fontStyle: 'italic', lineHeight: '1.5' }}>
                      &ldquo;{r.versiculo_texto.substring(0, 100)}{r.versiculo_texto.length > 100 ? '...' : ''}&rdquo;
                    </p>
                  </div>

                  <p style={{ margin: 0, color: '#1f2937', fontSize: '14px', lineHeight: '1.6' }}>
                    {r.reflexion}
                  </p>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Estado vacío */}
        {reflexiones.length === 0 && !mostrarFormulario && (
          <div style={{ textAlign: 'center', padding: '32px 20px' }}>
            <div style={{ width: '56px', height: '56px', borderRadius: '16px', background: '#eef0ff', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 16px' }}>
              <svg width="28" height="28" fill="none" stroke="#0f1787" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" viewBox="0 0 24 24">
                <path d="M4 19.5A2.5 2.5 0 016.5 17H20" /><path d="M6.5 2H20v20H6.5A2.5 2.5 0 014 19.5v-15A2.5 2.5 0 016.5 2z" />
              </svg>
            </div>
            <p style={{ margin: '0 0 6px', color: '#374151', fontSize: '15px', fontWeight: 500 }}>Tu diario está vacío</p>
            <p style={{ margin: 0, color: '#9ca3af', fontSize: '14px', lineHeight: '1.5' }}>
              Empieza escribiendo tu primera reflexión sobre el versículo de hoy
            </p>
          </div>
        )}

      </div>
    </div>
  );
}
