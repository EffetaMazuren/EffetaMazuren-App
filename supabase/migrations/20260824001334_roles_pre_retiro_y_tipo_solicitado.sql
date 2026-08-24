-- Roles PRE-retiro: distintos de roles_retiro (que es la logística del fin de
-- semana del retiro). Estos son roles que el líder define y asigna a uno o
-- varios servidores ANTES del retiro, con instrucciones, y que cada servidor
-- ve en su propia app.

create table roles_pre_retiro (
  id uuid primary key default gen_random_uuid(),
  retiro_id uuid not null references retiros(id),
  nombre text not null,
  instrucciones text,
  created_at timestamptz not null default now()
);

create table roles_pre_retiro_asignaciones (
  id uuid primary key default gen_random_uuid(),
  rol_id uuid not null references roles_pre_retiro(id) on delete cascade,
  servidor_inscripcion_id uuid not null references servidores_inscripcion(id) on delete cascade,
  created_at timestamptz not null default now(),
  unique (rol_id, servidor_inscripcion_id)
);

alter table roles_pre_retiro enable row level security;
alter table roles_pre_retiro_asignaciones enable row level security;

create policy "Autenticados pueden ver roles pre-retiro"
on roles_pre_retiro for select
to authenticated
using (true);

create policy "Autenticados pueden gestionar roles pre-retiro"
on roles_pre_retiro for all
to authenticated
using (true)
with check (true);

create policy "Autenticados pueden ver asignaciones de roles pre-retiro"
on roles_pre_retiro_asignaciones for select
to authenticated
using (true);

create policy "Autenticados pueden gestionar asignaciones de roles pre-retiro"
on roles_pre_retiro_asignaciones for all
to authenticated
using (true)
with check (true);

-- Preferencia que la persona indica al auto-registrarse ('angelito' o
-- 'interno'): es solo una solicitud -- el líder sigue decidiendo es_interno
-- manualmente como ya hace hoy, esta columna no lo cambia automáticamente.
alter table servidores_inscripcion
  add column if not exists tipo_solicitado text
  check (tipo_solicitado is null or tipo_solicitado in ('angelito', 'interno'));

comment on column servidores_inscripcion.tipo_solicitado is 'Preferencia indicada por la persona al auto-registrarse: angelito o interno. No determina es_interno, solo lo sugiere.';
