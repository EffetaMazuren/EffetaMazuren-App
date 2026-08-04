'use client'

import { createContext, useContext, useEffect, useState, ReactNode } from 'react'
import { supabase, Retiro } from './supabase'

const RetiroContext = createContext<Retiro | null>(null)

export function RetiroProvider({ children }: { children: ReactNode }) {
  const [retiro, setRetiro] = useState<Retiro | null>(null)
  const [error, setError] = useState('')

  useEffect(() => {
    supabase
      .from('retiros')
      .select('*')
      .eq('estado', 'activo')
      .single()
      .then(({ data, error }) => {
        if (error || !data) {
          setError('No hay un retiro activo configurado.')
          return
        }
        setRetiro(data)
      })
  }, [])

  if (error) {
    return (
      <div style={{ minHeight: '100vh', background: '#0f1787', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 24 }}>
        <p style={{ color: '#fff', fontSize: 14, textAlign: 'center' }}>{error}</p>
      </div>
    )
  }

  if (!retiro) {
    return (
      <div style={{ minHeight: '100vh', background: '#0f1787', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <div style={{ fontSize: 38, fontWeight: 500, color: '#fff', letterSpacing: 3, fontFamily: 'Georgia, serif' }}>
          EFFETÁ
        </div>
      </div>
    )
  }

  return <RetiroContext.Provider value={retiro}>{children}</RetiroContext.Provider>
}

export function useRetiroActual(): Retiro {
  const retiro = useContext(RetiroContext)
  if (!retiro) {
    throw new Error('useRetiroActual debe usarse dentro de RetiroProvider')
  }
  return retiro
}
