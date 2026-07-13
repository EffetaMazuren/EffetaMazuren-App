# MULTI_RETREAT_MIGRATION_PLAN — Plan para una plataforma multi-retiro

> **Estado: propuesta, nada de esto se ha ejecutado.** Es la hoja de ruta que se desprende de los
> siete documentos anteriores (`SYSTEM_MAP.md`, `ARCHITECTURE.md`, `DATA_FLOW.md`,
> `DATABASE_SCHEMA.md`, `EXTERNAL_INTEGRATIONS.md`, `USER_ROLES.md`, `HARDCODED_RETREAT_DATA.md`),
> pensada para decidir juntos por dónde empezar — no para ejecutarse de una sola vez.

## Cómo leer este plan

Cada fase indica: qué resuelve, de qué documento sale el hallazgo que la motiva, y qué se puede
entregar de forma independiente (ninguna fase obliga a completar la siguiente para tener valor por
sí sola). Las fases 0 y 1 son las únicas que se recomiendan como no negociables antes de cualquier
otro trabajo, independientemente de si finalmente se decide construir soporte multi-retiro.

---

## Fase 0 — Cerrar los huecos de seguridad

**Por qué primero:** esto no es deuda técnica de "cuando haya tiempo" — son credenciales reales ya
expuestas en un repositorio de git, con acceso a privilegios elevados. Ver `USER_ROLES.md` §4-5 y
`HARDCODED_RETREAT_DATA.md` §6.

- Retirar la clave `'effeta2026admin'` de `api/admin/impersonate/route.ts` y tratarla como
  comprometida (no solo eliminarla del HEAD — evaluar si conviene reescribir historial o, más
  simple, asumir que quedó expuesta y actuar en consecuencia sobre las cuentas que podría haber
  comprometido).
- Rotar la API key y el OAuth Client ID de Google Sheets usados en `dashboard/finanzas/page.tsx`, y
  mover ese flujo detrás del servidor (ver Fase 5).
- Mover a variables de entorno lo que hoy es literal: URL de Supabase repetida, URLs de los 4
  Apps Script.
- Documentar en `INSTRUCCIONES.md` las 7 variables de entorno reales que el código usa hoy (ver
  `EXTERNAL_INTEGRATIONS.md` §11), no solo las 3 actuales.
- Exportar y versionar el esquema actual de Supabase como migraciones SQL (`supabase db dump` o
  equivalente) — hoy no existe ni un solo `.sql` en el repositorio (`DATABASE_SCHEMA.md`).
- Verificar directamente en el panel de Supabase qué políticas de Row Level Security existen hoy
  para `servidores_inscripcion`, `caminantes`, `pagos` y `transacciones` — varias de las
  conclusiones de `USER_ROLES.md` dependen de esto y no pudieron confirmarse desde el código.

**Entregable independiente:** sí — esto se puede hacer sin tocar ninguna otra parte de la app.

---

## Fase 1 — Un guard de rutas real para el líder

**Por qué:** hoy solo 3 de 18 pantallas de `/dashboard/*` verifican el rol dentro del componente
(`USER_ROLES.md` §3). El portal de servidor ya tiene el patrón correcto en `servidor/layout.tsx` —
es cuestión de replicarlo, no de inventarlo.

- Introducir `app/dashboard/layout.tsx` (o `middleware.ts`) que verifique sesión y
  `usuarios.rol === 'lider'` una sola vez, en el punto de entrada al portal.
- Retirar la verificación manual duplicada de `dashboard/palancas`, `dashboard/reuniones` y
  `dashboard/mensajes` una vez exista la capa central (opcional, de limpieza).
- Decidir, junto con lo verificado en Fase 0 sobre RLS, si además de proteger la UI hace falta
  reforzar políticas a nivel de base de datos (la UI nunca debería ser la única barrera).

**Entregable independiente:** sí.

---

## Fase 2 — Retiro como contexto, no como constante

**Por qué:** el bloqueador principal para un segundo retiro es el `RETIRO_ID` hardcodeado en 20+
archivos (`HARDCODED_RETREAT_DATA.md` §1).

- Introducir un contexto/hook de "retiro actual" (ej. `useRetiroActual()`) que resuelva una sola vez
  el retiro con `estado = 'activo'`, y reemplazar los literales por ese valor.
- Leer cupo, meta y fechas desde las columnas que `retiros` ya tiene
  (`capacidad_caminantes`, `meta_financiera`, `fecha_inicio`/`fecha_fin`) en vez de reescribirlos
  como literales — esto ya corrige, de paso, que `perfil/page.tsx` muestre fechas fijas en vez de
  las reales.
- Corregir la inconsistencia de precio de servidor interno ($380.000 vs $260.000,
  `HARDCODED_RETREAT_DATA.md` §2) como parte de esta limpieza, ya que ambos deberían leer del mismo
  origen.

**Entregable independiente:** sí, y es el que más reduce el riesgo de bugs de inconsistencia a
futuro (ver ejemplo real ya encontrado: el desfase de precio de servidor).

---

## Fase 3 — Selector de retiro y acceso histórico

**Por qué:** una vez el `RETIRO_ID` deja de estar cableado, tiene sentido dejar de asumir que solo
existe un retiro relevante a la vez.

- Pantalla para que el líder elija entre retiros (activo, o pasados en modo solo lectura).
- Flujo de "crear retiro nuevo": clonar categorías financieras, configuración y estructura base
  desde una plantilla o desde el retiro anterior, en vez de partir de cero cada año.
- Revisar las pantallas que hoy consultan tablas **sin** filtrar por `retiro_id` en absoluto — por
  ejemplo `dashboard/asistencias/page.tsx` (`DATABASE_SCHEMA.md`, `ARCHITECTURE.md`) — porque en un
  escenario multi-retiro real esas consultas empezarían a mezclar datos de años distintos.

