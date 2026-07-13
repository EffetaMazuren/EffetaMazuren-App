# PHASE_0_EXECUTION_PLAN — Plan operativo para iniciar la Fase 0

> Documento de ejecución, no de análisis. Construido exclusivamente con información ya establecida
> en los 11 documentos de auditoría (`SYSTEM_MAP.md` → revisión crítica de consistencia). No agrega
> fases nuevas, no rediseña el roadmap, no propone funcionalidades ni cambios arquitectónicos. El
> roadmap vigente es `IMPLEMENTATION_ROADMAP.md`; este documento solo lo convierte en algo ejecutable
> para la Fase 0 específicamente. Sin cambios de código, sin migraciones.

---

## RESUMEN EJECUTIVO

**¿Qué necesito conseguir antes de escribir una sola línea de código?**

Cinco accesos y una decisión, en este orden de urgencia:

1. **Google Cloud** — para rotar la API key + OAuth Client ID de Sheets ya expuestos.
2. **Supabase** — para versionar el esquema y extraer las políticas RLS reales (el vacío de información más citado en toda la auditoría).
3. **GitHub con permiso de escritura** — para poder subir cualquier cambio, incluidos los 11 documentos ya comiteados localmente.
4. **Vercel** — para confirmar las variables de entorno reales y revisar si `/api/admin/impersonate` se ha usado.
5. **Apps Script** (menor urgencia, sin dependencias) — para leer el código de los 4 scripts.

La única decisión de negocio que bloquea el cierre de la Fase 0 es el **destino de `/api/admin/impersonate`**. No hace falta tener los 5 accesos completos para empezar: cada uno desbloquea su propio tramo de trabajo de forma independiente, y parte del código puede prepararse ya, en local, sin ningún acceso nuevo.

---

## MATRIZ DE ACCESOS

| Sistema | Acceso requerido | Motivo | Bloqueante | Prioridad |
|---|---|---|---|---|
| **Supabase** | Owner/Admin del proyecto, o mínimo SQL Editor + Database settings + Authentication → Policies; idealmente login de CLI | Versionar el esquema real; extraer políticas RLS de `servidores_inscripcion`, `caminantes`, `pagos`, `transacciones` | Sí | Crítica |
| **Vercel** | Ver/editar Environment Variables + logs de invocación de funciones (si están retenidos) | Confirmar la lista real de variables de entorno; revisar uso histórico de `/api/admin/impersonate` | Parcial — bloquea la decisión de impersonación y la configuración final de env vars, no bloquea el trabajo de Supabase/Google Cloud | Alta |
| **GitHub** | Permiso "Contents: Read and write" sobre el repositorio (o que alguien cree manualmente la rama existente) | Publicar cualquier cambio de código o documentación de esta fase | Sí, para publicar — no para preparar el trabajo en local | Crítica |
| **Google Cloud** | Rol Editor (o superior) sobre "APIs & Services → Credentials" en el proyecto que respalda la API key de Sheets/OAuth Client ID y la de Vision | Rotar la credencial ya expuesta; confirmar qué APIs adicionales están habilitadas en ese proyecto | Sí, para cerrar el hallazgo crítico de credenciales | Crítica |
| **Google Apps Script** | Acceso "Viewer" a los 4 proyectos desplegados (script.google.com) | Leer el código real de los 4 scripts; confirmar el trigger que se sospecha conecta el Google Form | No bloquea el cierre de Fase 0 (es investigación de cara a la Fase 6), pero no tiene ninguna dependencia — puede empezar ya | Media |
| **Google Drive** | Ninguno | La auditoría confirmó que no existe integración real con Google Drive en el código actual — `/api/drive/upload` sube a Supabase Storage pese al nombre (`EXTERNAL_INTEGRATIONS.md` §9) | No aplica | N/A |
| **Google Forms** | Acceso de edición al formulario de pre-inscripción | Confirmar la estructura de campos y verificar que coincide con lo que espera `/api/correos/forms/inscripcion` | No bloquea el cierre de Fase 0 | Media |

---

## MATRIZ DE EVIDENCIAS

