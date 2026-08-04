-- Paso 2 (expansión aditiva) de la "Estrategia de migración de datos" para
-- Fase 4 -- Modelo Persona + Participación (ver IMPLEMENTATION_ROADMAP.md,
-- líneas 345-378). NO se aplica desde esta sesión -- a ejecutar
-- manualmente después de revisión, igual que las 4 migraciones previas de
-- este branch.
--
-- ALCANCE: crea 4 tablas nuevas y vacías. Riesgo cero para lo existente --
-- no toca `caminantes`, `servidores_inscripcion`, `pagos`,
-- `contactos_emergencia` ni `palancas_seguimiento`. No hay backfill (paso
-- 3 del roadmap -- el delicado, requiere script de normalización de
-- documento y tabla de excepciones, no una migración SQL) ni cambios de
-- frontend en esta migración. Igual que `personas`
-- (20260712000000_create_personas.sql), RLS se habilita en las 4 tablas
-- pero SIN políticas todavía -- quedan bloqueadas por defecto hasta que
-- exista un consumidor real y se diseñe el acceso, evitando repetir el
-- error de dejar una tabla sensible sin RLS por descuido.
--
-- ================================================================
-- INVENTARIO DE COLUMNAS -- verificado contra el código real, no solo
-- docs/DATABASE_SCHEMA.md (que se sabe incompleto)
-- ================================================================
-- Hallazgos que no estaban documentados y se incorporan aquí:
-- * `caminantes.conocido_en_retiro` -- dato de participación por edición
--   (app/servidor/retiro/page.tsx), no de identidad. Va en
--   participaciones_caminante.
-- * docs/DATABASE_SCHEMA.md dice `palancas_seguimiento.donde_dejo`, pero
--   el código real usa `donde_palancas` en todos los archivos que la
--   tocan. No se corrige el doc aquí (fuera de alcance) -- solo se anota
--   para no heredar el nombre equivocado en ningún diseño futuro.
-- * No hay campos de salud además de los 4 ya documentados (`eps`,
--   `alergias`, `restricciones_alimentarias`, `medicamentos`), y solo
--   existen en `caminantes` -- nunca en `servidores_inscripcion`.
-- * `pagos` y `contactos_emergencia` usan consistentemente `persona_id` +
--   `tipo_persona` (polimórfico por convención) en todo el código --
--   ningún camino usa `caminante_id`/`servidor_id` directo. Repuntar esas
--   dos tablas hacia `personas.id` queda fuera de esta migración.
--
-- ================================================================
-- DECISIONES DE DISEÑO
-- ================================================================
-- * Nombres de tabla en plural (personas_salud, retiros_participacion,
--   participaciones_caminante, participaciones_servidor) -- el roadmap
--   los nombra en singular, pero el resto del esquema (~20 tablas) es
--   consistentemente plural, y `personas` ya se desvió del roadmap hacia
--   plural. Se prioriza consistencia con el esquema real sobre el texto
--   literal del roadmap.
-- * FK como `persona_id` (sufijo), consistente con `retiro_id` y el resto
--   del esquema -- `id_persona` en la migración anterior
--   (20260712000000_create_personas.sql) queda como excepción histórica,
--   sin tocarla.
-- * Salud a nivel de persona, no de participación: una sola fila por
--   persona en personas_salud, no una por cada retiro. Asume que
--   EPS/alergias son estables entre ediciones; si cambian, se edita esa
--   fila en vez de crear una nueva.
-- * `retiros_participacion` es el registro común por persona por edición
--   de retiro (rol, estado_correo, inscrito_oficialmente,
--   fecha_inscripcion); `participaciones_caminante` /
--   `participaciones_servidor` son el detalle específico del rol, en
--   relación 1:1 con `retiros_participacion` vía `participacion_id`.
--   `unique (persona_id, retiro_id)` asume que una persona participa una
--   sola vez por edición (no puede ser caminante y servidor a la vez en
--   el mismo retiro) -- coherente con cómo operan hoy las dos tablas
--   viejas, mutuamente excluyentes por diseño.
-- * `es_lider_palancas` y `palancas_lider` se mantienen como dos campos
--   distintos en participaciones_servidor, tal como están hoy en
--   servidores_inscripcion -- docs/DATABASE_SCHEMA.md ya advierte que
--   pueden significar cosas diferentes; no es esta migración la que debe
--   decidir si se unifican.

-- ================================================================
-- personas_salud -- 1:1 con personas, salud estable entre ediciones
-- ================================================================
create table personas_salud (
  persona_id uuid primary key references personas(id) on delete cascade,
  eps text,
  alergias text,
  restricciones_alimentarias text,
  medicamentos text,
  updated_at timestamptz not null default now()
);

alter table personas_salud enable row level security;

-- ================================================================
-- retiros_participacion -- un registro por persona por edición de
-- retiro, con el rol jugado en esa edición
-- ================================================================
create table retiros_participacion (
  id uuid primary key default gen_random_uuid(),
  persona_id uuid not null references personas(id),
  retiro_id uuid not null references retiros(id),
  rol text not null check (rol in ('caminante', 'servidor')),
  estado_correo text,
  inscrito_oficialmente boolean not null default false,
  fecha_inscripcion date,
  created_at timestamptz not null default now(),
  unique (persona_id, retiro_id)
);

alter table retiros_participacion enable row level security;

-- ================================================================
-- participaciones_caminante -- detalle específico del rol caminante,
-- 1:1 con retiros_participacion cuando rol = 'caminante'
-- ================================================================
-- No incluye `nombre` (viene de personas.nombre_completo vía
-- persona_id), ni campos de salud (viven en personas_salud), ni
-- estado_correo/inscrito_oficialmente/fecha_inscripcion (viven en
-- retiros_participacion, compartidos con servidor).
create table participaciones_caminante (
  participacion_id uuid primary key references retiros_participacion(id) on delete cascade,
  tipo_documento text,
  numero_documento text,
  celular text,
  correo text,
  direccion text,
  barrio text,
  telefono_fijo text,
  fecha_nacimiento date,
  edad integer,
  talla_camiseta text,
  sacramentos text[],
  es_sorpresa boolean not null default false,
  es_dificil boolean not null default false,
  motivo_dificil text,
  observaciones text,
  conocido_en_retiro text
);

alter table participaciones_caminante enable row level security;

-- ================================================================
-- participaciones_servidor -- detalle específico del rol servidor,
-- 1:1 con retiros_participacion cuando rol = 'servidor'
-- ================================================================
create table participaciones_servidor (
  participacion_id uuid primary key references retiros_participacion(id) on delete cascade,
  correo text,
  numero_documento text,
  es_interno boolean not null default true,
  usuario_id uuid references usuarios(id),
  grupo text,
  es_lider_palancas boolean not null default false,
  palancas_lider boolean not null default false
);

alter table participaciones_servidor enable row level security;

-- ================================================================
-- FUERA DE ALCANCE DE ESTA MIGRACIÓN (deliberado)
-- ================================================================
-- * Backfill/migración de datos de caminantes/servidores_inscripcion
--   hacia estas tablas (paso 3 del roadmap).
-- * Repuntar pagos.persona_id / contactos_emergencia.persona_id hacia
--   personas.id (siguen apuntando a caminantes.id/servidores_inscripcion.id
--   como hoy).
-- * FK real para palancas_seguimiento.caminante_id (sigue usando
--   caminante_nombre en texto).
-- * Cualquier cambio de frontend o de rutas /api.
-- * Políticas RLS más allá de "habilitado, sin política" -- se agregan en
--   una migración aparte cuando exista un consumidor real.
