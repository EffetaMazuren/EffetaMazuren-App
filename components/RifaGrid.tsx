'use client'

export type EstadoNumero = 'disponible' | 'pendiente' | 'confirmado'

const COLORES: Record<EstadoNumero, { bg: string; color: string; border: string }> = {
  disponible: { bg: '#fff', color: '#111827', border: '#e5e7eb' },
  pendiente: { bg: '#fef3c7', color: '#92400e', border: '#fde68a' },
  confirmado: { bg: '#f3f4f6', color: '#9ca3af', border: '#e5e7eb' },
}

export default function RifaGrid({ estados, onSelect, seleccionado, onClickTomado }: {
  estados: Record<number, EstadoNumero>
  onSelect?: (n: number) => void
  seleccionado?: number | null
  onClickTomado?: (n: number) => void
}) {
  return (
    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(10, 1fr)', gap: 4 }}>
      {Array.from({ length: 100 }, (_, n) => n).map(n => {
        const estado = estados[n] || 'disponible'
        const c = COLORES[estado]
        const tomado = estado !== 'disponible'
        const isSel = seleccionado === n
        const clickable = tomado ? !!onClickTomado : !!onSelect
        return (
          <button
            key={n}
            disabled={!clickable}
            onClick={() => tomado ? onClickTomado?.(n) : onSelect?.(n)}
            title={estado === 'pendiente' ? 'Pendiente de revisión — toca para ver detalle' : estado === 'confirmado' ? 'Vendido — toca para ver detalle' : 'Disponible'}
            style={{
              aspectRatio: '1', borderRadius: 6, border: `1.5px solid ${isSel ? '#0f1787' : c.border}`,
              background: isSel ? '#eef0ff' : c.bg, color: isSel ? '#0f1787' : c.color,
              fontSize: 11, fontWeight: 600, cursor: clickable ? 'pointer' : 'default',
              textDecoration: tomado ? 'line-through' : 'none',
              padding: 0,
            }}
          >
            {String(n).padStart(2, '0')}
          </button>
        )
      })}
    </div>
  )
}
