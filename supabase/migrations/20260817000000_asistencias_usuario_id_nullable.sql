-- El líder ahora puede marcar asistencia manualmente desde el dashboard
-- para cualquier servidor inscrito, incluso los que todavía no han creado
-- su cuenta / iniciado sesión en la app (usuario_id null en
-- servidores_inscripcion). La tabla `asistencias` tenía usuario_id como
-- NOT NULL, lo cual bloqueaba ese caso con un error de constraint.
--
-- Aditivo/no destructivo: solo relaja una restricción, no borra ni
-- modifica datos existentes.

alter table asistencias
  alter column usuario_id drop not null;
