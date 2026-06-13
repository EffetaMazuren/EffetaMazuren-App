import { createClient } from '@supabase/supabase-js'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!

export const supabase = createClient(supabaseUrl, supabaseAnonKey)

// Tipos principales
export type Retiro = {
  id: string
  nombre: string
  fecha_inicio: string
  fecha_fin: string
  meta_financiera: number
  capacidad_caminantes: number
  estado: 'activo' | 'archivado'
}

export type Caminante = {
  id: string
  retiro_id: string
  nombre: string
  tipo_documento: string
  numero_documento: string
  celular: string
  correo: string
  direccion: string
  fecha_nacimiento: string
  edad: number
  talla_camiseta: string
  sacramentos: string[]
  eps: string
  alergias: string
  restricciones_alimentarias: string
  medicamentos: string
  es_sorpresa: boolean
  estado_correo: 'sin_enviar' | 'enviado' | 'enviado_contacto'
  inscrito_oficialmente: boolean
  fecha_inscripcion: string
  observaciones: string
}

export type VistaPagoCaminante = {
  id: string
  retiro_id: string
  nombre: string
  numero_documento: string
  correo: string
  celular: string
  es_sorpresa: boolean
  estado_correo: string
  inscrito_oficialmente: boolean
  fecha_inscripcion: string
  total_pagado: number
  saldo_pendiente: number
  estado_pago: 'completo' | 'parcial' | 'sin_pago'
  numero_abonos: number
}

export type Pago = {
  id: string
  persona_id: string
  tipo_persona: 'caminante' | 'servidor'
  retiro_id: string
  valor: number
  fecha: string
  comprobante_url: string
  comprobante_nombre: string
}

export type Usuario = {
  id: string
  nombre: string
  correo: string
  rol: 'lider' | 'servidor'
  activo: boolean
}

export type VistaBalanceRetiro = {
  retiro_id: string
  nombre: string
  meta_financiera: number
  total_ingresos: number
  total_egresos: number
  balance: number
  falta_para_meta: number
}

export type VistaCupos = {
  retiro_id: string
  nombre: string
  capacidad_caminantes: number
  caminantes_con_abono: number
  cupos_disponibles: number
  cupo_lleno: boolean
}
