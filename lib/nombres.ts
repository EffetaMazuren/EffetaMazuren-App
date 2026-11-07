// Utilidades para comparar nombres de personas escritos a mano
// (con o sin tildes, mayúsculas, dobles espacios, nombres incompletos).

export function normalizarNombre(s: string): string {
  return (s || '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9ñ\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
}

const CONECTORES = new Set(['de', 'del', 'la', 'las', 'los', 'y', 'van', 'von'])

export function tokensNombre(s: string): string[] {
  return normalizarNombre(s)
    .split(' ')
    .filter(t => t.length > 1 && !CONECTORES.has(t))
}

// Puntaje de parecido entre dos nombres:
//   100 → idénticos (ignorando tildes/mayúsculas/espacios)
//    80 → todas las palabras de uno están en el otro y comparten ≥ 2 palabras
//         (ej. "Juan Pérez" vs "Juan Carlos Pérez Gómez")
//     0 → no se consideran la misma persona
export function puntajeNombre(a: string, b: string): number {
  const nA = normalizarNombre(a)
  const nB = normalizarNombre(b)
  if (!nA || !nB) return 0
  if (nA === nB) return 100
  const tA = tokensNombre(a)
  const tB = tokensNombre(b)
  const comunes = tA.filter(t => tB.includes(t)).length
  if (comunes < 2) return 0
  const corto = tA.length <= tB.length ? tA : tB
  const largo = tA.length <= tB.length ? tB : tA
  if (corto.every(t => largo.includes(t))) return 80
  return 0
}

export function soloDigitos(s: string): string {
  return (s || '').replace(/\D/g, '')
}
