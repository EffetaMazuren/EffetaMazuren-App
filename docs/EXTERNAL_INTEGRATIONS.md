# EXTERNAL_INTEGRATIONS — Inventario de integraciones externas

> Ver `DATA_FLOW.md` para cómo encajan estas integraciones en los flujos completos, y
> `HARDCODED_RETREAT_DATA.md` para el detalle de cada valor literal mencionado aquí.

## 1. Tabla resumen

| Integración | Tipo | Dónde vive en el código | Autenticación | Riesgo |
|---|---|---|---|---|
| Supabase | DB / Auth / Storage / Realtime | Toda la app | `anon key` (cliente) · `service role key` (rutas `/api`) | Bajo |
| Resend | Correo transaccional | `/api/correos/inscripcion`, `/api/correos/pago-completo` | `RESEND_API_KEY` (server) | Medio — un remitente usa el dominio de pruebas de Resend |
| Google Apps Script — correos/hojas | Webhook multipropósito | `/api/pagos/registrar`, `/api/pagos/servidor` | `APPS_SCRIPT_CORREOS_URL` (env var), sin auth propia del lado del script | Alto |
| Google Apps Script — mesas | Webhook, sync | `dashboard/retiro/page.tsx` | URL hardcodeada, sin auth | Alto |
| Google Apps Script — cuartos | Webhook, sync | `dashboard/retiro/page.tsx` | URL hardcodeada, sin auth | Alto |
| Google Apps Script — palancas | Webhook, sync | `/api/sync-palanca` (hardcodeada), `api/caminantes/[id]` (misma función vía env var distinta), `dashboard/palancas`, `servidor/palancas` (hardcodeada otra vez) | Mixta — literal en 3 archivos, env var en 1 | Medio |
| Google Sheets API v4 | REST directo desde el navegador | `dashboard/finanzas/page.tsx` (pestaña Cotizaciones) | API key + OAuth 2.0 implícito, **ambos hardcodeados y visibles en el bundle público** | Crítico |
| Google Vision API | REST, OCR | `/api/pagos/analizar-comprobante` | `GOOGLE_VISION_API_KEY` (server — correcto) | Bajo |
| Google Form | Formulario público | Enlazado desde `dashboard/config`; alimenta `/api/correos/forms/inscripcion` vía un trigger externo | — | Medio — dependencia crítica invisible/no documentada |
| Google Docs | Enlace de salida | "Manual" en `dashboard/retiro` | — | Bajo — no es integración, es un bookmark |
| Google Drive | — no existe realmente — | `/api/drive/upload` lleva el nombre pero sube a Supabase Storage | — | Confusión de nombres, no riesgo técnico |
| jsPDF (cdnjs) | Script CDN cargado en runtime | `dashboard/retiro/page.tsx` (tarjetas de mesa en PDF) | Ninguna, sin SRI | Medio — riesgo de cadena de suministro |

## 2. Supabase

Es la única pieza que realmente funciona como backend de la aplicación.

- **Postgres**: ~24 tablas y 4 vistas (ver `DATABASE_SCHEMA.md`). Sin migraciones versionadas.
- **Auth**: email + contraseña, magic link de recuperación, `admin.generateLink` usado también
  para impersonación (ver `USER_ROLES.md`).
- **Storage**: bucket público `comprobantes-pagos`.
- **Realtime**: suscripciones `postgres_changes` abiertas de forma independiente en varias
  pantallas (dashboard, mensajes, tareas, mesas/cuartos), sin un gestor central de canales.

**Inconsistencia de implementación:** al menos 15 archivos crean su propio cliente
`createClient(...)` en vez de importar el singleton de `lib/supabase.ts`.

## 3. Resend — correo transaccional

Dos rutas usan Resend directamente:

| Ruta | Remitente | Cuándo se dispara |
|---|---|---|
| `/api/correos/inscripcion` | `Effetá Mazuren <onboarding@resend.dev>` | Botón manual "Enviar correo" en la ficha de un caminante — envía instrucciones de pago con datos bancarios embebidos en el HTML |
| `/api/correos/pago-completo` | `Effetá Mazuren <effetamazuren@gmail.com>` | Confirmación manual de pago 100% completado |

