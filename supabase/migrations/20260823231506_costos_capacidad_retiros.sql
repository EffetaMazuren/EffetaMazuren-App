-- Universalizar valores de negocio que estaban hardcodeados en el código
-- (costo de inscripción de caminantes/servidores y cupo de servidores),
-- para que cada retiro pueda tener sus propios valores.

alter table retiros
  add column if not exists costo_caminante numeric not null default 500000,
  add column if not exists costo_servidor numeric not null default 380000,
  add column if not exists capacidad_servidores integer not null default 44;

comment on column retiros.costo_caminante is 'Valor total de inscripción por caminante, en pesos.';
comment on column retiros.costo_servidor is 'Valor total de inscripción por servidor, en pesos.';
comment on column retiros.capacidad_servidores is 'Cupo máximo de servidores para este retiro (lo define el equipo de líderes).';
