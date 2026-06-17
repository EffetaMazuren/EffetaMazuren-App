'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'

type Tab = 'minutominuto' | 'roles' | 'manual'
type Dia = 'viernes' | 'sabado' | 'domingo'

interface Actividad {
  hora: string
  actividad: string
  encargado: string
  detalle?: string
  tipo?: 'charla' | 'actividad' | 'comida' | 'logistica' | 'espiritual'
}

const MINUTO_MINUTO: Record<Dia, { bloques: { titulo: string; camiseta?: string; items: Actividad[] }[] }> = {
  viernes: {
    bloques: [
      {
        titulo: 'Pre-retiro',
        items: [
          { hora: '9:30 AM', actividad: 'Llegada a la casa de retiros', encargado: 'Equipo de servidores', tipo: 'logistica' },
          { hora: '10:00 AM', actividad: 'Primera reunión de coordinación', encargado: 'Líder joven y adulto de logística', detalle: 'Colgar cuadro de equipos y minuto a minuto en logística. Colgar pendones en salón de conferencias. Organizar salón de logística con materiales separados por día y el cuarto de palancas.', tipo: 'logistica' },
          { hora: '11:00 AM', actividad: 'Equipos se dividen para organizar la casa', encargado: 'Cada equipo asignado', detalle: 'Llevar parlantes pequeños para sonido permanente en el Santísimo.', tipo: 'logistica' },
          { hora: '12:00 PM', actividad: 'Almuerzo', encargado: 'Todos los servidores', tipo: 'comida' },
          { hora: '1:00 PM', actividad: 'Revisión actividad Camino de la Vida', encargado: 'Equipo camino de la vida', detalle: 'Revisar terreno, dónde se realizará la actividad y dónde se enredarán las cuerdas.', tipo: 'actividad' },
          { hora: '1:00 PM', actividad: 'Alistar mesas de llegada', encargado: 'Equipo de recepción', detalle: 'Dos mesas: una para hombres, una para mujeres. Escarapelas listas, bolsas ziploc con etiquetas para celulares y relojes. Lista de caminantes lista.', tipo: 'logistica' },
          { hora: '1:15 PM', actividad: 'Llamar a caminantes — última bienvenida', encargado: 'Servidores de mesa', detalle: 'Listado impreso por mesa con nombres, teléfonos, invitado por, celular del invitante. Recordarles invitar familia el domingo a la misa.', tipo: 'logistica' },
          { hora: '2:30 PM', actividad: 'Confesiones del sacerdote encargado', encargado: 'Sacerdote', detalle: 'Organizar orden de confesiones con planilla.', tipo: 'espiritual' },
          { hora: '3:30 PM', actividad: 'Exposición del Santísimo', encargado: 'Sacerdote / Ministro', detalle: 'Dos personas encargadas de que nunca esté el Santísimo solo. Música sacra, silencio. Entregar invitaciones al Santísimo a cada servidor con horario impreso.', tipo: 'espiritual' },
          { hora: '3:50 PM', actividad: 'Preparación para recibir caminantes — maletas', encargado: 'Equipo de maleteros', detalle: 'Identificar cada maleta con sticker: nombre del caminante y número de habitación. Si llega alguien sin inscripción ni pago, debe ser recibido igual.', tipo: 'logistica' },
          { hora: '5:30 PM', actividad: 'Recepción de caminantes', encargado: 'Equipo de recepción', detalle: 'Líder de logística entrega a coordinadores de mesa el listado recortado de su mesa y número de habitación. Cada coordinador lo conserva en su escarapela.', tipo: 'logistica' },
          { hora: '5:30 PM', actividad: 'Picadita de recepción', encargado: 'Equipo de snacks', detalle: 'Verificar que caminantes no estén solos. Todos los servidores sin función en recepción deben estar con los caminantes.', tipo: 'comida' },
        ]
      },
      {
        titulo: 'Noche',
        camiseta: 'Saco de Effetá — todo el equipo',
        items: [
          { hora: '6:15 PM', actividad: 'Tocar la campana', encargado: 'Campanero', detalle: 'Guiar caminantes al salón de conferencias.', tipo: 'logistica' },
          { hora: '6:20 PM', actividad: 'Bienvenida y explicación del retiro', encargado: 'Joven y adulto', detalle: 'Anexo A3.', tipo: 'espiritual' },
          { hora: '6:30 PM', actividad: 'Explicación de la campana', encargado: 'Campanero', detalle: 'Anexo A4. Alistar velas y música para ejercicio de la luz.', tipo: 'logistica' },
          { hora: '7:37 PM', actividad: 'Reglas del retiro', encargado: 'Coordinador Joven', detalle: 'Anexo A5.', tipo: 'logistica' },
          { hora: '7:40 PM', actividad: 'Explicación de la confidencialidad', encargado: 'Adulto', detalle: 'Anexo A6. Lo que aquí se dice, aquí se queda.', tipo: 'espiritual' },
          { hora: '7:43 PM', actividad: 'Lectura completa del pasaje de Effetá', encargado: 'Adulto encargado', detalle: 'Marcos 7, 31-37. Anexo A7.', tipo: 'espiritual' },
          { hora: '7:50 PM', actividad: 'Asignación de mesas', encargado: 'Coordinador Logístico', detalle: 'Ir pasando por mesas al comedor.', tipo: 'logistica' },
          { hora: '8:10 PM', actividad: 'Ejercicio de la luz — Enciende una luz', encargado: 'Encargado + líderes de mesa', detalle: 'Velas al comedor, una a cada servidor de mesa. Apagar luces. Canción: "Enciende una luz". Servidor joven hace breve reflexión sobre el sentido de la luz como inicio del retiro. Anexo A8.', tipo: 'actividad' },
          { hora: '8:15 PM', actividad: 'Cena — Bendición de alimentos', encargado: 'Servidor Joven', detalle: 'Relacionar oración con el pasaje de Effetá.', tipo: 'comida' },
          { hora: '8:50 PM', actividad: 'Presentaciones individuales por mesas', encargado: 'Líderes y co-líderes de mesa', detalle: 'Cada persona expone su razón de estar en el retiro. Inician servidores de mesa 1. Al final presentan servidores sin mesa y adultos. Los servidores no deben extenderse.', tipo: 'espiritual' },
          { hora: '9:40 PM', actividad: 'Break', encargado: 'Adulto (último en presentarse)', detalle: 'Tiempo para sacos y baño.', tipo: 'logistica' },
          { hora: '9:45 PM', actividad: 'Tocar campana — pasar al salón de conferencias', encargado: 'Campanero', tipo: 'logistica' },
          { hora: '9:45 PM', actividad: 'Organizar actividad Camino de la Vida', encargado: 'Equipo camino de la vida', detalle: 'Ir por cuerdas y blinds al salón de logística. Preparar la ruta.', tipo: 'logistica' },
          { hora: '9:50 PM', actividad: 'Explicación de palanquitas', encargado: 'Servidor Joven', detalle: 'Anexo A9.', tipo: 'espiritual' },
          { hora: '9:55 PM', actividad: 'Explicación de por qué cantamos orando', encargado: 'Servidor Joven', detalle: 'Anexo A10. Canción: "Ven Espíritu Ven" (versión original completa).', tipo: 'espiritual' },
          { hora: '9:55 PM', actividad: 'CHARLA 1: Autosuficiencia', encargado: 'Encargado del testimonio', detalle: 'Anexo A11. Entregar guía del testimonio con anticipación.', tipo: 'charla' },
          { hora: '10:30 PM', actividad: 'Música y tiempo para meditar', encargado: 'Equipo música', tipo: 'espiritual' },
          { hora: '10:35 PM', actividad: 'Lectura 1 del pasaje de Effetá', encargado: 'Adulto encargado', detalle: 'Pasaje y reflexión No.1. Anexo A12.', tipo: 'espiritual' },
          { hora: '10:45 PM', actividad: 'Poner palanquitas en camas de caminantes', encargado: 'Servidor Joven', detalle: 'Ir por palanquitas de piedras al salón de logística.', tipo: 'logistica' },
          { hora: '10:45 PM', actividad: 'Organizar fogata', encargado: 'Equipo música', detalle: 'Instalar micrófono con parlantes en el sitio de la fogata.', tipo: 'logistica' },
          { hora: '10:45 PM', actividad: 'Explicación del Camino de la Vida', encargado: 'Servidor Joven', detalle: 'Anexo A13. Solo decir: "Van a vendarse los ojos, confíen."', tipo: 'actividad' },
          { hora: '10:50 PM', actividad: 'Ejercicio: Camino de la Vida', encargado: 'Equipo camino de la vida', detalle: '10 ponen blinds / 2 sacan del salón / mismos 10 guían a la cuerda / 10 en la ruta / resto reciben en fogata.', tipo: 'actividad' },
          { hora: '11:10 PM', actividad: 'Llegada a la fogata', encargado: 'Servidores en fogata', detalle: 'Recibir y compartir con caminantes. Recoger blinds y cuerdas al salón de logística.', tipo: 'actividad' },
          { hora: '11:15 PM', actividad: 'Compartir — 4 caminantes cuentan su experiencia', encargado: 'Servidor Joven', detalle: 'Recordar confidencialidad.', tipo: 'espiritual' },
          { hora: '11:35 PM', actividad: 'Reglas de la noche e invitación al silencio', encargado: 'Servidor Joven', detalle: 'Anexo A14. Voto de silencio hasta mañana. Servidores dan el ejemplo. Nadie visita cuartos ajenos.', tipo: 'logistica' },
          { hora: '12:00 AM', actividad: 'Reunión de servidores', encargado: 'Coordinador joven y de logística', detalle: 'Casos especiales por mesa. Recordar turnos del Santísimo. Invitación al rosario 6:30 AM.', tipo: 'logistica' },
          { hora: '12:30 AM', actividad: 'Práctica actividad de máscaras', encargado: '4H + 4M + adulto encargado + 2 lectores', detalle: 'Dejar salón y materiales listos. Adulto lidera ensayo. Anexo A16.', tipo: 'actividad' },
        ]
      }
    ]
  },
  sabado: {
    bloques: [
      {
        titulo: 'Mañana',
        camiseta: 'Camiseta roja — Esperanza y amor',
        items: [
          { hora: '6:30 AM', actividad: 'Santo Rosario', encargado: 'Servidor adulto/joven', detalle: 'Voluntario. Campanero despierta puerta a puerta.', tipo: 'espiritual' },
          { hora: '7:00 AM', actividad: 'Despertar servidores que no fueron al rosario', encargado: 'Campanero', detalle: 'Ir puerta a puerta.', tipo: 'logistica' },
          { hora: '7:30 AM', actividad: 'Música para despertar caminantes', encargado: 'Equipo música', detalle: 'Canción: "No tengo miedo".', tipo: 'logistica' },
          { hora: '8:00 AM', actividad: 'Tocar campana — todos a la capilla', encargado: 'Campanero', detalle: 'Servidores de mesa aseguran que sus caminantes lleguen.', tipo: 'logistica' },
          { hora: '8:10 AM', actividad: 'Oración para comenzar el día', encargado: 'Servidor Joven', detalle: 'Relacionar con la narración de Effetá. Recordar confidencialidad.', tipo: 'espiritual' },
          { hora: '8:15 AM', actividad: 'Explicación del Santísimo', encargado: 'Servidor Adulto', detalle: 'Anexo A15.', tipo: 'espiritual' },
          { hora: '8:20 AM', actividad: 'Entrega palanquita del Santísimo', encargado: 'Servidor Joven', detalle: 'Invitar a desayunar.', tipo: 'espiritual' },
          { hora: '8:25 AM', actividad: 'Bendición de alimentos', encargado: 'Servidor Joven', tipo: 'comida' },
          { hora: '8:30 AM', actividad: 'Desayuno', encargado: '', tipo: 'comida' },
          { hora: '9:15 AM', actividad: 'Foto grupal', encargado: 'Fotógrafo / Coordinador logística', detalle: 'Sacar caminantes en orden de mesas. Adulto organiza en el sitio. Luego foto de servidores.', tipo: 'logistica' },
          { hora: '9:30 AM', actividad: 'Break', encargado: '', detalle: 'Lavarse dientes. Foto de servidores.', tipo: 'logistica' },
          { hora: '9:40 AM', actividad: 'Tocar campana — salón de conferencias', encargado: 'Campanero', tipo: 'logistica' },
          { hora: '9:40 AM', actividad: 'Alistar ejercicio de máscaras', encargado: 'Equipo máscaras', detalle: 'No entran al salón — van por máscaras y velas al salón de logística.', tipo: 'logistica' },
          { hora: '9:45 AM', actividad: 'Resumen del día anterior', encargado: 'Servidor Joven', detalle: 'Breve resumen de testimonios y actividades del viernes.', tipo: 'espiritual' },
          { hora: '9:55 AM', actividad: 'Ejercicio de máscaras', encargado: 'Equipo máscaras', detalle: 'Anexo A16. Encargado de materiales trae máscaras adhesivas y esferos para "Quitarse las máscaras".', tipo: 'actividad' },
          { hora: '10:15 AM', actividad: 'CHARLA 2: Descubriéndome', encargado: 'Encargado del testimonio', detalle: 'Anexo A17.', tipo: 'charla' },
          { hora: '11:00 AM', actividad: 'Música y tiempo para meditar', encargado: 'Equipo música', tipo: 'espiritual' },
          { hora: '11:10 AM', actividad: 'Actividad: Quitarse las máscaras', encargado: 'Servidores de mesa / Coordinador logística', detalle: 'Salir por mesas. Entregar esfero y máscara adhesiva a cada uno. Escribir, compartir, romper la máscara. Anexo A18.', tipo: 'actividad' },
          { hora: '12:00 PM', actividad: 'Break', encargado: 'Equipo snacks', detalle: 'Solo bebidas.', tipo: 'comida' },
          { hora: '12:10 PM', actividad: 'Tocar campana — salón de conferencias', encargado: 'Campanero', tipo: 'logistica' },
          { hora: '12:15 PM', actividad: 'CHARLA 3: Mi primer llamado y reconocido por Dios', encargado: 'Encargado del testimonio', detalle: 'Anexo A19.', tipo: 'charla' },
          { hora: '1:00 PM', actividad: 'Tiempo para meditar', encargado: 'Equipo música', tipo: 'espiritual' },
          { hora: '1:05 PM', actividad: 'Lectura 2 del pasaje de Effetá', encargado: 'Adulto encargado', detalle: 'Pasaje y reflexión No.2. Anexo A20.', tipo: 'espiritual' },
          { hora: '1:15 PM', actividad: 'Pasar al comedor', encargado: 'Servidor Joven', tipo: 'logistica' },
          { hora: '1:20 PM', actividad: 'Bendición de alimentos — almuerzo', encargado: 'Servidor Joven', tipo: 'comida' },
          { hora: '2:00 PM', actividad: 'Break', encargado: 'Coordinador logística', detalle: 'Lavarse dientes y baño.', tipo: 'logistica' },
        ]
      },
      {
        titulo: 'Tarde y Noche',
        items: [
          { hora: '2:10 PM', actividad: 'Tocar campana — todos al salón', encargado: 'Campanero', tipo: 'logistica' },
          { hora: '2:10 PM', actividad: 'Organizar ejercicio El muro y el nudo', encargado: 'Equipo muro y nudo', detalle: 'Ubicar puntos donde estarán los caminantes parados.', tipo: 'logistica' },
          { hora: '2:10 PM', actividad: 'CHARLA 4: El templo del alma', encargado: 'Encargado del testimonio', detalle: 'Anexo A21. Incluye tema de castidad.', tipo: 'charla' },
          { hora: '2:50 PM', actividad: 'Tiempo para meditar', encargado: 'Equipo música', detalle: 'Colocar velas para ejercicio del perdón. Equipo del perdón pasivo se retira a prepararse. Canción: Tilma de Guadalupe.', tipo: 'espiritual' },
          { hora: '2:55 PM', actividad: 'Ejercicio: El perdón pasivo', encargado: 'Equipo ejercicio del perdón', detalle: 'Orden: amigo(a), novio(a), hermano, hermana, papá, mamá. Música de fondo: sube entre personajes, baja mientras hablan. Anexo A22a.', tipo: 'actividad' },
          { hora: '3:10 PM', actividad: 'Tiempo para meditar', encargado: 'Equipo música', detalle: 'Equipo de palanquitas va por hojas y esferos al salón de logística.', tipo: 'espiritual' },
          { hora: '3:15 PM', actividad: 'Ejercicio: El perdón activo', encargado: 'Equipo ejercicio del perdón', detalle: 'Misma música. Caminantes piden perdón mentalmente. Anexo A22b.', tipo: 'actividad' },
          { hora: '3:30 PM', actividad: 'Oración de sanación', encargado: 'Sacerdote (ideal)', detalle: 'Anexo A23. Bajar intensidad de luz, música de fondo.', tipo: 'espiritual' },
          { hora: '3:30 PM', actividad: 'Refrigerio', encargado: 'Equipo snacks', tipo: 'comida' },
          { hora: '3:45 PM', actividad: 'Tocar campana — pasar al Santísimo', encargado: 'Campanero', tipo: 'logistica' },
          { hora: '3:55 PM', actividad: 'Actividad: Sanando mi alma', encargado: '2 servidores jóvenes', detalle: 'Oración al Espíritu Santo. Leer preguntas lentamente, 30 seg entre cada una. Respuestas escritas en papel confidencial. Pedirles guardar el papel. Resto de servidores afuera preparando el muro. Anexo A24.', tipo: 'actividad' },
          { hora: '4:25 PM', actividad: 'Recordar confidencialidad — pasar al salón', encargado: 'Servidor Joven (mismo de Charla 4)', detalle: 'Equipo palanquitas recoge Biblias en logística y las lleva al salón.', tipo: 'logistica' },
          { hora: '4:25 PM', actividad: 'CHARLA 5: Significado de los Sacramentos', encargado: 'Sacerdote', detalle: 'Anexo A25. Debe ser un religioso/sacerdote/seminarista.', tipo: 'charla' },
          { hora: '5:10 PM', actividad: 'Tiempo para meditar', encargado: 'Equipo música', tipo: 'espiritual' },
          { hora: '5:15 PM', actividad: 'Entrega de la Biblia', encargado: 'Equipo palanquitas', detalle: 'Con palanquita "Llamados de emergencia".', tipo: 'espiritual' },
          { hora: '5:20 PM', actividad: 'Lectio Divina — Hijo Pródigo (Lucas 15, 11-32)', encargado: 'Coordinador logística', detalle: 'Salir por mesas a lugar de preferencia. Cuatro pasos: Lectura, Meditación, Oración, Contemplación. Entregar cartillas. Anexo A26.', tipo: 'espiritual' },
          { hora: '6:05 PM', actividad: 'Cena', encargado: 'Campanero / todos los servidores', detalle: 'Todos llaman a los caminantes.', tipo: 'comida' },
          { hora: '6:10 PM', actividad: 'Bendición de alimentos', encargado: 'Servidor Joven', tipo: 'comida' },
          { hora: '6:10 PM', actividad: 'Tener listo el ejercicio El muro y el nudo', encargado: 'Equipo muro y nudo', detalle: 'Muro marcado en el piso. Cada sacerdote con vela pequeña y tijeras para cortar el nudo. Salir antes de que termine la comida.', tipo: 'logistica' },
          { hora: '6:50 PM', actividad: 'Pasar al salón de conferencias', encargado: 'Servidor', detalle: 'NO en el Santísimo.', tipo: 'logistica' },
          { hora: '6:50 PM', actividad: 'CHARLA 6: En Ti confío', encargado: 'Encargado del testimonio', detalle: 'Anexo A27.', tipo: 'charla' },
          { hora: '7:30 PM', actividad: 'Tiempo para meditar', encargado: 'Equipo música', tipo: 'espiritual' },
          { hora: '7:30 PM', actividad: 'Actividad: El muro y el nudo', encargado: 'Equipo muro y nudo', detalle: 'Roles: 8 ponen blinds y sacan caminantes. 1 adulto dice a quién sacar. 1 adulto muestra dónde parar. Los mismos los llevan a confesiones. 2 personas distribuyen en sacerdotes. 6 llevan al salón de palancas. 4 llevan de palancas a fogata. Equipo recibe en fogata. Grabación de audio: "El muro y el nudo". Anexo A28.', tipo: 'actividad' },
          { hora: '8:30 PM', actividad: 'Palancas — lectura de cartas', encargado: 'Equipo de palancas + 2 adultos', detalle: 'Organizar salón con kleenex y agua.', tipo: 'espiritual' },
          { hora: '9:30 PM', actividad: 'Fogata', encargado: 'Equipo música + servidores', detalle: 'Refrigerio en fogata. Recibir caminantes, compartir, quemar papeles de pecados, oración de agradecimiento. Invitar al rosario del domingo.', tipo: 'espiritual' },
          { hora: '10:30 PM', actividad: 'Mini snack, abrazos, acogida', encargado: 'Equipo snacks', detalle: 'Listo antes de las 12:00.', tipo: 'comida' },
          { hora: '11:00 PM', actividad: 'Selección de mantelitos', encargado: 'Servidores', detalle: 'Coordinadores de mesa escogen mantelitos y los llevan al comedor. Las mismas 8 personas se ubican en otra mesa del comedor.', tipo: 'logistica' },
          { hora: '11:15 PM', actividad: 'Dormir', encargado: '', tipo: 'logistica' },
        ]
      }
    ]
  },
  domingo: {
    bloques: [
      {
        titulo: 'Mañana',
        camiseta: 'Camiseta blanca',
        items: [
          { hora: '6:30 AM', actividad: 'Rosario', encargado: 'Servidor adulto y joven', detalle: 'Campanero despierta servidores y caminantes que quieran ir.', tipo: 'espiritual' },
          { hora: '7:00 AM', actividad: 'Despertar servidores', encargado: 'Campanero', tipo: 'logistica' },
          { hora: '7:30 AM', actividad: 'Despertar caminantes', encargado: 'Equipo música', detalle: 'Canción: "Ángeles".', tipo: 'logistica' },
          { hora: '8:30 AM', actividad: 'Tocar campana — todos al Santísimo', encargado: 'Campanero', tipo: 'logistica' },
          { hora: '8:35 AM', actividad: 'Oración de inicio', encargado: 'Servidor Joven', detalle: 'Énfasis en Effetá. Invitar al comedor: mismas 8 personas, mesa diferente.', tipo: 'espiritual' },
          { hora: '8:40 AM', actividad: 'Desayuno', encargado: '', detalle: 'Servidores vigilar que caminantes NO levanten los mantelitos.', tipo: 'comida' },
          { hora: '8:40 AM', actividad: 'Bendición de alimentos', encargado: 'Caminante escogido por el líder', tipo: 'comida' },
          { hora: '9:10 AM', actividad: 'Actividad: Mantelitos', encargado: 'Servidor Joven', detalle: 'Servidor comparte primero su mantelito con descripción del dibujo y cómo lo interpreta en su vida. Los demás servidores intervienen solo si baja el interés. Impulsar a caminantes a compartir. "Dios tiene un mensaje personal para nosotros." Anexo A29.', tipo: 'actividad' },
          { hora: '10:00 AM', actividad: 'Break', encargado: 'Coordinador adulto', detalle: 'Lavarse dientes.', tipo: 'logistica' },
          { hora: '10:15 AM', actividad: 'Pasar al salón de conferencias', encargado: 'Coordinador adulto', tipo: 'logistica' },
          { hora: '10:15 AM', actividad: 'Resumen día anterior', encargado: 'Encargado del resumen', tipo: 'espiritual' },
          { hora: '10:20 AM', actividad: 'CHARLA 7: Sed de Dios', encargado: 'Encargado del testimonio', detalle: 'Anexo A30.', tipo: 'charla' },
          { hora: '11:00 AM', actividad: 'Música, meditación y Lectura 3 del pasaje', encargado: 'Equipo música / Adulto encargado', detalle: 'Equipo palanquitas lleva hojas y lápices al Santísimo. Reflexión No.3. Anexo A31.', tipo: 'espiritual' },
          { hora: '11:10 AM', actividad: 'CHARLA 8: Mi Effetá y el servicio', encargado: 'Encargado del testimonio', detalle: 'Anexo A32.', tipo: 'charla' },
          { hora: '11:50 AM', actividad: 'Música y meditación — pasar al Santísimo', encargado: 'Campanero / Equipo música', tipo: 'espiritual' },
          { hora: '11:50 AM', actividad: 'Ejercicio: Carta de Jesús', encargado: 'Equipo palanquitas', detalle: 'Oración al Espíritu Santo primero. Repartir papel y esfero. ~20 min. La carta va en sobre con nombre completo y dirección del caminante. Se envía por correo meses después. Opcionalmente carta a los papás. Anexo A33.', tipo: 'actividad' },
          { hora: '1:30 PM', actividad: 'Almuerzo', encargado: 'Servidor Joven', tipo: 'comida' },
          { hora: '1:35 PM', actividad: 'Bendición de alimentos', encargado: 'Sacerdote', tipo: 'comida' },
        ]
      },
      {
        titulo: 'Tarde — Cierre',
        items: [
          { hora: '2:10 PM', actividad: 'Tocar campana — salón de conferencias', encargado: 'Campanero', detalle: 'Equipo palanquitas organiza bolsas de caminantes: agua bendita, camiseta, CD, rosario.', tipo: 'logistica' },
          { hora: '2:15 PM', actividad: 'Lectura 4 del pasaje de Effetá', encargado: 'Adulto encargado', detalle: 'Pasaje y reflexión No.4. Anexo A34.', tipo: 'espiritual' },
          { hora: '2:25 PM', actividad: 'Explicar oración de intercesión', encargado: 'Servidor', detalle: 'Salir por mesas. Una Biblia por mesa. Coordinadores escogen sitio. Servidores sin mesa en el Santísimo.', tipo: 'logistica' },
          { hora: '2:30 PM', actividad: 'Oración de intercesión', encargado: 'Coordinadores de mesa', detalle: 'Servidores de mesa van por las bolsas de sus caminantes. Están afuera del salón de conferencias. Anexo A35.', tipo: 'espiritual' },
          { hora: '3:45 PM', actividad: 'Se guarda el Santísimo', encargado: 'Sacerdote', detalle: 'Todos en el Santísimo. Lectura completa del pasaje sin reflexión.', tipo: 'espiritual' },
          { hora: '3:50 PM', actividad: 'Dinámica del perdón de servidores', encargado: 'Todos los servidores', detalle: '7 servidores representantes (palanquitas, palancas, mesas, música, líder joven, logística joven, adulto coordinador) piden perdón por errores reales cometidos. Si hay tiempo pasan todos. Actividad en el Santísimo. Anexo A36.', tipo: 'espiritual' },
          { hora: '4:00 PM', actividad: 'Preparación de la misa', encargado: 'Ministro', detalle: 'Escoger 3 caminantes lectores. Practicar "No tengo miedo". Imprimir letra si es posible. Escoger 4 servidores para ofrendas. Coordinar entrega de celulares/relojes y cartas a padres antes de la misa.', tipo: 'logistica' },
          { hora: '4:10 PM', actividad: 'Santa Misa de cierre', encargado: 'Sacerdote', detalle: 'Testimonio de caminantes. Agradecimiento y despedida por el líder joven.', tipo: 'espiritual' },
          { hora: '5:00 PM', actividad: 'Despedida', encargado: 'Todos', detalle: 'Bebidas y snack para todos a la salida.', tipo: 'comida' },
        ]
      }
    ]
  }
}

