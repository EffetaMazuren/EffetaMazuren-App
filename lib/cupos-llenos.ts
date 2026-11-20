// Texto por defecto del correo de "cupos llenos" y cómo se personaliza.
// Marcadores que se reemplazan para cada persona:
//   {nombre} → primer nombre del caminante
//   {retiro} → nombre del retiro activo (p. ej. "X Retiro Effetá Mazuren")

export const ASUNTO_CUPOS_LLENOS_DEFECTO = 'Gracias por inscribirte al {retiro} 💙'

export const TEXTO_CUPOS_LLENOS_DEFECTO = `Hola, {nombre}:

Te enviamos un saludo de parte de Effetá Mazuren.

Queremos contarte que ya llenamos todos los cupos del {retiro}, por lo que ya no estamos recibiendo más pagos.

Aun así, te esperamos en el siguiente retiro con los brazos abiertos, para poder vivir contigo una experiencia que valdrá toda la pena.

Si tienes cualquier duda, estaremos súper atentos.

¡Mil gracias por haberte inscrito a este retiro!

Que Dios te bendiga,
Effetá Jesucristo Redentor`

export function primerNombre(nombreCompleto: string): string {
  const p = (nombreCompleto || '').trim().split(/\s+/)[0] || ''
  if (!p) return ''
  return p.charAt(0).toUpperCase() + p.slice(1).toLowerCase()
}

export function personalizar(plantilla: string, nombreCompleto: string, nombreRetiro: string): string {
  return plantilla
    .replace(/\{nombre\}/g, primerNombre(nombreCompleto))
    .replace(/\{retiro\}/g, nombreRetiro)
}