| Evidencia | Cómo obtenerla | Sistema origen | Prioridad |
|---|---|---|---|
| Esquema completo de Supabase (tablas, columnas, tipos, constraints, FKs, índices, triggers, funciones) | `supabase db dump --schema-only`, o exportación desde Studio | Supabase | Crítica |
| Políticas RLS completas de todas las tablas, prioridad en `servidores_inscripcion`, `caminantes`, `pagos`, `transacciones` | Studio → Authentication → Policies, o `SELECT * FROM pg_policies` | Supabase | Crítica |
| Qué proyecto de Google Cloud respalda la API key de Sheets/OAuth Client ID y la de Vision, y qué APIs tiene habilitadas | Google Cloud Console → APIs & Services → Credentials / Enabled APIs | Google Cloud | Crítica |
| Lista real de variables de entorno configuradas (solo nombres) | Vercel → Project Settings → Environment Variables | Vercel | Alta |
| Logs de invocación de `/api/admin/impersonate`, si están disponibles | Vercel → Functions / Logs | Vercel | Alta |
| Código fuente de los 4 Google Apps Script | script.google.com → exportar/copiar cada proyecto | Apps Script | Media |
| Triggers configurados en cada Apps Script (en particular el ligado al Google Form) | Editor de triggers dentro de cada proyecto de Apps Script | Apps Script | Media |
| Estructura de campos del Google Form | Vista de edición del formulario | Google Forms | Media |
| Confirmación de si existen `ON DELETE CASCADE` reales en las FKs | Supabase → esquema/Table editor | Supabase | Media |
| Aclaración de `es_lider_palancas` vs. `palancas_lider` | Revisión de uso real de datos en Supabase + confirmación del equipo | Supabase / equipo | Baja |

---

## DECISIONES DE NEGOCIO PENDIENTES

| Decisión | Impacto | Bloquea implementación | Fecha recomendada |
|---|---|---|---|
| Destino de `/api/admin/impersonate` — eliminar, proteger con autenticación real, o mantener temporalmente con la clave rotada | Determina si se elimina la ruta por completo o se reconstruye con un mecanismo de autenticación real | Sí — bloquea el cierre del grupo de tareas sobre esta ruta específica | Semana 1, antes de tocar el archivo |
| ¿Reescribir el historial de git para purgar la clave expuesta, o asumirla comprometida y solo rotar hacia adelante? | Determina si se ejecuta una operación destructiva sobre el historial del repositorio (mayor riesgo, requiere coordinación con todo el equipo) o una remediación más simple hacia adelante | Parcial — no bloquea rotar la clave hoy, pero sí bloquea dar la Fase 0 por cerrada con pleno conocimiento del riesgo residual | Semana 1 |

No incluyo aquí el modelo de personas, la estrategia multi-retiro ni la política de historial: ninguna de las tres es necesaria para iniciar o cerrar la Fase 0 — pertenecen a fases posteriores del roadmap vigente y no bloquean este arranque.

---

## TRABAJO EN PARALELO

### Puede hacerse inmediatamente

- Preparar en local (sin ningún acceso nuevo) el cambio de `app/api/admin/impersonate/route.ts` que deja de repetir la URL de Supabase como literal.
- Preparar en local el cambio de las 4 URLs de Apps Script a referencias de variable de entorno consistentes, en los archivos ya identificados (`api/sync-palanca`, `dashboard/palancas`, `dashboard/retiro`, `servidor/palancas`, `api/caminantes/[id]`).
- Preparar en local la actualización de `INSTRUCCIONES.md` con las 7 variables reales.
- Todo esto queda listo para publicar en cuanto el acceso de GitHub se resuelva — ninguna de estas tres tareas depende de Supabase, Google Cloud o Vercel.

### Requiere accesos externos

- Dump del esquema y extracción de políticas RLS → Supabase.
- Rotación real de la API key + OAuth Client ID de Sheets → Google Cloud.
- Lectura del código de los 4 Apps Script → Apps Script.
- Confirmación de variables de entorno reales y logs de impersonación → Vercel.
- Publicación de cualquier cambio, incluidos los 11 documentos ya comiteados localmente → GitHub.

### Requiere decisiones del equipo

