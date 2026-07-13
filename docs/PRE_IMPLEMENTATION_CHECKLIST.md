# PRE_IMPLEMENTATION_CHECKLIST — Antes de tocar código

> Congela el roadmap en su estado actual (`IMPLEMENTATION_ROADMAP.md`, Fase 0 desglosada en el
> turno de "de diseño a ejecución") y consolida lo que hace falta **antes** de implementar: accesos,
> información a extraer, riesgos que siguen abiertos, y decisiones de negocio pendientes. No se ha
> hecho ningún cambio de código para producir este documento.

---

## 1. Accesos externos necesarios

| Sistema | Nivel de acceso necesario | Para qué se usa |
|---|---|---|
| **Supabase** | Owner/Admin del proyecto (`pckussxwvbpgjkmojpih.supabase.co`), o mínimo: SQL Editor + Database settings + Authentication → Policies. Idealmente también login de CLI (`supabase login` + project ref) para poder correr `db dump`. | Cerrar los vacíos de `DATABASE_SCHEMA.md` y `USER_ROLES.md`: esquema real, políticas RLS, aclarar columnas ambiguas |
| **Vercel** | Acceso al proyecto con permiso para ver/editar Environment Variables, y a los logs de invocación de funciones si están disponibles/retenidos | Confirmar la lista real de variables configuradas, configurar las nuevas de la Fase 0, revisar si `/api/admin/impersonate` se ha usado |
| **Google Cloud** | Rol de Editor (o superior) sobre "APIs & Services → Credentials" en el proyecto que respalda la API key de Sheets/OAuth Client ID y la de Vision | Rotar las credenciales expuestas (A3), confirmar qué APIs están habilitadas en ese proyecto |
| **Apps Script** | Acceso de al menos "Viewer" a los 4 proyectos de Apps Script desplegados (vía script.google.com, bajo la cuenta de Google que los posee) | Cerrar el mayor vacío de información de `EXTERNAL_INTEGRATIONS.md`: qué hacen realmente esos scripts, y confirmar el trigger que se sospecha conecta el Google Form |
| **GitHub** | Permiso "Contents: Read and write" para la integración de esta sesión sobre `EffetaMazuren/EffetaMazuren-App` | Subir el trabajo ya comiteado localmente y continuar el resto del roadmap con normalidad |

**Nota sobre GitHub:** el error confirmado en esta sesión fue específicamente al *crear* la rama
(`403 Resource not accessible by integration`), no al hacer push sobre una rama ya existente. Una
alternativa más rápida que ajustar el permiso de la app: que alguien con acceso cree manualmente la
rama `claude/repo-architecture-audit-in64v9` en GitHub (vacía o desde `main`), y yo reintento el push
sobre una rama que ya exista.

---

## 2. Información específica a extraer de cada acceso

### Supabase
- Dump completo del esquema: tablas, columnas, tipos, constraints, FKs, índices, triggers, funciones.
- Confirmar si existen `ON DELETE CASCADE` reales en las FKs, o si las cascadas manuales del código
  (`api/caminantes/[id]`, `dashboard/reuniones`) son la única protección.
- Políticas RLS completas de **todas** las tablas, con prioridad en `servidores_inscripcion`,
  `caminantes`, `pagos`, `transacciones`.
- Aclarar si `es_lider_palancas` y `palancas_lider` son columnas distintas con propósitos distintos,
  o un duplicado accidental.
- Confirmar si `asistencias.servidor_nombre` existe realmente (referenciada en
  `notifications/page.tsx` pero no vista escrita en ningún otro punto).
- Lista completa de buckets de Storage y sus políticas de acceso (público/privado) — hoy solo se
  conoce `comprobantes-pagos`.
- Tablas o columnas que el código actual no referencia — candidatas a limpieza, o pistas de
  funcionalidad planeada que nunca se conectó a la interfaz.

### Vercel
- Lista completa de variables de entorno configuradas (solo nombres) — para saber si hay más de las
  7 que el código ya referencia, o variables huérfanas de funcionalidad retirada.
- Logs de invocación de `/api/admin/impersonate`, si están disponibles — insumo directo para la
  decisión de negocio de la sección 4.
- Dominios configurados, protección de deployment, y si existe algún cron job configurado fuera del
  código del repositorio.

### Google Cloud
- Qué proyecto de GCP respalda la API key de Sheets/OAuth Client ID, y si es el mismo proyecto que
  respalda la API key de Vision.
- Qué APIs están habilitadas en ese proyecto — determina la superficie de riesgo real de la key ya
  expuesta (¿solo Sheets, o también otras APIs que un atacante podría usar con la misma credencial?).
- Quién más tiene acceso administrativo a ese proyecto.
- Restricciones actuales (o ausencia de ellas) sobre las credenciales existentes.

### Apps Script
- Código fuente completo de los 4 scripts desplegados (correos/hojas, mesas, cuartos, palancas).
- Triggers configurados en cada uno — en particular, confirmar si existe el trigger que se infiere
  conecta el Google Form con `/api/correos/forms/inscripcion`.
- Bajo qué cuenta de Google corren (institucional del grupo, o personal de alguien del equipo).
- A qué Sheets, Docs y Gmail tienen acceso exactamente cada uno.
- Estructura real del Google Form (campos) para confirmar que coincide con lo que
  `/api/correos/forms/inscripcion` espera recibir.

