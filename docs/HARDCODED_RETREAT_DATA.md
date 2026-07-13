# HARDCODED_RETREAT_DATA — Todo lo que está atado al IX Retiro específicamente

> Este es el documento central para entender por qué la app **no** puede soportar hoy un segundo
> retiro sin editar código. Cada fila es un valor que debería ser dato, no código fuente.
> Ver `MULTI_RETREAT_MIGRATION_PLAN.md` para el plan de remediación de cada categoría.

## 1. El identificador del retiro, repetido en todas partes

```
RETIRO_ID = '21da7588-f7d9-4bf8-a6f6-ae6c8258c00e'
```

Aparece como literal (constante o string inline) en **más de 20 archivos**, entre ellos:
`dashboard/page.tsx`, `dashboard/config/page.tsx`, `dashboard/retiro/page.tsx`,
`dashboard/palancas/page.tsx`, `dashboard/asistencias/page.tsx`, `dashboard/reuniones/page.tsx`,
`dashboard/tareas/page.tsx`, `dashboard/mensajes/page.tsx`, `dashboard/reembolsos/page.tsx`,
`servidor/layout.tsx`, `servidor/page.tsx`, `servidor/registro/page.tsx` (inline, ni siquiera como
constante), `servidor/pago/page.tsx`, `servidor/retiro/page.tsx`, `servidor/palancas/page.tsx`,
`servidor/asistencias/page.tsx`, `servidor/reembolso/page.tsx`, `servidor/versiculo/page.tsx`,
`notifications/page.tsx`, `perfil/page.tsx` (declarado pero sin usar).

**Impacto:** organizar un segundo retiro (o simplemente archivar el IX Retiro y activar el X)
requiere editar y redesplegar decenas de archivos, en vez de crear una fila nueva en `retiros` y
cambiar cuál tiene `estado = 'activo'`.

## 2. Montos de dinero

| Valor | Dónde aparece | Observación |
|---|---|---|
| `$500.000` — precio de inscripción de caminante | `dashboard/caminantes/[id]/page.tsx` (varias veces), `api/pagos/registrar/route.ts` (`valorTotal = 500000`) | Determina cuándo `inscrito_oficialmente` pasa a `true` — lógica de negocio duplicada en cliente y servidor, no en la base de datos |
| `$380.000` — precio de inscripción de servidor interno | `dashboard/page.tsx`, `dashboard/servidores/page.tsx`, `dashboard/servidores/[id]/page.tsx` (`VALOR_TOTAL`), `servidor/pago/page.tsx` (`costo`), `api/pagos/servidor/route.ts` (`VALOR_TOTAL = 380000`) | |
| `$260.000` — el mismo concepto, valor distinto | `servidor/page.tsx` (`cuotaTotal = 260000`) | **Inconsistencia real, no solo estilo**: la página de inicio del propio servidor le muestra un total distinto al que usa el resto de la app para determinar si terminó de pagar |
| `$50.000.000` — meta de recaudo | `dashboard/page.tsx` (`META_RECAUDO`) | La tabla `retiros` ya tiene la columna `meta_financiera` — este archivo la reescribe en vez de leerla |
| `$39.000.000` — presupuesto por defecto de "Casa de retiros" | `dashboard/finanzas/page.tsx` (fallback si la categoría no trae `presupuesto`) | |
| Datos bancarios completos (cuenta de ahorros, banco Caja Social, número de cuenta, NIT, beneficiario) | HTML embebido en `api/correos/inscripcion/route.ts` | Cambiar de cuenta bancaria de un año a otro exige editar una plantilla de correo en el código |

## 3. Cupos y capacidad

| Valor | Dónde aparece |
|---|---|
| `CUPO_MAXIMO = 60` | `dashboard/page.tsx`, `dashboard/personas/page.tsx`, `dashboard/caminantes/page.tsx` |

La tabla `retiros` ya tiene `capacidad_caminantes` — existe la vista `vista_cupos`, que sí la usa
correctamente en algunos flujos, pero el literal `60` se reescribe de forma independiente en otros.

## 4. Fechas y lugar

