// Leer y generar el Excel de habitaciones con el formato de la plantilla
// "HABITACIONES Y ACOMODACIÓN":
//
//   No. | HABITACIONES | CAMAS | NOMBRE RESERVACION
//   ── DORMITORIO ROSALIA ──────────────────────────  (fila amarilla = bloque)
//   2   | 102          | sencilla | Nombre 1\nNombre 2
//
// Solo se usa en el navegador (exceljs se carga bajo demanda).

export type HabitacionArchivo = {
  bloque: string
  numero: string
  piso: number
  tipo_cama: string
  capacidad: number
  nombres: string[]
}

export type HabitacionExport = {
  numero: string
  piso: number
  bloque: string
  tipo_cama: string
  personas: string[]
}

async function cargarExcelJS() {
  const mod: any = await import('exceljs')
  return mod.default ?? mod
}

function norm(s: string): string {
  return (s || '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').trim()
}

function textoCelda(cell: any): string {
  if (!cell) return ''
  const t = cell.text
  return typeof t === 'string' ? t.replace(/\r/g, '').trim() : String(t ?? '').trim()
}

// Calcula cuántas personas caben según la descripción de las camas.
export function capacidadSegunCamas(tipo: string): number {
  const t = norm(tipo)
  if (!t) return 1
  let base = 1
  if (/dos camas|2 camas/.test(t)) base = 2
  else if (/doble|semi ?doble|camarote|litera/.test(t)) base = 2
  if (/auxiliar/.test(t)) base += 1
  return base
}

export function pisoSegunNumero(numero: string): number {
  const n = parseInt(String(numero).replace(/\D/g, ''), 10)
  if (!Number.isFinite(n)) return 1
  return n >= 100 ? Math.floor(n / 100) : 1
}

export async function leerExcelHabitaciones(archivo: File): Promise<HabitacionArchivo[]> {
  const ExcelJS = await cargarExcelJS()
  const wb = new ExcelJS.Workbook()
  await wb.xlsx.load(await archivo.arrayBuffer())
  const ws = wb.worksheets[0]
  if (!ws) throw new Error('El archivo no tiene hojas.')

  // 1. Buscar la fila de títulos (la que dice "HABITACIONES" y "NOMBRE")
  let filaTitulos = 0
  let colHab = 2, colCamas = 3, colNombres = 4
  for (let r = 1; r <= Math.min(ws.rowCount, 20) && !filaTitulos; r++) {
    const fila = ws.getRow(r)
    let h = 0, c = 0, n = 0
    fila.eachCell({ includeEmpty: false }, (cell: any, col: number) => {
      const v = norm(textoCelda(cell))
      if (!h && v.startsWith('habitacion')) h = col
      else if (!c && v.startsWith('cama')) c = col
      else if (!n && v.includes('nombre')) n = col
    })
    if (h && n) { filaTitulos = r; colHab = h; colNombres = n; if (c) colCamas = c }
  }
  if (!filaTitulos) {
    throw new Error('No encontré la fila de títulos. La primera hoja debe tener las columnas "HABITACIONES", "CAMAS" y "NOMBRE RESERVACION", como en la plantilla.')
  }

  // 2. Recorrer: filas sin número de habitación = nombre de bloque
  const salida: HabitacionArchivo[] = []
  const vistos = new Set<string>()
  let bloque = 'General'
  for (let r = filaTitulos + 1; r <= ws.rowCount; r++) {
    const fila = ws.getRow(r)
    const celdaHab = fila.getCell(colHab)
    // En las filas de bloque las celdas están combinadas (A:D) y exceljs
    // repite el texto en todas; también se descarta un "número" sin dígitos.
    const combinada = celdaHab.isMerged && celdaHab.master && celdaHab.master !== celdaHab
    const numero = combinada ? '' : textoCelda(celdaHab)
    if (!numero || !/\d/.test(numero)) {
      // ¿Es una fila de bloque? (texto en cualquier celda de la fila)
      let texto = ''
      fila.eachCell({ includeEmpty: false }, (cell: any) => { if (!texto) texto = textoCelda(cell) })
      if (texto && !/^\d+$/.test(texto)) bloque = texto.replace(/\s+/g, ' ').trim()
      continue
    }
    if (vistos.has(numero)) continue
    vistos.add(numero)
    const tipo = textoCelda(fila.getCell(colCamas))
    const nombres = textoCelda(fila.getCell(colNombres))
      .split(/\n|;/)
      .map(s => s.replace(/\s+/g, ' ').trim())
      .filter(Boolean)
    salida.push({
      bloque,
      numero,
      piso: pisoSegunNumero(numero),
      tipo_cama: tipo,
      capacidad: Math.max(capacidadSegunCamas(tipo), nombres.length, 1),
      nombres,
    })
  }
  if (salida.length === 0) throw new Error('No encontré habitaciones en el archivo.')
  return salida
}

