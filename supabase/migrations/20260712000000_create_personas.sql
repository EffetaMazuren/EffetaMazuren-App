-- Primera capa de identidad de personas (Persona + Participación).
-- Alcance: solo estructura. Sin backfill, sin políticas RLS, sin cambios
-- de frontend ni de lógica de negocio existente.

create table personas (
  id uuid primary key default gen_random_uuid(),
  numero_documento_normalizado text unique,
  nombre_completo text not null,
  created_at timestamptz not null default now()
);

alter table personas enable row level security;

alter table caminantes
  add column id_persona uuid null references personas(id) on delete set null;

alter table servidores_inscripcion
  add column id_persona uuid null references personas(id) on delete set null;