| Valor | Dónde aparece |
|---|---|
| `3, 4 y 5 de julio de 2026` | `perfil/page.tsx` (texto estático), `dashboard/config/page.tsx`, plantillas de correo en `api/correos/inscripcion` y `api/correos/pago-completo` |
| Fallback `new Date('2026-07-03')` / `new Date('2026-07-05')` | `dashboard/page.tsx`, usado solo si la consulta a `retiros` no trae fecha |
| "Casa Santa Luisa Los Pinares" | `perfil/page.tsx` |
| "Mazuren, Bogotá" | `servidor/retiro/page.tsx` |
| "Parroquia Jesucristo Redentor · Bogotá" | pie de página en varias plantillas de correo y en `perfil/page.tsx` |

La tabla `retiros` ya tiene `fecha_inicio`/`fecha_fin`. `dashboard/page.tsx` sí las consulta;
`perfil/page.tsx` **no** — muestra el texto fijo aunque la tabla tenga el dato real, por lo que si
las fechas cambiaran en la base de datos, el perfil quedaría desactualizado sin que nadie lo note.

## 5. Identidad y contacto de la organización

| Valor | Dónde aparece |
|---|---|
| `@effetamazuren` / `instagram.com/effetamazuren` | `dashboard/config/page.tsx` |
| Enlace del Google Form de inscripción | `dashboard/config/page.tsx` |
| Enlace del Google Doc "Manual Effetá Mazuren" | `dashboard/retiro/page.tsx` |
| Remitentes de correo `onboarding@resend.dev` y `effetamazuren@gmail.com` | `api/correos/inscripcion`, `api/correos/pago-completo` |

## 6. Credenciales y URLs de integraciones — la parte más sensible

Estos no son solo "datos del retiro": son credenciales reales embebidas en el código fuente,
algunas visibles incluso en el bundle público del navegador.

| Valor | Dónde | Severidad |
|---|---|---|
| Clave de administración `'effeta2026admin'` | `api/admin/impersonate/route.ts` | **Crítica** — protege una ruta con privilegio de `service role key` |
| API key de Google Sheets `AIzaSyCFp4MHCcKKOgeirEpccEoeO_5W5Qff4aE` | `dashboard/finanzas/page.tsx` | **Crítica** — hardcodeada en código que se ejecuta en el navegador, visible para cualquier visitante |
| OAuth Client ID de Google `309085978370-38krrj9n4bkr9lsa7d01nungtesofmvr.apps.googleusercontent.com` | `dashboard/finanzas/page.tsx` | Alta — expuesto junto a la API key anterior |
| Sheet ID de cotizaciones `1EB-8QHKlst9EEgEd2Kd2Mf7W2KZXhwamwRqrHyvEA48` | `dashboard/finanzas/page.tsx` | Baja por sí sola, pero acopla el código a un documento específico |
| URL de Supabase `https://pckussxwvbpgjkmojpih.supabase.co` repetida como literal (en vez de leer la env var) | `api/admin/impersonate/route.ts` | Baja — es pública por diseño, pero es otra fuente que hay que recordar actualizar si el proyecto cambia |
| 4 URLs de Google Apps Script (`script.google.com/macros/s/.../exec`) | Ver `EXTERNAL_INTEGRATIONS.md` §4 | Media — actúan como secreto de facto sin serlo realmente |

## 7. Roster hardcodeado del equipo Palancas

En **dos archivos** (`dashboard/palancas/page.tsx` y `servidor/palancas/page.tsx`), duplicado:

- `SERVIDORES_PALANCAS_IDS` — arreglo de 9 UUIDs de servidores.
- `APODOS` — mapa de esos 9 UUIDs a apodos.
- `PALANCAS_NOMBRE_A_ID` (solo en `servidor/palancas/page.tsx`) — mapa de 12 variantes de nombre
  (con/sin tilde) a UUID, usado además para **auto-otorgar** acceso al grupo Palancas (ver
  `USER_ROLES.md` §6).