const ROLES_RETIRO = [
  {
    categoria: 'Liderazgo',
    color: '#0f1787',
    bg: '#f0f2ff',
    roles: [
      { nombre: 'Líder Joven', descripcion: 'Líder general del retiro. Guía, prepara y lidera todo. Escoge servidores, testimonios y roles. Custodio del manual.' },
      { nombre: 'Líder Adulto', descripcion: 'Apoya al líder joven. Coordina adultos acompañantes. Acompaña espiritualmente. No toma decisiones por los jóvenes.' },
      { nombre: 'Líder Logístico', descripcion: 'Organiza materiales, controla el inventario, vela por el cumplimiento del minuto a minuto durante el retiro.' },
      { nombre: 'Sacerdote', descripcion: 'Guía espiritual. Ofrece confesiones, da la charla de sacramentos, guarda el Santísimo, celebra la misa de cierre.' },
    ]
  },
  {
    categoria: 'Servidores de Mesa',
    color: '#16a34a',
    bg: '#f0fdf4',
    roles: [
      { nombre: 'Coordinador de Mesa (x2 por mesa)', descripcion: 'Acompañan a 6 caminantes durante todo el retiro. Un hombre y una mujer por mesa. Idealmente uno nuevo y uno experimentado.' },
      { nombre: 'Adulto acompañante de mesa', descripcion: 'Un adulto por 1-2 mesas. Apoyo en casos especiales. No protagonista.' },
    ]
  },
  {
    categoria: 'Equipos de Actividades',
    color: '#7c3aed',
    bg: '#faf5ff',
    roles: [
      { nombre: 'Equipo Camino de la Vida', descripcion: 'Monta las cuerdas (60m c/u), pone blinds, guía caminantes con ojos vendados, cuida la ruta. ~10 personas.' },
      { nombre: 'Equipo Máscaras', descripcion: '4 hombres y 4 mujeres jóvenes. Representan las 8 máscaras. Se aprenden los guiones de memoria. Ensayo en la noche del viernes.' },
      { nombre: 'Equipo del Perdón (Pasivo y Activo)', descripcion: 'Representan: novio/a, mejor amigo/a, hermano, hermana, papá, mamá. Leen guión con vela, arrodillados.' },
      { nombre: 'Equipo El muro y el nudo', descripcion: '8 ponen blinds y sacan caminantes. 2 adultos coordinan. 2 distribuyen en sacerdotes. 6 llevan al salón de palancas. 4 llevan de palancas a fogata.' },
    ]
  },
  {
    categoria: 'Equipos de Apoyo',
    color: '#d97706',
    bg: '#fffbeb',
    roles: [
      { nombre: 'Equipo de Música y Sonido', descripcion: 'Maneja todas las canciones del retiro, grabación del muro y nudo, música del Santísimo (greoriana). Debe conocer el minuto a minuto.' },
      { nombre: 'Equipo de Palancas', descripcion: 'Contacta familiares de caminantes para cartas. Lleva computador e impresora al retiro. Imprime cartas recibidas en el transcurso.' },
      { nombre: 'Equipo de Palanquitas', descripcion: 'Distribuye las palanquitas en las camas de caminantes. Reparte Biblias, hojas y esferos. Organiza bolsas del domingo.' },
      { nombre: 'Equipo de Snacks', descripcion: 'Compra y sirve snacks en los momentos indicados del retiro. Conoce el menú y el cronograma.' },
      { nombre: 'Equipo de Recepción / Maleteros', descripcion: 'Recibe caminantes a la llegada. Identifica maletas con stickers (nombre + habitación). Dos mesas: hombres y mujeres.' },
      { nombre: 'Campanero', descripcion: 'Controla los tiempos del retiro. Toca la campana para cada cambio de actividad o lugar. Despierta servidores y caminantes.' },
      { nombre: 'Equipo de Flores', descripcion: 'Compra y arregla flores para el Santísimo y centros de mesa del comedor.' },
      { nombre: 'Equipo de Santísimo', descripcion: 'Organiza turnos para que el Santísimo nunca esté solo. Al menos uno de los dos servidores de mesa siempre presente en testimonios.' },
      { nombre: 'Equipo de Compras Religiosas', descripcion: 'Biblias, palanquitas, rosarios, denarios, cartilla Lectio Divina, cuadro del rostro de Jesús, tarjetas para sacerdotes.' },
      { nombre: 'Equipo de Mantelitos', descripcion: 'Realiza los mantelitos con las citas bíblicas del manual. Un mensaje personal de Dios para cada caminante.' },
    ]
  },
  {
    categoria: 'Testimonios',
    color: '#dc2626',
    bg: '#fef2f2',
    roles: [
      { nombre: 'Charla 1 — Autosuficiencia', descripcion: 'Consecuencias de creer que no necesitamos a nadie, ni a Dios. Viernes noche.' },
      { nombre: 'Charla 2 — Descubriéndome', descripcion: 'Dios siempre ha estado presente en mi vida. Sábado mañana.' },
      { nombre: 'Charla 3 — Mi primer llamado', descripcion: 'El llamado de Dios incomoda y cambia rutinas. La oración como encuentro íntimo. Sábado mañana.' },
      { nombre: 'Charla 4 — El templo del alma', descripcion: 'Fe que cura el alma, espíritu y cuerpo. Incluye castidad. Sábado tarde.' },
      { nombre: 'Charla 5 — Significado de los Sacramentos', descripcion: 'Debe darla un sacerdote, religioso o seminarista. Sábado tarde.' },
      { nombre: 'Charla 6 — En Ti confío', descripcion: 'Confianza en Dios como bálsamo en el mundo contemporáneo. Sábado noche.' },
      { nombre: 'Charla 7 — Sed de Dios', descripcion: 'Alegría de quien ha sentido el amor de Dios y quiere comunicarlo. Domingo mañana.' },
      { nombre: 'Charla 8 — Mi Effetá y el servicio', descripcion: 'El llamado a predicar y servir. El servicio como sentido de la vida. Domingo mañana.' },
    ]
  }
]

