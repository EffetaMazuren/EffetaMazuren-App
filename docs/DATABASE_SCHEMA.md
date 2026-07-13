# DATABASE_SCHEMA — Tablas y estructuras de datos

> **Importante:** no hay migraciones en el repositorio (cero archivos `.sql`). Este inventario se
> reconstruyó leyendo cada `.from('tabla')` del código fuente y los tipos declarados en
> `lib/supabase.ts`. Es fiel a lo que el código realmente usa — no es un dump del esquema real de
> Supabase, y es posible que existan columnas o tablas adicionales no referenciadas por ninguna
> pantalla actual. Se recomienda contrastarlo con `supabase db dump` como primer paso de
> `MULTI_RETREAT_MIGRATION_PLAN.md` (Fase 0).

## 1. Núcleo del retiro

### `retiros`
Un registro por edición del retiro. Ya tiene las columnas que harían falta para dejar de
hardcodear cupo/meta/fechas en el código (ver `HARDCODED_RETREAT_DATA.md`).

| Columna | Tipo (inferido) | Notas |
|---|---|---|
| `id` | uuid | PK |
| `nombre` | text | |
| `fecha_inicio` | date | |
| `fecha_fin` | date | |
| `meta_financiera` | numeric | usada solo en `dashboard/page.tsx`; en otros archivos se reescribe como literal `50_000_000` |
| `capacidad_caminantes` | integer | usada solo parcialmente; en otros archivos se reescribe como literal `60` |
| `estado` | text | `'activo' \| 'archivado'` — casi toda consulta filtra por `estado = 'activo'` |

### `caminantes`
Participantes del retiro (adolescentes/jóvenes).

| Columna | Tipo (inferido) | Notas |
|---|---|---|
| `id` | uuid | PK |
| `retiro_id` | uuid | FK → `retiros.id` |
| `nombre` | text | |
| `tipo_documento`, `numero_documento` | text | usado también para detección de duplicados en la pre-inscripción |
| `celular`, `correo`, `direccion`, `barrio`, `telefono_fijo` | text | |
| `fecha_nacimiento`, `edad` | date / integer | |
| `talla_camiseta` | text | |
| `sacramentos` | text[] | array — **inconsistencia:** el formulario de alta de servidor guarda el campo equivalente como texto plano, no como array |
| `eps`, `alergias`, `restricciones_alimentarias`, `medicamentos` | text | datos de salud |
| `es_sorpresa` | boolean | si es true, las comunicaciones de pago van al contacto de emergencia, no al caminante |
| `es_dificil`, `motivo_dificil` | boolean / text | usado en `dashboard/retiro` para marcar casos que requieren atención especial |
| `estado_correo` | text | `'sin_enviar' \| 'enviado' \| 'enviado_contacto' \| 'pendiente_manual'` |
| `inscrito_oficialmente` | boolean | se activa cuando el total pagado ≥ umbral de inscripción (hoy `$500.000`, hardcodeado) |
| `fecha_inscripcion` | date | |
| `observaciones` | text | |
| `created_at` | timestamp | usado en `notifications/page.tsx` para detectar altas de las últimas 48h |

### `servidores_inscripcion`
Voluntarios/staff del retiro.

| Columna | Tipo (inferido) | Notas |
|---|---|---|
| `id` | uuid | PK |
| `retiro_id` | uuid | FK → `retiros.id` |
| `nombre`, `correo`, `numero_documento` | text | el buscador de `/servidor/registro` hace `ilike` sin autenticar sobre nombre y cédula |
| `es_interno` | boolean | interno paga inscripción; externo no |
| `usuario_id` | uuid | FK → `usuarios.id`, se autovincula la primera vez que el servidor entra a la app |
| `grupo` | text | ej. `'palancas'` — habilita la pestaña Palancas en su portal |
| `es_lider_palancas` | boolean | coordina todo el equipo Palancas |
| `palancas_lider` | boolean | campo distinto al anterior, usado en `dashboard/retiro` — **nombres muy parecidos para conceptos que pueden ser distintos**; recomendable documentar la diferencia o unificar |
| `inscrito_oficialmente` | boolean | se pone en `true` inmediatamente al dar de alta un servidor manualmente — inconsistente con el flujo de caminantes, que exige pago primero |
| `estado_correo` | text | igual que en `caminantes` |

### `contactos_emergencia`
Hasta 2 contactos por persona (caminante o servidor).

