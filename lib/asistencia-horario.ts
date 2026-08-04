export interface ReunionParaVentana {
  fecha: string
  tipo: string
  hora_inicio: string | null
  hora_fin: string | null
}

function minutosDesdeMedianoche(horaStr: string): number {
  const [h, m] = horaStr.split(':').map(Number)
  return h * 60 + m
}

function fechaYYYYMMDD(colombia: Date): string {
  const y = colombia.getUTCFullYear()
  const m = String(colombia.getUTCMonth() + 1).padStart(2, '0')
  const d = String(colombia.getUTCDate()).padStart(2, '0')
  return `${y}-${m}-${d}`
}

/**
 * Ventana válida de asistencia. Reuniones regulares (tipo !== 'especial'):
 * fija, martes 9:00-9:20pm hora Colombia. Eventos especiales: la ventana
 * que el líder configuró al crearlos (hora_inicio/hora_fin), solo el
 * mismo día de `fecha` -- sin horario configurado, nunca cuenta.
 */
export function estaDentroDeVentana(reunion: ReunionParaVentana, ahora: Date): boolean {
  const colombia = new Date(ahora.getTime() - 5 * 60 * 60 * 1000)
  const minutosAhora = colombia.getUTCHours() * 60 + colombia.getUTCMinutes()

  if (reunion.tipo === 'especial') {
    if (!reunion.hora_inicio || !reunion.hora_fin) return false
    if (fechaYYYYMMDD(colombia) !== reunion.fecha) return false
    const inicio = minutosDesdeMedianoche(reunion.hora_inicio)
    const fin = minutosDesdeMedianoche(reunion.hora_fin)
    return minutosAhora >= inicio && minutosAhora < fin
  }

  const esMartes = colombia.getUTCDay() === 2
  if (!esMartes) return false
  return minutosAhora >= 21 * 60 && minutosAhora < 21 * 60 + 20
}
