'use client'

import { useState } from 'react'

type Props = {
  id: string
  esInterno: boolean
  readonly?: boolean
}

const opciones = [
  { valor: true,  label: 'Interno',  color: 'bg-blue-100 text-blue-800 ring-blue-200' },
  { valor: false, label: 'Externo',  color: 'bg-slate-100 text-slate-600 ring-slate-200' },
]

export default function BadgeTipoServidor({ id, esInterno, readonly = false }: Props) {
  const [actual, setActual] = useState(esInterno)
  const [abierto, setAbierto] = useState(false)
  const [cargando, setCargando] = useState(false)

  const opcionActual = opciones.find(o => o.valor === actual) ?? opciones[1]

  async function cambiar(nuevoValor: boolean) {
    if (nuevoValor === actual) { setAbierto(false); return }
    setCargando(true)
    try {
      const res = await fetch(`/api/servidores/${id}/tipo`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ es_interno: nuevoValor }),
      })
      if (res.ok) setActual(nuevoValor)
    } finally {
      setCargando(false)
      setAbierto(false)
    }
  }

  if (readonly) {
    return (
      <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ring-1 ring-inset ${opcionActual.color}`}>
        {opcionActual.label}
      </span>
    )
  }

  return (
    <div className="relative inline-block">
      <button
        onClick={() => setAbierto(!abierto)}
        disabled={cargando}
        className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-medium ring-1 ring-inset transition-opacity ${opcionActual.color} ${cargando ? 'opacity-50' : 'hover:opacity-80 cursor-pointer'}`}
      >
        {cargando ? (
          <svg className="animate-spin h-3 w-3" viewBox="0 0 24 24" fill="none">
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/>
            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8z"/>
          </svg>
        ) : (
          <svg className="h-3 w-3" viewBox="0 0 20 20" fill="currentColor">
            <path fillRule="evenodd" d="M5.23 7.21a.75.75 0 011.06.02L10 11.168l3.71-3.938a.75.75 0 111.08 1.04l-4.25 4.5a.75.75 0 01-1.08 0l-4.25-4.5a.75.75 0 01.02-1.06z" clipRule="evenodd" />
          </svg>
        )}
        {opcionActual.label}
      </button>

      {abierto && (
        <>
          <div className="fixed inset-0 z-10" onClick={() => setAbierto(false)} />
          <div className="absolute left-0 mt-1 z-20 bg-white rounded-lg shadow-lg ring-1 ring-black/5 py-1 min-w-[110px]">
            {opciones.map(op => (
              <button
                key={String(op.valor)}
                onClick={() => cambiar(op.valor)}
                className={`w-full text-left px-3 py-1.5 text-xs font-medium flex items-center gap-2 hover:bg-gray-50 transition-colors ${op.valor === actual ? 'text-[#0f1787]' : 'text-gray-700'}`}
              >
                <span className={`inline-block w-2 h-2 rounded-full ${op.valor === actual ? 'bg-[#0f1787]' : 'bg-transparent border border-gray-300'}`} />
                {op.label}
              </button>
            ))}
          </div>
        </>
      )}
    </div>
  )
}
