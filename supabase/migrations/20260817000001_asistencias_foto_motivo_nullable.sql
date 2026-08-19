-- Continuación de 20260817000000: el marcado manual de asistencia por
-- parte del líder no sube foto ni genera un motivo de alerta (eso solo
-- aplica al auto-registro del servidor desde su propio celular), pero
-- ambas columnas estaban definidas como NOT NULL en `asistencias`.
--
-- Aditivo/no destructivo: solo relaja restricciones, no borra ni
-- modifica datos existentes.

alter table asistencias
  alter column foto_url drop not null,
  alter column motivo_alerta drop not null;