| Columna | Notas |
|---|---|
| `persona_id`, `tipo_persona` | `tipo_persona: 'caminante' \| 'servidor'` — relación polimórfica por convención, no por FK tipada |
| `nombre`, `parentesco`, `celular`, `orden` | `orden: 1 \| 2` |

### `usuarios`
Cuentas de la aplicación (1:1 con Supabase Auth, enlazadas por `id`).

| Columna | Notas |
|---|---|
| `id` | mismo UUID que `auth.users.id` |
| `nombre`, `correo` | |
| `rol` | `'lider' \| 'servidor'` — el único campo que decide a qué portal entra cada cuenta |
| `activo` | boolean |
| `dia_cumpleanos`, `mes_cumpleanos` | usados en el widget de cumpleaños del dashboard |

## 2. Dinero

### `pagos`
Abonos de caminantes y servidores — nunca se borran, se marcan como retirados.

| Columna | Notas |
|---|---|
| `persona_id`, `tipo_persona` | `'caminante' \| 'servidor'` |
| `retiro_id`, `valor`, `fecha` | |
| `comprobante_url`, `comprobante_nombre`, `comprobante_path` | |
| `registrado_por`, `notas` | |
| `estado` | `'pendiente' \| 'confirmado'` |
| `metodo_pago` | ej. `'transferencia'` |
| `retirado`, `fecha_retiro` | al eliminar un caminante, sus pagos no se borran: se marcan `retirado=true` para conservar el historial contable |

### `transacciones`
Ingresos y egresos generales, incluye la cola de reembolsos.

| Columna | Notas |
|---|---|
| `categoria_id` | FK → `categorias_financieras.id` |
| `tipo` | `'ingreso' \| 'egreso'` |
| `valor`, `descripcion`, `fecha` | |
| `comprobante_url`, `comprobante_nombre` | |
| `estado` | `'pendiente' \| 'aprobado' \| 'rechazado'` — un reembolso enviado por un servidor entra como `'pendiente'` y el líder lo aprueba/rechaza |
| `servidor_inscripcion_id` | quién solicitó el reembolso, si aplica |
| `usuario_id` | quién lo registró, si fue un movimiento directo |

### `categorias_financieras`

| Columna | Notas |
|---|---|
| `retiro_id`, `nombre`, `presupuesto` | |
| `tipo_cuenta` | ej. `'Nequi Effetá' \| 'Parroquia'` |
| `tipo_movimiento` | `'ingreso' \| 'egreso' \| 'ambos'` |
| `activa` | desactivar en vez de borrar conserva el historial de movimientos ya asociados |
| `orden` | |

### `cotizaciones_items`
Espejo en Supabase de un Google Sheet de cotizaciones de proveedores (ver `EXTERNAL_INTEGRATIONS.md`).

| Columna | Notas |
|---|---|
| `retiro_id`, `categoria`, `producto`, `cantidad` | |
| `precio_unidad`, `precio_total`, `proveedor` | |
| `pagado`, `notas` | únicos campos que **no** se sincronizan de vuelta al Sheet automáticamente en cada edición |
| `fila_sheet` | número de fila en el Google Sheet origen — acopla el modelo de datos a la posición física de una fila de spreadsheet |

## 3. Logística del retiro

| Tabla | Rol | Columnas observadas |
|---|---|---|
| `mesas` | Mesas de trabajo del fin de semana | `retiro_id`, `numero`, `adulto`, `lider`, `colider` |
| `asignaciones_mesa` | Caminante ↔ mesa | `persona_id`/`caminante_id`, `mesa_id`, `confirmado_por_lider` |
| `habitaciones` | Cuartos disponibles | `retiro_id`, nombre/número, capacidad |
| `asignaciones_habitacion` | Caminante ↔ cuarto | `caminante_id`, `habitacion_id` |
| `seguimiento_caminantes` | Registro de llamadas de la mesa a cada caminante | `caminante_id`, `llamado`, `contesto` |
| `roles_retiro` | Roles operativos del fin de semana | `retiro_id`, `rol`, `categoria`, `encargados` (array de nombres en texto libre, emparejados por lógica difusa — no por FK) |
| `minuto_minuto` | Cronograma | `retiro_id`, `dia` (`'viernes'\|'sabado'\|'domingo'`), `hora`, `actividad`, `encargado`, `tipo`, `bloque` |

