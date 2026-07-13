# EXECUTIVE_SUMMARY — Revisión ejecutiva final

> Síntesis de los 10 documentos de auditoría y planificación ya producidos
> (`SYSTEM_MAP.md` → `PRE_IMPLEMENTATION_CHECKLIST.md`). Documento de cierre, no de detalle — cada
> afirmación aquí traza a un hallazgo ya sustentado en otro documento de `docs/`. Sin cambios de
> código.

---

## 1. ¿Cuál es el estado actual de la plataforma?

Effetá Mazuren **funciona hoy** para el IX Retiro: cubre pre-inscripción, pagos, logística del fin
de semana, seguimiento pastoral y finanzas de principio a fin, y está en producción. Pero es una
plataforma de **un solo retiro por construcción**, no por límite técnico: el UUID de esta edición
está escrito a mano en más de 20 archivos, varias reglas de negocio (precios, cupo, fechas) se
repiten como literales en vez de leerse de la base de datos que ya las tiene, y el respaldo hacia
Google (Sheets, Gmail, Forms) corre sobre 4 scripts sin código versionado ni autenticación propia.

A esto se suman dos exposiciones de seguridad activas — no hipotéticas — hoy en el código fuente
público del repositorio, y una ausencia casi total de capa de autorización centralizada en el
portal de líder. La plataforma no está rota; está **acoplada a una sola edición y con huecos de
seguridad reales que preceden cualquier conversación sobre multi-retiro**.

---

## 2. Los 10 hallazgos más importantes de toda la auditoría

| # | Hallazgo | Documento origen |
|---|---|---|
| 1 | Puerta trasera de administración (`/api/admin/impersonate`) protegida por una clave fija en el código, con acceso a la `service role key` | `USER_ROLES.md` |
| 2 | Credenciales de Google Cloud (API key + OAuth Client ID de Sheets) hardcodeadas y visibles en el navegador de cualquier visitante | `EXTERNAL_INTEGRATIONS.md`, `HARDCODED_RETREAT_DATA.md` |
| 3 | 15 de 18 pantallas de líder no verifican el rol dentro del componente — no existe `middleware.ts` ni guard centralizado | `USER_ROLES.md`, `ARCHITECTURE.md` |
| 4 | `RETIRO_ID` hardcodeado en más de 20 archivos — bloqueador estructural para cualquier segundo retiro | `HARDCODED_RETREAT_DATA.md` |
| 5 | Inconsistencia real de precio de servidor interno ($380.000 vs $260.000) — bug activo en producción, no solo deuda técnica | `HARDCODED_RETREAT_DATA.md`, `ARCHITECTURE.md` |
| 6 | Cuatro Google Apps Script funcionan como backend informal: sin código versionado, sin autenticación, con fallos silenciosos | `EXTERNAL_INTEGRATIONS.md` |
| 7 | Cero esquema de base de datos versionado — el modelo real solo existe dentro del panel de Supabase | `DATABASE_SCHEMA.md` |
| 8 | Políticas RLS de Supabase completamente desconocidas — determinan la severidad real de casi todos los hallazgos de permisos | `USER_ROLES.md`, `PRE_IMPLEMENTATION_CHECKLIST.md` |
| 9 | El modelo de datos separa `caminantes` y `servidores_inscripcion` sin identidad de persona unificada — bloquea historial multi-año y produce comportamientos inconsistentes entre ambos flujos | `DATABASE_SCHEMA.md`, arquitectura objetivo |
| 10 | Búsqueda no autenticada de nombre/cédula sobre toda la tabla de servidores en `/servidor/registro` | `USER_ROLES.md` |

---

## 3. Los 5 riesgos más críticos

| # | Riesgo | Por qué es crítico |
|---|---|---|
| 1 | Clave de impersonación expuesta con acceso a `service role key` | Es explotable **hoy**, sin necesitar ningún otro acceso — cualquiera con el repositorio puede generar una sesión de líder |
| 2 | Credenciales de Google Cloud expuestas en el bundle del navegador | Igual de explotable hoy; el alcance real depende de qué más tenga habilitado ese proyecto de Google Cloud (desconocido) |
| 3 | Ausencia de guard de rutas + RLS desconocido, combinados | Expone potencialmente datos de salud, identidad y finanzas de menores/jóvenes — la combinación de ambos vacíos es lo que lo vuelve crítico, no cada uno por separado |
| 4 | Dependencia total de 4 Apps Script sin versión de control ni autenticación | Punto único de fallo operativo: si uno deja de funcionar, ni el equipo ni el código lo detectan a tiempo |
| 5 | Ausencia de esquema versionado | Riesgo de pérdida irrecuperable de conocimiento del sistema si algo se corrompe o si quien tiene acceso administrativo hoy deja de estar disponible |

