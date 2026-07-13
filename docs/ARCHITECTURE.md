# ARCHITECTURE — Arquitectura general

> Ver `SYSTEM_MAP.md` para el inventario de pantallas y carpetas. Este documento cubre el *cómo*:
> el stack, los patrones (y anti-patrones) de implementación, y los problemas de escalabilidad
> conocidos.

## 1. Resumen en una frase

Una app monolítica de Next.js App Router, desplegada en Vercel, sin backend propio separado: casi
toda la lógica de negocio vive en componentes cliente que hablan directo con Supabase, y las 10
rutas `app/api/**` existen solo para las operaciones que necesitan la `service role key` o para
actuar de proxy hacia Google.

## 2. Stack

| Capa | Tecnología | Cómo se usa aquí |
|---|---|---|
| Framework | `next@16.2.9`, `react@19.2.4` | App Router, **100% `'use client'`** — no se encontró un solo Server Component con lógica propia, ni `middleware.ts` |
| Lenguaje | TypeScript 5, `strict: true` | Tipado real solo en `lib/supabase.ts` (7 tipos); el resto del código define tipos locales ad hoc por archivo |
| Estilos | Tailwind v4 + PostCSS | Instalado pero casi no se usa — ~95% de la UI son `style={{...}}` inline; solo `BadgeTipoServidor.tsx` usa clases Tailwind |
| Base de datos | Supabase (Postgres) | Fuente de verdad de todo — ~24 tablas/vistas. **Sin migraciones versionadas en el repo** (cero archivos `.sql`) |
| Autenticación | Supabase Auth | Email + contraseña, magic link para recuperación. `@supabase/ssr` está **instalado pero nunca importado** — dependencia muerta |
| Archivos | Supabase Storage | Bucket público único `comprobantes-pagos` |
| Tiempo real | Supabase Realtime | Suscripciones `postgres_changes` abiertas por página (dashboard, mensajes, tareas, mesas/cuartos), sin gestor central de canales |
| Correo | Resend | 2 rutas API, con **dos remitentes distintos** (uno usa el dominio de pruebas `onboarding@resend.dev`) |
| Hojas de cálculo | Google Sheets API v4 (REST directo) | Llamado **desde el navegador** con API key + OAuth implícito — nunca pasa por el servidor |
| Automatización Google | 4 Google Apps Script (`script.google.com/macros/...`) | Backend informal para Sheets/Gmail; código fuente no versionado en este repositorio |
| OCR | Google Vision API | Lee el monto de un comprobante de pago fotografiado |
| PDF | jsPDF vía CDN público (`cdnjs.cloudflare.com`) | Cargado dinámicamente en runtime, sin hash de integridad (SRI) |
| Íconos | `lucide-react` | Consistente en toda la app |
| Despliegue | Vercel | Un solo entorno, sin staging (`vercel.json` minimal) |

**Dependencias declaradas pero nunca usadas en el código:** `googleapis` y `@supabase/ssr`.
Probablemente quedaron de un enfoque anterior (acceso server-side a Google con cuenta de servicio,
y SSR de sesión con cookies) que se abandonó a favor de Apps Script y del cliente Supabase directo
en el navegador.

## 3. Patrón de acceso a datos

Casi todas las páginas siguen el mismo patrón:

```
'use client'
→ supabase.auth.getUser()               // obtiene la sesión
→ supabase.from('usuarios').select(...)  // (a veces) verifica el rol
→ supabase.from('<tabla>').select(...)   // trae los datos directo con la anon key
→ render
```

Las excepciones son las 10 rutas bajo `app/api/**`, que instancian su propio cliente Supabase con
`SUPABASE_SERVICE_ROLE_KEY` del lado del servidor — usadas para: borrados en cascada, envío de
correo, registro de pagos con validación de reglas de negocio, y como proxy hacia Google Apps
Script/Vision.

**Inconsistencia detectada:** al menos 15 archivos instancian su propio `createClient(...)` en vez
de importar el singleton exportado por `lib/supabase.ts` — incluyendo `app/dashboard/page.tsx`, que
crea su propio cliente en lugar de usar el compartido. Esto no rompe nada por sí solo, pero es
inconsistente y puede producir múltiples instancias de `GoTrueClient` en la misma sesión del
navegador.

## 4. Sin capa central de autorización

No existe `middleware.ts` ni `app/dashboard/layout.tsx`. Cada pantalla de `/dashboard/*` que quiere
protegerse tiene que hacerlo por su cuenta, copiando el mismo patrón:

```ts
const { data: u } = await supabase.from('usuarios').select('rol').eq('id', user.id).single()
if (u?.rol !== 'lider') { router.push('/servidor'); return }
```

Solo 3 de 18 pantallas de líder lo hacen (`palancas`, `reuniones`, `mensajes`). El resto no tiene
ninguna verificación de rol dentro del componente. El portal de servidor sí tiene esta protección
centralizada correctamente en `app/servidor/layout.tsx`, que es el único guard de rutas real de
todo el repositorio — sería el patrón a replicar para `/dashboard/*`.

Detalle completo de esto y sus implicaciones de seguridad en `USER_ROLES.md`.

## 5. Lógica de negocio duplicada, no compartida

Varias piezas de lógica no triviales están copiadas y pegadas en más de un archivo en vez de vivir
en un módulo compartido:

- **Emparejador de nombres difuso** (`norm`, `tokensOf`, `nombreMatch`) — usado para relacionar
  nombres de texto libre (roles, mesas) con registros de caminantes/servidores. Existe en
  `dashboard/retiro/page.tsx` **y** en `servidor/retiro/page.tsx`, con un comentario explícito en
  el segundo advirtiendo que debe mantenerse "exactamente igual" a la del primero, a mano.
- **Autovinculación de cuenta de servidor** — el patrón de "buscar por `usuario_id`, si no existe
  buscar por `user_metadata.servidor_inscripcion_id`, y si tampoco, crear/enlazar" aparece de forma
  casi idéntica en `servidor/layout.tsx`, `servidor/page.tsx` y `servidor/pago/page.tsx` (3 copias).
- **Panel de coordinación de Palancas** — `dashboard/palancas/page.tsx` y la rama "líder de equipo"
  de `servidor/palancas/page.tsx` son dos implementaciones casi completas de ~400 líneas cada una,
  con los mismos filtros, estadísticas y flujo de reasignación.
- **Badge interno/externo** — existe como componente compartido
  (`components/servidores/BadgeTipoServidor.tsx`) pero se reimplementa inline, casi idéntico, en
  `dashboard/servidores/page.tsx` y `dashboard/servidores/[id]/page.tsx`.

## 6. Inconsistencias de patrón detectadas

| Área | Inconsistencia |
|---|---|
| Comprobantes de pago | La mayoría sube a Supabase Storage directo desde el cliente; el flujo de pago de caminante en cambio pasa por `/api/drive/upload` — que, pese al nombre, **también** termina subiendo a Supabase Storage. No existe integración real con Google Drive en ningún punto del código. |
| Refresco de datos tras una mutación | Varias pantallas de ficha (`caminantes/[id]`, entre otras) hacen `window.location.reload()` completo tras guardar un cambio, en vez de refrescar el estado local — patrón repetido de recarga de página completa. |
| Validación de archivos subidos | `servidor/pago/page.tsx` valida tipo y tamaño de archivo antes de subir; `servidor/reembolso/page.tsx` y `dashboard/finanzas/registrar/page.tsx` no validan nada del lado del cliente más allá del atributo HTML `accept`. |
| Política de colisión de nombres en Storage | Algunas subidas usan `{ upsert: false }`, otras `{ upsert: true }`, sin un criterio documentado. |
| Precio de inscripción de servidor interno | `$380.000` en la mayoría del código, pero `$260.000` en `servidor/page.tsx` (`cuotaTotal`) — inconsistencia real, no solo de estilo (ver `HARDCODED_RETREAT_DATA.md`). |
| Verse del día | `servidor/page.tsx` tiene un arreglo de 24 versículos para la vista previa; `servidor/versiculo/page.tsx` tiene un arreglo distinto de 250+ versículos para la vista completa. Ambos rotan con la misma fórmula de bloques de 12 horas pero sobre datasets distintos, por lo que la vista previa con frecuencia **no coincide** con el versículo que se muestra al entrar — bug de datos, no solo de estilo. |

## 7. Ausencia de pruebas, CI y esquema versionado

- No hay carpeta de tests ni configuración de un test runner en `package.json`.
- No hay workflow de CI (no se encontró `.github/workflows/`).
- No hay un solo archivo `.sql`: el esquema completo (~24 tablas, relaciones, políticas RLS) existe
  únicamente dentro del panel de Supabase, sin versión de control.
- El historial de git (50 commits) tiene mensajes genéricos ("Update page.tsx", "Update route.ts")
  sin valor de auditoría — sugiere desarrollo iterativo rápido, probablemente asistido, sin revisión
  de código por pull request.

## 8. Higiene del repositorio

- `effeta-app.zip` — una foto de ~45 archivos del proyecto tal como estaba hace un mes, comiteada
  en la raíz del repositorio por accidente. No es referenciada por ningún código.
- No existe `.gitignore` en el repositorio actual (sí existía en el snapshot antiguo del zip, lo
  que sugiere que se perdió en algún punto).
- `app/layout.tsx` referencia `manifest: '/manifest.json'`, pero no existe ningún
  `public/manifest.json` — la configuración de PWA está rota/incompleta; tampoco hay íconos propios
  en `public/` (solo los SVG por defecto de `create-next-app`).

## 9. Resumen de riesgos por severidad

Ver el detalle de cada uno, con su remediación propuesta, en `MULTI_RETREAT_MIGRATION_PLAN.md`
(Fase 0) y en `USER_ROLES.md` (para lo específico de autenticación).

| Severidad | Hallazgo |
|---|---|
| Crítico | Secretos con privilegio elevado hardcodeados en el código fuente (ver `USER_ROLES.md`, `EXTERNAL_INTEGRATIONS.md`) |
| Crítico | Sin capa central de autorización para `/dashboard/*` |
| Alto | Un solo retiro cableado en el código en vez de en la base de datos |
| Alto | Reglas de negocio duplicadas e inconsistentes entre archivos |
| Alto | Google Apps Script como backend informal, sin versión de control, sin autenticación |
| Alto | Sin esquema de base de datos versionado |
| Medio | Lógica crítica duplicada a mano entre archivos |
| Medio | Consultas sin paginación real |
| Medio | Dos backends de almacenamiento de comprobantes conviviendo |
| Bajo | Higiene del repositorio (zip suelto, sin `.gitignore`, dependencias sin usar) |