### GitHub
- Nivel de permiso real configurado para la instalación de la app en este repositorio.
- Si existen reglas de protección sobre `main` u otras ramas que puedan afectar el flujo de trabajo
  una vez se retome.

---

## 3. Riesgos que siguen siendo desconocidos hasta obtener esos accesos

| Riesgo | Por qué sigue abierto |
|---|---|
| Severidad real del hallazgo "15 de 18 pantallas de líder sin guard propio" | Depende enteramente de las políticas RLS — sin verlas, es un riesgo potencial documentado, no confirmado |
| Si ya hay datos huérfanos o inconsistentes en producción por las cascadas manuales | Solo se puede confirmar viendo las constraints reales de Supabase |
| Si la puerta trasera de `/api/admin/impersonate` fue explotada alguna vez | Solo verificable con logs de Vercel y/o Supabase Auth, ninguno accesible desde aquí |
| Alcance real de exposición de la API key de Sheets ya filtrada | Depende de qué otras APIs estén habilitadas en el proyecto de Google Cloud que la respalda |
| Si los Apps Script tienen alguna dependencia externa propia o vulnerabilidad no documentada | Su código fuente es hoy completamente opaco desde este repositorio |
| Si existen variables de entorno huérfanas en Vercel de funcionalidad ya retirada | Riesgo de confusión operativa más que de seguridad, pero sigue sin confirmarse |
| Si el Google Form dispara el flujo de inscripción por el mecanismo que se infiere, o por algo distinto y más frágil (automatización externa tipo Zapier/Make, o un paso manual) | No hay visibilidad de ese trigger desde este repositorio |

---

## 4. Decisiones de negocio antes de implementar

### Destino de `/api/admin/impersonate`
Tres caminos, sin decisión tomada todavía:
- **(a) Eliminar la ruta por completo** — si no hay evidencia de un uso legítimo de soporte.
- **(b) Proteger con autenticación real** — sesión de líder verificada + variable de entorno como
  segundo factor, en vez de la clave fija actual.
- **(c) Mantenerla temporalmente con la clave rotada** mientras se decide — no se recomienda como
  destino final, solo como puente si hace falta tiempo para decidir.

Los logs de Vercel (sección 1-2) son el insumo más directo para inclinar esta decisión.

### Modelo de personas
¿Se adopta el modelo completo **Persona + Participación** propuesto en la arquitectura objetivo
(Fase 4 del roadmap), o una versión más conservadora — por ejemplo, mantener `caminantes` y
`servidores_inscripcion` como tablas separadas pero con un `persona_id` compartido, sin fusionar del
todo? Esta decisión determina directamente el tamaño y el riesgo real de la Fase 4: el modelo
completo es más valioso a 5 años, pero es también la migración de datos más delicada de todo el plan.

### Estrategia multi-retiro
¿El sistema seguirá operando con **un solo retiro activo a la vez** (el modelo actual, simplemente
sin hardcodear el UUID), o se necesita soporte real para **retiros simultáneos o solapados** (por
ejemplo, si el grupo llegara a organizar más de un retiro en paralelo)? Esto cambia el diseño de
"retiro como contexto" (Fase 2/3): un solo retiro activo permite un contexto más simple que un
selector explícito por sesión de usuario.

### Historial de retiros
¿Cuántos años de historial deben quedar **activamente consultables**, y cuáles se archivan o
exportan después de cierto tiempo? Esta decisión no es solo de diseño de `retiro_estadisticas` — 
tiene implicación directa de **privacidad y retención de datos sensibles** (salud, documentos de
identidad de menores) que conviene decidir explícitamente, no dejar como comportamiento por defecto
de la base de datos.

---

## 5. Tareas ejecutables de inmediato en cuanto cada acceso esté disponible

| Acceso disponible | Qué se puede ejecutar el mismo día |
|---|---|
| **GitHub** (permiso de escritura) | Push de los 9 documentos ya comiteados localmente; mergear A1 (según decisión de la sección 4), A2, A4 (código) y B1, que ya pueden dejarse listos hoy sin ningún otro acceso |
| **Supabase** | C1 (dump del esquema) y D1 (extracción de políticas RLS) — de ahí se desbloquean casi de inmediato C2, C3, D2 y D3, que son documentación, no código |
| **Google Cloud** | A3 completa: revocar la API key expuesta, generar una nueva restringida, actualizar el código para referenciarla vía variable de entorno |
| **Apps Script** | Iniciar la tarea de investigación de la Fase 6 (leer el código de los 4 scripts) — no depende de que ninguna otra fase esté avanzada, puede arrancar en paralelo con todo lo demás |
| **Vercel** | Confirmar la lista real de variables de entorno, revisar logs para la decisión de `/api/admin/impersonate`, y configurar los valores reales de las nuevas variables de la tarea A4 |

---

## Ver también

Este documento consolida y no reemplaza: `USER_ROLES.md` (origen de los riesgos de RLS),
`EXTERNAL_INTEGRATIONS.md` (origen de los vacíos de Apps Script/Google Cloud),
`IMPLEMENTATION_ROADMAP.md` (Fase 0, de donde salen las tareas referenciadas aquí).