**Entregable independiente:** parcialmente — depende de que la Fase 2 ya exista para tener sentido
completo, pero el trabajo de auditar los filtros faltantes por `retiro_id` se puede adelantar antes.

---

## Fase 4 — Reglas de negocio manejadas por datos

**Por qué:** más allá del `RETIRO_ID`, hay una larga lista de valores de negocio que hoy son texto
en el código (`HARDCODED_RETREAT_DATA.md` §11, tabla resumen completa).

- Precios de inscripción (caminante, servidor interno) → nuevas columnas en `retiros`.
- Datos bancarios → tabla de configuración del retiro, no HTML embebido en una plantilla de correo.
- Roster del equipo Palancas → dejar de mantener listas fijas de UUIDs/apodos y consultar en vivo
  `servidores_inscripcion.grupo = 'palancas'`, que ya tiene el dato.
- Mapa de colores por rol → columna `color` en `roles_retiro`.
- Direcciones/nombres de casas de Palancas → mover de un dropdown hardcodeado y público a una tabla
  de configuración protegida por autorización real (esto es también un tema de privacidad, no solo
  de configurabilidad — ver `HARDCODED_RETREAT_DATA.md` §8).
- Perfil de organización (parroquia, sede, redes sociales) → un único lugar configurable en vez de
  texto repetido en 3 páginas.

**Entregable independiente:** sí, se puede hacer ítem por ítem sin esperar a las fases anteriores,
aunque conviene hacerlo después de la Fase 2 para no duplicar el trabajo de introducir el contexto
de retiro.

---

## Fase 5 — Reemplazar el pegamento de Apps Script

**Por qué:** 4 scripts sin código versionado, sin autenticación propia, con fallos silenciosos
(`EXTERNAL_INTEGRATIONS.md` §4), son el punto más frágil de toda la arquitectura actual.

Dos caminos posibles, a decidir con el equipo antes de empezar:

- **(a) Formalizar la integración con Google del lado del servidor.** El paquete `googleapis` ya
  está instalado (aunque sin usar hoy) — se podría usar una cuenta de servicio para leer/escribir
  Sheets y enviar Gmail desde las rutas `/api/**` existentes, de forma versionada, testeable y con
  manejo de errores real (a diferencia del `try/catch` vacío actual).
- **(b) Retirar el espejo en Sheets.** Ahora que Supabase es la fuente de verdad para casi todo,
  evaluar si el espejo en Google Sheets sigue aportando valor o es una capa heredada de antes de
  tener base de datos propia. Conservar solo lo estrictamente necesario — por ejemplo, el intake
  del Google Form, si el equipo prefiere seguir recibiendo pre-inscripciones ahí en vez de un
  formulario propio dentro de la app.

En cualquiera de los dos caminos, formalizar también el flujo de "Cotizaciones" de
`dashboard/finanzas` (hoy OAuth implícito + API key expuestos en el navegador,
`EXTERNAL_INTEGRATIONS.md` §5) para que pase por el servidor.

**Entregable independiente:** sí, pero requiere una decisión de producto primero (a vs. b), no solo
técnica.

---

## Fase 6 — Consolidación y pulido

**Por qué:** una vez resuelto lo estructural, esta fase limpia la deuda de duplicación y las
funciones a medias identificadas en `ARCHITECTURE.md` §5-6 y `SYSTEM_MAP.md` §6.

- Un único componente para el badge interno/externo (hoy 3 copias — `ARCHITECTURE.md` §5).
- Un único panel de coordinación de Palancas, reutilizado en ambos portales (hoy 2 implementaciones
  completas de ~400 líneas).
- Una única función de emparejamiento difuso de nombres, importada donde haga falta (hoy 2 copias
  que deben mantenerse idénticas a mano).
- Políticas RLS con `retiro_id` real aplicadas de forma consistente — esto corrige de raíz la fuga
  potencial de datos entre retiros mencionada en la Fase 3, a nivel de base de datos y no solo de
  consulta.
- Terminar o retirar las funciones a medias: modo oscuro (`dashboard/config`), auto-expiración real
  de mensajes (o quitar el texto que promete algo que no ocurre), estado de "leído" persistente en
  notificaciones (`SYSTEM_MAP.md` §6).
- Limpiar `effeta-app.zip`, añadir `.gitignore`, retirar `googleapis` y `@supabase/ssr` si
  finalmente no se usan (o adoptar `googleapis` como parte de la Fase 5a).
- Arreglar el desfase entre el arreglo de 24 versículos de vista previa y el de 250+ de la vista
  completa (`ARCHITECTURE.md` §6) — un caso concreto de bug de datos duplicados, no solo de estilo.

**Entregable independiente:** sí, cada ítem es aislado.

---

## Orden recomendado si hay que priorizar

1. **Fase 0** — no es opcional, independientemente de cualquier otra decisión de producto.
2. **Fase 1** — cierra el hueco de autorización más grande con el menor esfuerzo relativo.
3. **Fase 2** — es la que más desbloquea (multi-retiro real) y la que más bugs de inconsistencia
   evita a futuro.
4. Fases 3–6 en el orden que mejor convenga según qué necesite el equipo primero: ¿un segundo
   retiro ya (Fase 3), o dejar de depender de Google Apps Script (Fase 5)?

## Ver también

Todos los documentos de esta auditoría son la base de este plan:
`SYSTEM_MAP.md` · `ARCHITECTURE.md` · `DATA_FLOW.md` · `DATABASE_SCHEMA.md` ·
`EXTERNAL_INTEGRATIONS.md` · `USER_ROLES.md` · `HARDCODED_RETREAT_DATA.md`
