-- Columnas de horario para eventos extraordinarios de asistencia, parte
-- del rediseño de la regla de "cuándo cuenta una asistencia". NO se aplica
-- desde esta sesión -- a ejecutar manualmente después de revisión, igual
-- que el resto de migraciones de este branch.
--
-- ALCANCE: 2 columnas nuevas, aditivas, en `reuniones`. Riesgo cero para
-- filas existentes -- nullable, sin default distinto de NULL.
--
-- ================================================================
-- POR QUÉ
-- ================================================================
-- La regla nueva de asistencia es: una selfie de asistencia solo cuenta
-- (no queda marcada `fuera_de_horario`) si se toma dentro de una ventana
-- de horario válida. Para las reuniones regulares de los martes, esa
-- ventana es fija (9:00pm-9:20pm, hardcodeada en
-- lib/asistencia-horario.ts, no necesita columna). Pero
-- `dashboard/reuniones/page.tsx` también permite a un líder crear eventos
-- extraordinarios (`tipo = 'especial'`, único valor que ese formulario
-- escribe hoy) para fechas y ocasiones fuera del calendario regular --
-- esos eventos necesitan su propia ventana de horario, configurable por
-- el líder al crearlos, porque no hay ninguna razón para que compartan la
-- ventana fija de los martes.
--
-- Nullable a propósito: una reunión regular (`tipo != 'especial'`) nunca
-- las usa. Un evento especial sin horario configurado (no debería pasar
-- una vez el formulario las pida, pero por si acaso) se trata como "sin
-- ventana válida" en `lib/asistencia-horario.ts` -- nunca cuenta, no se
-- adivina un horario por defecto.

alter table reuniones
  add column hora_inicio time null,
  add column hora_fin time null;