- Destino final de `/api/admin/impersonate` — antes de escribir el código definitivo para esa ruta.
- Reescribir o no el historial de git.

---

## CHECKLIST DE ARRANQUE

**Accesos**
[ ] Acceso a Supabase confirmado (mínimo SQL Editor + Policies)
[ ] Acceso a Google Cloud Console confirmado sobre el proyecto correcto
[ ] Acceso a Vercel confirmado (Environment Variables + logs)
[ ] Acceso de escritura a GitHub confirmado, o rama creada manualmente por un tercero
[ ] Acceso de lectura a los 4 proyectos de Apps Script confirmado

**Evidencia**
[ ] Dump del esquema de Supabase obtenido y guardado
[ ] Políticas RLS de `servidores_inscripcion`, `caminantes`, `pagos`, `transacciones` extraídas y documentadas
[ ] Lista de variables de entorno reales de Vercel confirmada
[ ] Logs de `/api/admin/impersonate` revisados (o confirmado que no están disponibles)
[ ] APIs habilitadas en el proyecto de Google Cloud confirmadas

**Decisiones**
[ ] Destino de `/api/admin/impersonate` decidido
[ ] Postura sobre reescribir el historial de git decidida

**Ejecución**
[ ] Cambio de URL de Supabase hardcodeada preparado en local
[ ] Cambio de las 4 URLs de Apps Script a variables de entorno preparado en local
[ ] `INSTRUCCIONES.md` actualizado con las 7 variables reales
[ ] API key + OAuth Client ID de Sheets rotados en Google Cloud
[ ] Esquema versionado como archivo `.sql` en el repositorio
[ ] Todo lo anterior publicado en GitHub

---

## CRITERIO DE GO

**¿Cuándo puede comenzar la Fase 0?** Ya puede comenzar. La preparación de código en local (URL de Supabase, URLs de Apps Script, `INSTRUCCIONES.md`) no tiene ningún bloqueo pendiente más allá de acceso al propio repositorio, que ya existe. La extracción de evidencia externa puede iniciar en cuanto se conceda **cada acceso individual** — no hace falta esperar a tener los cinco simultáneamente; cada uno desbloquea su propio tramo de forma independiente.

**¿Cuándo está terminada la Fase 0?** Cuando se cumplen los cuatro criterios de éxito ya definidos en `IMPLEMENTATION_ROADMAP.md`:
- Cero coincidencias de la clave de impersonación, la API key de Sheets y el OAuth Client ID en el código.
- `INSTRUCCIONES.md` documenta las 7 variables de entorno reales.
- Existe al menos un archivo `.sql` versionado con el esquema completo.
- Las políticas RLS de `servidores_inscripcion`, `caminantes`, `pagos` y `transacciones` están documentadas, cualquiera sea su estado real.

---

## CRITERIO DE NO-GO

Hallazgos que deberían **detener la ejecución de inmediato** y escalarse como incidente crítico, no tratarse como una tarea más de la checklist:

- **RLS**: si al extraer las políticas se confirma que `servidores_inscripcion`, `caminantes`, `pagos` o `transacciones` no tienen ninguna política activa, o son completamente permisivas para roles `anon`/`authenticated` → detener y tratarlo como exposición de datos activa, no como hallazgo de documentación.
- **Impersonación**: si los logs de Vercel o de Supabase Auth muestran evidencia de que `/api/admin/impersonate` fue invocada por alguien fuera del equipo conocido → detener todo y tratarlo como incidente de seguridad con investigación, no como tarea de rotación de credencial.
- **Credenciales**: si se confirma que la API key de Sheets ya expuesta tiene habilitadas APIs adicionales más allá de Sheets (por ejemplo, con alcance sobre Drive, Gmail, o datos personales) → escalar como exposición de mayor alcance del inicialmente estimado.
- **Accesos externos**: si se confirma que los 4 Apps Script o el proyecto de Google Cloud corren bajo una cuenta personal de alguien que ya no está activo en el equipo, y nadie más tiene esas credenciales → esto no es un hallazgo de auditoría, es una posible pérdida de control operativo sobre esas integraciones, y debe escalarse de inmediato, no esperar al ciclo normal de la Fase 0.
