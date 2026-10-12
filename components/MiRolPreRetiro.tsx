'use client'

import { useEffect, useState, type CSSProperties } from 'react'
import { supabase } from '@/lib/supabase'

// Muestra al servidor conectado el rol pre-retiro que le tocó, con sus
// líderes, su equipo y el adulto responsable. Los datos viven en Supabase
// (tablas equipos_retiro y equipos_retiro_miembros) y se leen con la
// función mi_equipo_retiro; aquí no hay nombres ni roles escritos a mano.

type RolPreRetiro = {
  rol_id: string
  retiro_id: string
  rol: string
  adulto_responsable: string | null
  mi_tipo: 'lider' | 'equipo'
  lideres: string[]
  equipo: string[]
}

type Props = {
  // Opcional: si se pasa, solo muestra el rol de ese retiro.
  retiroId?: string
}

const AZUL = '#0f1787'
const TEXTO = '#1f2937'
const GRIS = '#6b7280'
const BORDE = '#e5e7eb'
const FONDO = '#f7f8fc'

function formatearNombre(nombre: string) {
  // Algunos nombres están guardados en mayúsculas o minúsculas completas
  return nombre
    .trim()
    .toLowerCase()
    .split(/\s+/)
    .map((p) => (['de', 'del', 'la', 'las', 'los', 'y'].includes(p) ? p : p.charAt(0).toUpperCase() + p.slice(1)))
    .join(' ')
}

export default function MiRolPreRetiro({ retiroId }: Props) {
  const [roles, setRoles] = useState<RolPreRetiro[] | null>(null)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let activo = true
    async function cargar() {
      const { data, error } = await supabase.rpc('mi_equipo_retiro', {
        p_retiro_id: retiroId ?? null,
      })
      if (!activo) return
      if (error) {
        console.error('Error cargando rol pre-retiro:', error)
        setError('No se pudo cargar tu rol. Recarga la página; si sigue igual, avísale a un líder.')
        setRoles([])
        return
      }
      setRoles((data as RolPreRetiro[]) ?? [])
    }
    cargar()
    return () => {
      activo = false
    }
  }, [retiroId])

  if (roles === null) {
    return (
      <section style={tarjeta}>
        <p style={{ margin: 0, color: GRIS, fontSize: 14 }}>Cargando tu rol…</p>
      </section>
    )
  }

  if (error) {
    return (
      <section style={tarjeta}>
        <p style={{ margin: 0, color: '#b91c1c', fontSize: 14 }}>{error}</p>
      </section>
    )
  }

  if (roles.length === 0) {
    return (
      <section style={tarjeta}>
        <h2 style={titulo}>Tu rol en el retiro</h2>
        <p style={{ margin: '8px 0 0', color: GRIS, fontSize: 14, lineHeight: 1.6 }}>
          Todavía no tienes rol asignado. Cuando los líderes lo asignen, aparecerá aquí.
        </p>
      </section>
    )
  }

  return (
    <>
      {roles.map((r) => (
        <section key={r.rol_id} style={tarjeta}>
          <p style={{ margin: 0, color: GRIS, fontSize: 13 }}>Tu rol en el retiro</p>
          <h2 style={{ ...titulo, fontSize: 26, margin: '4px 0 6px' }}>{r.rol}</h2>
          <p style={{ margin: '0 0 20px', fontSize: 14, color: TEXTO }}>
            {r.mi_tipo === 'lider' ? 'Eres líder de este equipo.' : 'Eres parte de este equipo.'}
          </p>

          <div style={grilla}>
            <Grupo titulo="Líderes" nombres={r.lideres} />
            <Grupo titulo="Equipo" nombres={r.equipo} />
          </div>

          {r.adulto_responsable && (
            <p style={{ margin: '20px 0 0', paddingTop: 14, borderTop: `1px solid ${BORDE}`, fontSize: 14, color: TEXTO }}>
              Adulto responsable: <strong style={{ color: AZUL }}>{r.adulto_responsable}</strong>
            </p>
          )}
        </section>
      ))}
    </>
  )
}

function Grupo({ titulo, nombres }: { titulo: string; nombres: string[] }) {
  return (
    <div>
      <h3 style={{ margin: '0 0 8px', fontSize: 14, fontWeight: 600, color: AZUL }}>
        {titulo} <span style={{ color: GRIS, fontWeight: 400 }}>({nombres.length})</span>
      </h3>
      {nombres.length === 0 ? (
        <p style={{ margin: 0, fontSize: 14, color: GRIS }}>Sin asignar</p>
      ) : (
        <ul style={{ margin: 0, padding: 0, listStyle: 'none' }}>
          {nombres.map((n) => (
            <li key={n} style={{ fontSize: 14, color: TEXTO, padding: '5px 0', borderBottom: `1px solid ${BORDE}` }}>
              {formatearNombre(n)}
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}

const tarjeta: CSSProperties = {
  background: '#ffffff',
  border: `1px solid ${BORDE}`,
  borderLeft: `4px solid ${AZUL}`,
  borderRadius: 12,
  padding: '20px 22px',
  marginBottom: 16,
}

const titulo: CSSProperties = {
  margin: 0,
  fontSize: 18,
  fontWeight: 600,
  color: AZUL,
}

const grilla: CSSProperties = {
  display: 'grid',
  gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
  gap: 20,
  background: FONDO,
  borderRadius: 8,
  padding: 14,
}