---

## 4. Qué resolver antes de comenzar la implementación

**Accesos** (detalle completo en `PRE_IMPLEMENTATION_CHECKLIST.md`): Supabase, Google Cloud, Apps
Script, Vercel, y GitHub con permiso de escritura real.

**Decisiones de negocio**, las cuatro sin resolver todavía:
- Destino de `/api/admin/impersonate` — eliminar, proteger, o mantener temporalmente con clave rotada.
- Nivel de ambición del modelo de personas — unificación completa (Persona + Participación) o algo más conservador.
- Estrategia multi-retiro — un retiro activo a la vez, o soporte real para ediciones simultáneas.
- Política de historial — cuántos años quedan activamente consultables, con qué implicación de retención de datos sensibles.

Sin al menos las políticas RLS confirmadas, cualquier estimación de urgencia relativa entre "arreglar
el guard de rutas" y "todo lo demás" sigue siendo, en parte, una apuesta informada — no un hecho
verificado.

---

## 5. MVP mínimo para operar el Retiro X sin tocar código

**Fase 0 + Fase 1 + Fase 2 completas, más una porción mínima de Fase 3** (crear y seleccionar un
retiro, sin necesitar clonado sofisticado). No requiere la migración de Persona + Participación —
esa es valiosa a 5 años, pero no es una condición para operar una edición más.

Criterio de éxito, en una frase: **un líder crea la fila del nuevo retiro, configura sus datos desde
una pantalla, lo marca como activo, y toda la aplicación funciona correctamente sobre esa edición —
sin que ningún desarrollador edite un archivo.**

---

## 6. Recomendación como arquitecto principal — próximos 90 días

| Días | Foco |
|---|---|
| 1–15 | Resolver accesos (Supabase, Google Cloud, Apps Script, GitHub) y tomar las 4 decisiones de negocio pendientes. Ejecutar Fase 0 completa apenas los accesos lleguen. |
| 15–30 | Fase 1 — guard de rutas centralizado. Bajo riesgo, alto impacto, ejecutable rápido una vez Fase 0 esté cerrada. |
| 30–75 | Fase 2 — eliminar `RETIRO_ID` hardcodeado y mover reglas de negocio a configuración, módulo por módulo con verificación manual en cada paso (es la fase de mayor volumen de cambio del roadmap). |
| 75–90 | Cierre del MVP: porción mínima de Fase 3, validación end-to-end con un segundo retiro de prueba. Congelar ahí como hito — Fases 4 a 7 quedan para el siguiente ciclo de planificación, no para este trimestre. |

En 90 días, la meta realista no es la arquitectura de 5 años — es **dejar de tener huecos de
seguridad activos y poder operar el siguiente retiro sin editar código**. Todo lo demás del roadmap
sigue siendo válido y ya está documentado, pero compite por tiempo con un objetivo más urgente y más
alcanzable en este horizonte.

### Recomendaciones clasificadas y priorizadas en orden de ejecución

| Orden | Recomendación | Clasificación |
|---|---|---|
| 1 | Retirar/rotar la clave de impersonación y las credenciales de Google expuestas | **Crítica** |
| 2 | Obtener acceso a Supabase y extraer las políticas RLS reales | **Crítica** |
| 3 | Documentar las variables de entorno reales y versionar el esquema de base de datos | **Crítica** |
| 4 | Construir el guard de rutas centralizado (`app/dashboard/layout.tsx`) | Importante |
| 5 | Eliminar el `RETIRO_ID` hardcodeado y mover precios/cupo/fechas a configuración | Importante |
| 6 | Corregir la inconsistencia de precio $260.000 / $380.000 | Importante |
| 7 | Construir el selector/creación mínima de retiro (cierre del MVP) | Importante |
| 8 | Leer el código de los 4 Apps Script e iniciar la decisión de Fase 6 (puede correr en paralelo, no bloquea el MVP) | Deseable |
| 9 | Migrar al modelo Persona + Participación | Deseable |
| 10 | Construir historial multi-año, estadísticas comparativas y rachas derivadas | Deseable |
| 11 | Consolidar componentes duplicados y cerrar funcionalidades a medias | Deseable |

---

## Ver también

Este documento resume y no reemplaza el detalle de: `SYSTEM_MAP.md`, `ARCHITECTURE.md`,
`DATA_FLOW.md`, `DATABASE_SCHEMA.md`, `EXTERNAL_INTEGRATIONS.md`, `USER_ROLES.md`,
`HARDCODED_RETREAT_DATA.md`, `MULTI_RETREAT_MIGRATION_PLAN.md`, `IMPLEMENTATION_ROADMAP.md`,
`PRE_IMPLEMENTATION_CHECKLIST.md`.