const colorTipo: Record<string, { bg: string; color: string; label: string }> = {
  charla:    { bg: '#dc2626', color: 'white', label: 'Charla' },
  actividad: { bg: '#7c3aed', color: 'white', label: 'Actividad' },
  comida:    { bg: '#16a34a', color: 'white', label: 'Comida' },
  logistica: { bg: '#6b7280', color: 'white', label: 'Logística' },
  espiritual:{ bg: '#d97706', color: 'white', label: 'Espiritual' },
}

export default function RetiroDashboard() {
  const router = useRouter()
  const [tab, setTab] = useState<Tab>('minutominuto')
  const [diaActivo, setDiaActivo] = useState<Dia>('viernes')
  const [expandido, setExpandido] = useState<string | null>(null)

  const tabs: { id: Tab; label: string }[] = [
    { id: 'minutominuto', label: 'Minuto a Minuto' },
    { id: 'roles', label: 'Roles' },
    { id: 'manual', label: 'Manual' },
  ]

  const dias: { id: Dia; label: string; fecha: string }[] = [
    { id: 'viernes', label: 'Viernes', fecha: '3 Jul' },
    { id: 'sabado', label: 'Sabado', fecha: '4 Jul' },
    { id: 'domingo', label: 'Domingo', fecha: '5 Jul' },
  ]

  return (
    <div style={{ padding: '24px 16px', maxWidth: 700, margin: '0 auto' }}>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 24 }}>
        <div>
          <h1 style={{ fontSize: 20, fontWeight: 700, color: '#111827', margin: '0 0 4px' }}>
            IX Retiro Effeta Mazuren
          </h1>
          <p style={{ fontSize: 13, color: '#6b7280', margin: 0 }}>3, 4 y 5 de julio de 2026</p>
        </div>
        <button
          onClick={() => router.push('/dashboard')}
          style={{ background: '#f3f4f6', border: 'none', borderRadius: 8, padding: '8px 14px', fontSize: 13, cursor: 'pointer', color: '#374151' }}
        >← Dashboard</button>
      </div>

      {/* Tabs */}
      <div style={{ display: 'flex', gap: 6, marginBottom: 24, background: '#f3f4f6', borderRadius: 10, padding: 4 }}>
        {tabs.map(t => (
          <button
            key={t.id}
            onClick={() => setTab(t.id)}
            style={{
              flex: 1, padding: '8px 4px', border: 'none', borderRadius: 8, fontSize: 13, fontWeight: 600,
              cursor: 'pointer', transition: 'all 0.15s',
              background: tab === t.id ? '#0f1787' : 'transparent',
              color: tab === t.id ? 'white' : '#6b7280',
            }}
          >{t.label}</button>
        ))}
      </div>

      {/* MINUTO A MINUTO */}
      {tab === 'minutominuto' && (
        <div>
          {/* Selector de día */}
          <div style={{ display: 'flex', gap: 8, marginBottom: 20 }}>
            {dias.map(d => (
              <button
                key={d.id}
                onClick={() => setDiaActivo(d.id)}
                style={{
                  flex: 1, padding: '10px 8px', border: 'none', borderRadius: 10, cursor: 'pointer',
                  background: diaActivo === d.id ? '#0f1787' : 'white',
                  color: diaActivo === d.id ? 'white' : '#374151',
                  border: diaActivo === d.id ? 'none' : '1.5px solid #e8eaf0',
                  fontWeight: 600, fontSize: 12,
                }}
              >
                <div>{d.label}</div>
                <div style={{ fontSize: 11, opacity: 0.75, fontWeight: 400 }}>{d.fecha}</div>
              </button>
            ))}
          </div>

          {/* Bloques del día */}
          {MINUTO_MINUTO[diaActivo].bloques.map((bloque, bi) => (
            <div key={bi} style={{ marginBottom: 24 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 10 }}>
                <h3 style={{ fontSize: 13, fontWeight: 700, color: '#0f1787', margin: 0, textTransform: 'uppercase', letterSpacing: 1 }}>
                  {bloque.titulo}
                </h3>
                {bloque.camiseta && (
                  <span style={{ fontSize: 11, background: '#fef3c7', color: '#92400e', padding: '2px 8px', borderRadius: 20, fontWeight: 500 }}>
                    {bloque.camiseta}
                  </span>
                )}
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                {bloque.items.map((item, idx) => {
                  const key = `${bi}-${idx}`
                  const abierto = expandido === key
                  const colores = item.tipo ? colorTipo[item.tipo] : colorTipo.logistica
                  const esCharla = item.tipo === 'charla'

                  return (
                    <div
                      key={idx}
                      style={{
                        background: 'white',
                        border: esCharla ? '2px solid #dc2626' : '1.5px solid #e8eaf0',
                        borderRadius: 10,
                        overflow: 'hidden',
                      }}
                    >
                      <button
                        onClick={() => setExpandido(abierto ? null : key)}
                        style={{
                          width: '100%', display: 'flex', alignItems: 'center', gap: 10,
                          padding: '10px 12px', background: 'none', border: 'none', cursor: 'pointer', textAlign: 'left',
                        }}
                      >
                        <span style={{ fontSize: 12, fontWeight: 700, color: '#0f1787', minWidth: 64, flexShrink: 0 }}>
                          {item.hora}
                        </span>
                        <span style={{ fontSize: 13, fontWeight: esCharla ? 700 : 500, color: '#111827', flex: 1 }}>
                          {item.actividad}
                        </span>
                        {item.tipo && (
                          <span style={{
                            fontSize: 10, padding: '2px 7px', borderRadius: 20, fontWeight: 600, flexShrink: 0,
                            background: colores.bg, color: colores.color,
                          }}>
                            {colores.label}
                          </span>
                        )}
                        <span style={{ fontSize: 12, color: '#9ca3af', flexShrink: 0 }}>{abierto ? '▲' : '▼'}</span>
                      </button>

                      {abierto && (
                        <div style={{ padding: '0 12px 12px', borderTop: '1px solid #f3f4f6' }}>
                          {item.encargado && (
                            <p style={{ fontSize: 12, color: '#0f1787', fontWeight: 600, margin: '8px 0 4px' }}>
                              Encargado: {item.encargado}
                            </p>
                          )}
                          {item.detalle && (
                            <p style={{ fontSize: 12, color: '#374151', margin: 0, lineHeight: 1.6 }}>
                              {item.detalle}
                            </p>
                          )}
                        </div>
                      )}
                    </div>
                  )
                })}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* ROLES */}
      {tab === 'roles' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
          {ROLES_RETIRO.map((cat, ci) => (
            <div key={ci}>
              <h3 style={{
                fontSize: 12, fontWeight: 700, textTransform: 'uppercase', letterSpacing: 1,
                color: cat.color, margin: '0 0 10px'
              }}>{cat.categoria}</h3>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                {cat.roles.map((rol, ri) => (
                  <div
                    key={ri}
                    style={{
                      background: 'white', border: '1.5px solid #e8eaf0', borderRadius: 10,
                      padding: '12px 14px', borderLeft: `3px solid ${cat.color}`
                    }}
                  >
                    <div style={{ fontSize: 13, fontWeight: 700, color: '#111827', marginBottom: 4 }}>
                      {rol.nombre}
                    </div>
                    <div style={{ fontSize: 12, color: '#6b7280', lineHeight: 1.5 }}>
                      {rol.descripcion}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ))}

          <div style={{
            background: '#f0f2ff', border: '1.5px solid #c7d2fe', borderRadius: 12,
            padding: '14px 16px', marginTop: 4
          }}>
            <p style={{ fontSize: 13, fontWeight: 600, color: '#0f1787', margin: '0 0 4px' }}>
              Roles de los servidores del IX Retiro
            </p>
            <p style={{ fontSize: 12, color: '#374151', margin: 0 }}>
              Los roles especificos de cada servidor de este retiro se asignaran pronto desde el dashboard de servidores.
            </p>
          </div>
        </div>
      )}

      {/* MANUAL */}
      {tab === 'manual' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          <div style={{
            background: 'white', border: '1.5px solid #e8eaf0', borderRadius: 14,
            padding: '20px 20px'
          }}>
            <div style={{ display: 'flex', gap: 14, alignItems: 'flex-start', marginBottom: 16 }}>
              <div style={{
                width: 48, height: 48, background: '#0f1787', borderRadius: 12,
                display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0
              }}>
                <svg width="24" height="24" fill="none" viewBox="0 0 24 24">
                  <path d="M9 12h6M9 16h6M7 3H5a2 2 0 00-2 2v14a2 2 0 002 2h14a2 2 0 002-2V8l-5-5H7z" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                  <path d="M14 3v5h5" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                </svg>
              </div>
              <div>
                <p style={{ fontSize: 16, fontWeight: 700, color: '#111827', margin: '0 0 4px' }}>Manual Effeta Mazuren</p>
                <p style={{ fontSize: 13, color: '#6b7280', margin: 0 }}>
                  Documento oficial con todas las instrucciones, actividades, guiones y protocolos del retiro.
                </p>
              </div>
            </div>
            <button
              onClick={() => window.open('https://docs.google.com/document/d/1lB2M0-FyRe6Eu-2HjcLcnI96jfEqgikC71TWzuhNUR4/edit', '_blank')}
              style={{
                width: '100%', padding: '12px', background: '#0f1787', color: 'white',
                border: 'none', borderRadius: 10, fontSize: 14, fontWeight: 600, cursor: 'pointer',
              }}
            >
              Abrir Manual
            </button>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {[
              { titulo: 'Introduccion y origen', desc: 'Historia y proposito del retiro Effeta.' },
              { titulo: 'Protocolo para abrir un retiro', desc: 'Proceso y reglas del grupo custodio.' },
              { titulo: 'Planeacion del retiro', desc: 'Reuniones, inscripciones, eleccion de testimonios, equipos pre-retiro.' },
              { titulo: 'Cuadro de Mesas', desc: 'Estructura de mesas con servidores y caminantes.' },
              { titulo: 'Anexos', desc: 'Guiones completos de todas las actividades y testimonios.' },
              { titulo: 'Inventario', desc: 'Lista completa de materiales: botiquin, papeleria, religiosos, varios.' },
              { titulo: 'Minuto a Minuto', desc: 'Cronograma detallado viernes, sabado y domingo.' },
              { titulo: 'Perfiles y Roles', desc: 'Perfil de servidor, lider joven, lider adulto, sacerdote.' },
              { titulo: 'Vigilia durante el retiro', desc: 'Reglas y pautas para la vigilia del Santisimo.' },
            ].map((s, i) => (
              <div key={i} style={{
                background: 'white', border: '1.5px solid #e8eaf0', borderRadius: 10,
                padding: '12px 14px', display: 'flex', alignItems: 'center', gap: 10
              }}>
                <span style={{
                  width: 24, height: 24, background: '#f0f2ff', borderRadius: 6,
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  fontSize: 11, fontWeight: 700, color: '#0f1787', flexShrink: 0
                }}>{i + 1}</span>
                <div>
                  <div style={{ fontSize: 13, fontWeight: 600, color: '#111827' }}>{s.titulo}</div>
                  <div style={{ fontSize: 11, color: '#9ca3af' }}>{s.desc}</div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
