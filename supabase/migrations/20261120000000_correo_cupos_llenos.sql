-- Correo de "cupos llenos": se envía a los caminantes inscritos en el
-- retiro activo que NO tienen ningún pago ni abono registrado.
--
-- 1) Cada retiro guarda su propia versión del asunto y del texto.
--    Si están vacíos (NULL), la app usa el texto por defecto
--    (lib/cupos-llenos.ts), así que un retiro nuevo arranca con él.
-- 2) La tabla correos_cupos_llenos es la cola de envío: la app agrega
--    filas 'pendiente' cuando un líder confirma el envío, y el Apps Script
--    de correos las envía (respetando el cupo diario de Gmail) y las marca
--    'enviado'. Así nadie recibe el correo dos veces.

alter table retiros
  add column if not exists cupos_llenos_asunto text,
  add column if not exists cupos_llenos_texto text;

create table if not exists correos_cupos_llenos (
  id uuid primary key default gen_random_uuid(),
  retiro_id uuid not null references retiros(id) on delete cascade,
  caminante_id uuid not null references caminantes(id) on delete cascade,
  nombre text not null,
  correo text not null,
  asunto text not null,
  cuerpo text not null,
  estado text not null default 'pendiente'
    check (estado in ('pendiente', 'enviado', 'error', 'cancelado')),
  error text,
  creado_por uuid,
  creado_at timestamptz not null default now(),
  enviado_at timestamptz,
  unique (retiro_id, caminante_id)
);

create index if not exists correos_cupos_llenos_estado_idx
  on correos_cupos_llenos (estado, creado_at);

-- Solo se maneja con service_role (API de la app y Apps Script).
alter table correos_cupos_llenos enable row level security;

notify pgrst, 'reload schema';