**Hallazgo:** `onboarding@resend.dev` es el dominio de pruebas que Resend asigna por defecto — no
un dominio propio verificado. Los correos enviados desde ahí tienen mayor probabilidad de caer en
spam y, dependiendo del plan de Resend, pueden tener restricciones de volumen o de destinatarios.

**Nota importante:** la confirmación *automática* de pago (la que se dispara al registrar un abono
desde `/api/pagos/registrar` o `/api/pagos/servidor`) **no pasa por Resend** — la envía el Google
Apps Script de correos/hojas, probablemente vía `GmailApp` dentro del script. Es decir, conviven
dos sistemas de envío de correo independientes y no unificados: Resend para dos acciones manuales
puntuales, y Apps Script/Gmail para las confirmaciones automáticas de pago.

## 4. Google Apps Script — el backend informal

Se identificaron **4 endpoints** de Apps Script (`https://script.google.com/macros/s/.../exec`)
distintos, todos llamados por `fetch(...)` "dispara y olvida" (`try { } catch (e) { console.error(e) }`),
sin ningún token de autenticación propio más allá de la URL en sí (que actúa como secreto de facto).
Ninguno tiene su código fuente en este repositorio — su lógica real (qué hacen exactamente con los
datos que reciben, si escriben en Sheets, si envían correo, con qué cuenta de Google) es opaca desde
aquí.

| Endpoint | Usado en | Función aparente |
|---|---|---|
| Correos/hojas (`APPS_SCRIPT_CORREOS_URL`) | `/api/pagos/registrar`, `/api/pagos/servidor` | Envía correos de confirmación de pago (Gmail) y agrega/actualiza filas en un Google Sheet espejo de inscritos (`tipo: 'actualizar_hojas'`) |
| Mesas (`APPS_SCRIPT_MESAS`) | `dashboard/retiro/page.tsx` | Sincroniza asignaciones de mesas hacia un Google Sheet |
| Cuartos (`APPS_SCRIPT_HABITACIONES`) | `dashboard/retiro/page.tsx` | Sincroniza asignaciones de habitaciones hacia un Google Sheet |
| Palancas | `/api/sync-palanca`, `api/caminantes/[id]` (limpieza al borrar), `dashboard/palancas/page.tsx`, `servidor/palancas/page.tsx` | Sincroniza el seguimiento de familias; también borra filas al eliminar un caminante |

**Riesgos concretos:**

1. **Sin autenticación real** — cualquiera que obtenga una de estas URLs (visibles en el código
   fuente público del repositorio) puede enviarle un JSON arbitrario y disparar lo que sea que el
   script haga con él (por ejemplo, enviar un correo o escribir una fila falsa en el Sheet).
2. **Fallos silenciosos** — si Google cambia la URL de despliegue, revoca el acceso, o el script
   simplemente falla, el único síntoma es un `console.error` en la consola del navegador del líder.
   No hay reintentos, no hay cola, no hay alerta.
3. **Referencia inconsistente a la misma URL** — el script de Palancas se referencia como variable
   de entorno en un archivo y como literal hardcodeado en otros tres. Rotar esa URL exige recordar
   actualizarla en los 4 lugares.
4. **Sin versión de control** — el código real de estos 4 scripts vive únicamente en la cuenta de
   Google Apps Script de quien los desplegó. No hay forma de revisar cambios, hacer rollback, o
   saber qué hace exactamente un script con certeza sin acceso directo a esa cuenta.

## 5. Google Sheets API v4 — llamada directa desde el navegador

En la pestaña "Cotizaciones" de `dashboard/finanzas/page.tsx`, la app implementa su propio flujo
OAuth 2.0 *implícito* (el token queda en el fragmento de la URL, `#access_token=...`) contra un
Google Cloud OAuth Client ID hardcodeado, y llama directamente a
`https://sheets.googleapis.com/v4/spreadsheets/...` con una **API key también hardcodeada**, ambas
visibles en el bundle JavaScript que se sirve al navegador (se pueden ver con las herramientas de
desarrollador de cualquier navegador, sin necesidad de acceso al repositorio). El token de acceso
resultante se guarda en `sessionStorage`.

