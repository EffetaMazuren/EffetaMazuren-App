const MESES = ['enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio', 'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre']

export function formatearFechasRetiro(fechaInicio: string, fechaFin: string): string {
  const inicio = new Date(fechaInicio + 'T00:00:00')
  const fin = new Date(fechaFin + 'T00:00:00')

  if (inicio.getMonth() === fin.getMonth() && inicio.getFullYear() === fin.getFullYear()) {
    const dias: number[] = []
    for (let d = new Date(inicio); d <= fin; d.setDate(d.getDate() + 1)) dias.push(d.getDate())
    const listaDias = dias.length > 1
      ? `${dias.slice(0, -1).join(', ')} y ${dias[dias.length - 1]}`
      : `${dias[0]}`
    return `${listaDias} de ${MESES[inicio.getMonth()]} de ${inicio.getFullYear()}`
  }

  const fmt = (d: Date) => `${d.getDate()} de ${MESES[d.getMonth()]}`
  return `${fmt(inicio)} al ${fmt(fin)} de ${fin.getFullYear()}`
}
