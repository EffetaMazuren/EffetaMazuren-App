// ─────────────────────────────────────────────────────────────────────────────
// INSTRUCCIONES: En app/dashboard/retiro/page.tsx, busca el bloque del tab Roles.
// Al final del tab Roles, JUSTO ANTES del cierre  </div>  del bloque {tab === 'roles' && (
// agrega todo el código de abajo (el bloque <PalancasLiderGestion />).
//
// También agrega este estado al inicio del componente RetiroDashboard:
//   const [servidoresList, setServidoresList] = useState<{id:string;nombre:string;palancas_lider:boolean}[]>([])
//   const [loadingPalancasLider, setLoadingPalancasLider] = useState(false)
//   const [exitoPalancasLider, setExitoPalancasLider] = useState('')
//
// Y esta función junto a las otras funciones de carga:
//   const cargarServidoresParaPalancas = async () => {
//     setLoadingPalancasLider(true)
//     const { data } = await supabase
//       .from('servidores_inscripcion')
//       .select('id, nombre, palancas_lider')
//       .eq('retiro_id', RETIRO_ID)
//       .order('nombre')
//     setServidoresList(data ?? [])
//     setLoadingPalancasLider(false)
//   }
//
// Y en el useEffect que carga datos por tab, agrega:
//   if (tab === 'roles') cargarServidoresParaPalancas()   // ya existe cargarRoles(), agrega esta línea también
// ─────────────────────────────────────────────────────────────────────────────

// ══ BLOQUE A INSERTAR en el tab Roles, justo antes del cierre del bloque ══

{/* ── ACCESO PALANCAS LÍDER ── */}
<div style={{ marginTop: 32 }}>
  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
    <div>
      <h3 style={{ fontSize: 13, fontWeight: 700, color: '#7c3aed', margin: '0 0 2px', textTransform: 'uppercase', letterSpacing: 1 }}>Acceso Palancas Líder</h3>
      <p style={{ fontSize: 12, color: '#9ca3af', margin: 0 }}>Servidores que pueden ver todo el seguimiento de palancas</p>
    </div>
    {exitoPalancasLider && (
      <span style={{ fontSize: 12, color: '#16a34a', fontWeight: 600 }}>✓ {exitoPalancasLider}</span>
    )}
  </div>

  {loadingPalancasLider ? (
    <div style={{ display: 'flex', justifyContent: 'center', padding: 20 }}>
      <div style={{ width: 24, height: 24, border: '3px solid #e2e4f0', borderTopColor: '#7c3aed', borderRadius: '50%', animation: 'spin 0.8s linear infinite' }} />
    </div>
  ) : (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
      {servidoresList.map(srv => (
        <div key={srv.id} style={{
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          padding: '10px 14px', background: srv.palancas_lider ? '#faf5ff' : 'white',
          border: `1.5px solid ${srv.palancas_lider ? '#d8b4fe' : '#e8eaf0'}`,
          borderRadius: 10,
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            {srv.palancas_lider && (
              <div style={{ width: 8, height: 8, borderRadius: '50%', background: '#7c3aed', flexShrink: 0 }} />
            )}
            <span style={{ fontSize: 13, fontWeight: srv.palancas_lider ? 600 : 400, color: srv.palancas_lider ? '#6d28d9' : '#374151' }}>
              {srv.nombre}
            </span>
          </div>
          <button
            onClick={async () => {
              const nuevoValor = !srv.palancas_lider
              await supabase
                .from('servidores_inscripcion')
                .update({ palancas_lider: nuevoValor })
                .eq('id', srv.id)
              setServidoresList(prev => prev.map(s => s.id === srv.id ? { ...s, palancas_lider: nuevoValor } : s))
              setExitoPalancasLider(nuevoValor ? `Acceso dado a ${srv.nombre.split(' ')[0]}` : `Acceso quitado a ${srv.nombre.split(' ')[0]}`)
              setTimeout(() => setExitoPalancasLider(''), 2500)
            }}
            style={{
              padding: '5px 12px', borderRadius: 8, border: 'none', cursor: 'pointer',
              fontSize: 12, fontWeight: 600,
              background: srv.palancas_lider ? '#fef2f2' : '#f0fdf4',
              color: srv.palancas_lider ? '#dc2626' : '#16a34a',
            }}
          >
            {srv.palancas_lider ? 'Quitar acceso' : 'Dar acceso'}
          </button>
        </div>
      ))}
    </div>
  )}
</div>