Esto es una integración cliente-a-Google completa que no pasa por Next.js en absoluto — el
servidor de la aplicación no tiene ninguna visibilidad ni control sobre estas llamadas.
Clasificado como **crítico** en `HARDCODED_RETREAT_DATA.md` por ser credenciales de Google Cloud
embebidas en código público, no solo un dato de negocio.

## 6. Google Vision API — la única integración de Google bien implementada

`/api/pagos/analizar-comprobante` recibe una imagen en base64 desde el cliente, la reenvía server-side
a `vision.googleapis.com/v1/images:annotate` con `GOOGLE_VISION_API_KEY` (variable de entorno del
servidor, nunca expuesta al navegador), y aplica un parser de texto propio
(`extraerValorPago`) para extraer el monto pagado del texto detectado por OCR. Es opcional — si
falla o no encuentra un monto, el líder simplemente lo escribe a mano.

Este es el único punto de la integración con Google que sigue el patrón correcto: la credencial
vive solo en el servidor.

## 7. Google Form — la pieza invisible del flujo de pre-inscripción

El formulario público de pre-inscripción está enlazado desde `dashboard/config/page.tsx`
(`https://docs.google.com/forms/d/.../viewform`, hardcodeado). No hay ningún código en este
repositorio que consulte las respuestas del formulario directamente — la ruta
`/api/correos/forms/inscripcion` recibe los datos ya estructurados por POST, lo que implica que
existe un trigger de Google Forms/Apps Script (no incluido en este repo) que, al recibir una
respuesta, llama a esa ruta. Es una dependencia crítica del flujo de inscripción que es
**completamente invisible y no documentada** desde el código de la aplicación.

## 8. Google Docs — enlace de salida, no integración

El botón "Abrir Manual" en `dashboard/retiro/page.tsx` abre un Google Doc compartido en una pestaña
nueva. No hay lectura ni escritura programática — es equivalente a un marcador.

## 9. Google Drive — el nombre engañoso

`/api/drive/upload/route.ts` sugiere, por su nombre y ubicación, que sube archivos a Google Drive.
En realidad sube el archivo recibido directamente a Supabase Storage (bucket `comprobantes-pagos`)
usando el SDK de Supabase — no hay ninguna llamada a la API de Google Drive en el código actual.
Es probable que en algún momento anterior del proyecto sí haya existido esa integración y se haya
migrado a Supabase Storage sin renombrar la ruta.

## 10. jsPDF vía CDN

`dashboard/retiro/page.tsx` inyecta dinámicamente un `<script src="https://cdnjs.cloudflare.com/ajax/libs/jspdf/2.5.1/jspdf.umd.min.js">`
en el DOM para generar tarjetas de mesa en PDF, sin especificar un atributo `integrity` (SRI). Si
ese archivo específico en cdnjs fuera comprometido, el código inyectado correría con los mismos
privilegios que la sesión autenticada del líder (incluyendo la `anon key` de Supabase disponible en
el cliente).

## 11. Variables de entorno referenciadas en el código

| Variable | Dónde se usa | ¿Documentada en `INSTRUCCIONES.md`? |
|---|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` | ~15 archivos | Sí |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | ~15 archivos | Sí |
| `SUPABASE_SERVICE_ROLE_KEY` | 7 rutas `/api` | **No** |
| `RESEND_API_KEY` | 2 rutas `/api` | Sí |
| `GOOGLE_VISION_API_KEY` | 1 ruta `/api` | **No** |
| `APPS_SCRIPT_CORREOS_URL` | 2 rutas `/api` | **No** |
| `NEXT_PUBLIC_APPS_SCRIPT_PALANCAS_URL` | 1 ruta `/api` | **No** |

`INSTRUCCIONES.md` documenta solo 3 de las 7 variables reales que el código necesita para funcionar
por completo. Sin acceso al panel de Vercel, no es posible reconstruir un entorno funcional desde
cero solo con lo que hay en el repositorio.

## 12. Ver también

- `HARDCODED_RETREAT_DATA.md` — todos los valores literales (URLs, keys, IDs) listados aquí, con su
  ubicación exacta en el código.
- `MULTI_RETREAT_MIGRATION_PLAN.md` (Fase 0 y Fase 5) — remediación de secretos expuestos y
  propuesta para formalizar o retirar la capa de Apps Script.