**Impacto:** agregar o quitar a alguien del equipo de Palancas requiere un cambio de código y un
redespliegue — a pesar de que el dato (`servidores_inscripcion.grupo = 'palancas'`) ya existe y
podría consultarse en vivo sin ninguna lista fija.

## 8. Información de personas privadas embebida en el bundle público

El dropdown "¿Dónde dejaron las palancas?" en `servidor/palancas/page.tsx` tiene, como opciones
literales:

```
"CASA DANI CUELLAR", "CASA ANTO RIVERA", "CASA ANDRES MUÑOZ", "CASA SANTI CARDOZO", "Correo"
```

Nombres y, por asociación, direcciones de casas particulares de miembros del equipo, escritos
directamente en código que se envía al navegador de **cualquier** visitante que cargue esa página
— no solo a quienes tienen acceso al grupo Palancas. Es un dato de privacidad, no solo de
configuración, y merece tratamiento distinto al resto de esta lista (no basta con moverlo a una
tabla pública; debe quedar detrás de una consulta autorizada).

## 9. Mapa de colores por rol

`servidor/retiro/page.tsx` tiene un `COLOR_ROL` con más de 30 nombres de roles en español mapeados
a un esquema de color específico. Si un líder crea o renombra un rol en `roles_retiro` que no está
en este mapa, la interfaz cae a un color gris por defecto sin ningún aviso — cada rol nuevo requiere
un cambio de código para tener su propio color.

## 10. Verbatim del cronograma y del "mini-lenguaje" de minuto a minuto

`dashboard/retiro/page.tsx` implementa un parser propio (`parsearTextoMM`) para un formato de texto
como:

```
BLOQUE: Viernes
* 19:00 Bienvenida | Coordinación | logística | detalle...
```

No es un dato hardcodeado en sí, pero es una sintaxis específica de este retiro, sin documentación
fuera de comentarios inline, y cualquier error de formato del líder al escribirlo hace que esa línea
se descarte en silencio (`if (!horaMatch) continue`).

## 11. Tabla resumen — valor hardcodeado → dónde debería vivir

| Hoy hardcodeado | Repeticiones | Debería vivir en |
|---|---|---|
| UUID del retiro activo | 20+ archivos | Un contexto de "retiro actual" resuelto una vez (ver Fase 2 del plan de migración) |
| Cupo máximo de caminantes (60) | 4 archivos | `retiros.capacidad_caminantes` — **ya existe** |
| Meta de recaudo ($50.000.000) | 1-2 archivos | `retiros.meta_financiera` — **ya existe** |
| Fechas del retiro | 4 archivos, texto suelto en `perfil` | `retiros.fecha_inicio`/`fecha_fin` — **ya existe, subutilizado** |
| Precio inscripción caminante ($500.000) | 3+ archivos | Nueva columna en `retiros`, ej. `costo_caminante` |
| Precio servidor interno ($380.000 / $260.000 inconsistente) | 5 archivos | Nueva columna, ej. `costo_servidor_interno` |
| Datos bancarios | 1 plantilla de correo | Tabla de configuración del retiro, no HTML embebido |
| Roster del equipo Palancas | 2 archivos completos | Consulta en vivo a `servidores_inscripcion.grupo='palancas'` |
| URLs de los 4 Google Apps Script | Mixto: literal en 3, env var en 1 | Variables de entorno, de forma consistente |
| Mapa de colores por rol | 1 archivo | Columna `color` en `roles_retiro` |
| Direcciones/nombres de casas de Palancas | 1 archivo, público | Tabla de configuración, detrás de autorización |
| Nombre de parroquia, sede, redes sociales | 3 páginas distintas | Un único "perfil de organización" configurable |
| Credenciales de Google (API key, OAuth Client ID, clave admin) | Ver §6 | Variables de entorno del servidor, nunca en código ni en el bundle del cliente |

## 12. Ver también

- `MULTI_RETREAT_MIGRATION_PLAN.md` — plan de remediación fase por fase para cada categoría de esta
  lista.
- `EXTERNAL_INTEGRATIONS.md` §11 — variables de entorno actuales, como referencia de qué ya se
  externalizó correctamente frente a lo que sigue en el código.