export async function descargarExcelHabitaciones(habitaciones: HabitacionExport[], nombreArchivo: string) {
  const ExcelJS = await cargarExcelJS()
  const wb = new ExcelJS.Workbook()
  const ws = wb.addWorksheet('HABITACIONES')
  ws.columns = [
    { key: 'no', width: 6.5 },
    { key: 'hab', width: 13 },
    { key: 'camas', width: 34 },
    { key: 'nombres', width: 51 },
  ]

  const borde = { style: 'thin', color: { argb: 'FF000000' } }
  const bordes = { top: borde, left: borde, bottom: borde, right: borde }

  const titulos = ws.addRow(['No.', 'HABITACIONES', 'CAMAS', 'NOMBRE RESERVACION'])
  titulos.eachCell((c: any) => {
    c.font = { bold: true }
    c.alignment = { horizontal: 'center', vertical: 'middle' }
    c.border = bordes
  })

  // Orden: por piso y número; los bloques en el orden en que aparecen
  const ordenadas = [...habitaciones].sort((a, b) =>
    a.piso - b.piso || (parseInt(a.numero, 10) || 0) - (parseInt(b.numero, 10) || 0) || a.numero.localeCompare(b.numero))
  const bloques: string[] = []
  for (const h of ordenadas) if (!bloques.includes(h.bloque)) bloques.push(h.bloque)
  // "General" (sin franja) va primero, para que al volver a subir el archivo
  // esas habitaciones no queden dentro del bloque anterior.
  bloques.sort((a, b) => (a === 'General' ? -1 : b === 'General' ? 1 : 0))

  let contador = 0
  for (const bloque of bloques) {
    // Las habitaciones sin bloque ("General") van sin franja, como la 101 de la plantilla
    if (bloque !== 'General') {
      const filaBloque = ws.addRow([bloque, '', '', ''])
      ws.mergeCells(filaBloque.number, 1, filaBloque.number, 4)
      const c = filaBloque.getCell(1)
      c.font = { bold: true }
      c.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFFFFF00' } }
      c.alignment = { horizontal: 'center', vertical: 'middle' }
      c.border = bordes
    }

    for (const h of ordenadas.filter(x => x.bloque === bloque)) {
      contador++
      const num = /^\d+$/.test(h.numero) ? Number(h.numero) : h.numero
      const fila = ws.addRow([contador, num, h.tipo_cama || '', h.personas.join('\n')])
      fila.eachCell({ includeEmpty: true }, (cell: any, col: number) => {
        cell.border = bordes
        cell.alignment = { vertical: 'middle', wrapText: true, horizontal: col <= 2 ? 'center' : 'left' }
      })
      if (h.personas.length > 1) fila.height = 15 * h.personas.length + 2
    }
  }

  const buffer = await wb.xlsx.writeBuffer()
  const blob = new Blob([buffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = nombreArchivo
  document.body.appendChild(a)
  a.click()
  a.remove()
  setTimeout(() => URL.revokeObjectURL(url), 2000)
}

// Nombre de archivo seguro: "X Retiro Effetá Mazuren - Habitaciones.xlsx"
export function nombreArchivoSeguro(base: string, extension: string): string {
  const limpio = (base || 'Retiro').replace(/[\\/:*?"<>|]+/g, ' ').replace(/\s+/g, ' ').trim()
  return `${limpio}.${extension}`
}