## 4. Seguimiento, comunicación y equipo Palancas

| Tabla | Rol | Columnas observadas |
|---|---|---|
| `palancas_seguimiento` | Contacto del equipo Palancas con las familias de cada caminante | `retiro_id`, `caminante_nombre` (**por nombre, no por FK a `caminantes.id`**), `servidor_inscripcion_id`, `llamo`, `contesto`, `envio_cartas`, `envio_fotos`, `donde_dejo`, `notas`, `conoce_alguien`, `updated_at` |
| `asistencias` | Selfies de check-in a reuniones semanales | `servidor_inscripcion_id`, `reunion_id`, `fuera_de_horario`, `foto_url`; una consulta en `notifications/page.tsx` referencia una columna `servidor_nombre` que no se ve escrita en ningún otro punto — a verificar si existe realmente o es una consulta obsoleta |
| `reuniones` | Encuentros semanales previos al retiro | `retiro_id`, `fecha`, `nombre`, `cancelada`, `motivo_cancelacion` |
| `tareas_retiro` | To-do de organización | `retiro_id`, `titulo`, `estado` (`pendiente\|en_progreso\|completada\|no_realizada`), `prioridad` (`alta\|media\|baja`), `creado_por` |
| `mensajes_retiro` | Mensajería líder → servidores | `retiro_id`, `texto`, `tipo` (`general\|personalizado`), destinatarios, `editado`, `updated_at` |
| `diario_reflexion` | Diario personal del servidor | `servidor_inscripcion_id`, `texto`, `fecha` |

**Nota sobre `palancas_seguimiento.caminante_nombre`:** al eliminar un caminante,
`app/api/caminantes/[id]/route.ts` borra sus filas de `palancas_seguimiento` con un `ilike` sobre
el nombre, no por un `caminante_id`. Si dos caminantes comparten nombre, o si el nombre se edita
después de crear el seguimiento, el vínculo se pierde silenciosamente.

## 5. Vistas (solo lectura)

| Vista | Para qué se usa |
|---|---|
| `vista_pagos_caminantes` | Estado de pago consolidado por caminante — usada en casi toda la sección de caminantes (`id`, `total_pagado`, `saldo_pendiente`, `estado_pago`, `numero_abonos`) |
| `vista_pagos_servidores` | Equivalente para servidores |
| `vista_balance_retiro` | Balance financiero global (`total_ingresos`, `total_egresos`, `balance`, `falta_para_meta`) |
| `vista_cupos` | Cupos disponibles (`caminantes_con_abono`, `cupos_disponibles`, `cupo_lleno`) |

## 6. Storage

Un único bucket público: **`comprobantes-pagos`**, compartido entre:

- `finanzas/<retiro_id>/...` — comprobantes de ingresos/egresos generales
- `servidores/<id>/...` — comprobantes de pago y reembolsos de servidores
- `asistencias/<inscripcion_id>/...` — selfies de check-in
- Carpetas por nombre de caminante (normalizado) para comprobantes de pago de caminantes, subidos vía `/api/drive/upload`

No hay separación de buckets por sensibilidad del contenido (fotos de menores, datos financieros y
selfies de asistencia conviven en el mismo bucket público).

## 7. Relaciones no garantizadas por FK (cascadas manuales)

Varios flujos hacen en el código lo que normalmente haría una constraint `ON DELETE CASCADE`:

- Eliminar un caminante (`api/caminantes/[id]/route.ts`) borra manualmente 6 tablas relacionadas en
  orden, antes de borrar la fila de `caminantes` — si ese código se salta o cambia, quedan filas
  huérfanas.
- Eliminar una reunión (`dashboard/reuniones/page.tsx`) borra manualmente sus `asistencias` antes de
  borrar la `reunion`.

Esto sugiere que las FKs reales en Supabase **no** tienen `ON DELETE CASCADE` configurado, o que el
equipo prefirió no confiar en ello. Debe verificarse directamente en el esquema de Supabase.

## 8. Ver también

- `HARDCODED_RETREAT_DATA.md` — qué valores de estas tablas (`meta_financiera`,
  `capacidad_caminantes`, `fecha_inicio/fin`) existen pero el código ignora, reescribiéndolos como
  literales.
- `MULTI_RETREAT_MIGRATION_PLAN.md` (Fase 0) — recomendación de exportar y versionar este esquema
  como migraciones SQL antes de cualquier cambio estructural.
