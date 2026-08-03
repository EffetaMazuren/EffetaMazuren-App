-- Habilita RLS en `caminantes` y crea las políticas necesarias para
-- cubrir TODOS los caminos confirmados en el inventario de Paso 1,
-- actualizado con la revisión directa del código real de los 4 Apps
-- Script (hecha por Antonia). NO se aplica desde esta sesión -- a
-- ejecutar manualmente después de revisión.
--
-- ESTADO ACTUAL: caminantes tiene RLS deshabilitado por completo. Hoy,
-- cualquiera con la anon key (pública, embebida en el bundle del
-- navegador) puede leer, insertar, actualizar o borrar cualquier fila
-- sin ninguna restricción de base de datos. Esta migración cierra esa
-- exposición sin romper ningún flujo confirmado.
--
-- ================================================================
-- RESUMEN DE COBERTURA (política -> qué caso del inventario cubre)
-- ================================================================
--
-- SELECT (authenticated): dashboard/caminantes/*, dashboard/retiro,
--   dashboard/identidades/*, notifications, servidor/palancas,
--   servidor/retiro. Ninguno de estos archivos tiene guard de rol
--   propio hoy -- esta política no lo agrega, solo exige sesión
--   iniciada. Ya es una mejora real: hoy la tabla es legible sin
--   sesión de ningún tipo.
--
-- SELECT (anon): cubre /api/correos/pago-completo, que corre
--   server-side pero con NEXT_PUBLIC_SUPABASE_ANON_KEY y sin sesión
--   (confirmado en Paso 1) -- sin esta política, esa ruta deja de
--   poder leer el caminante y el correo de "pago completo" se rompe
--   en silencio. Esta política no viene de los hallazgos de Apps
--   Script que compartió Antonia -- sale de mi propio inventario del
--   Paso 1, la agrego aquí porque de otro modo faltaría cobertura.
--
-- INSERT (authenticated): dashboard/caminantes/nuevo/page.tsx (alta
--   manual desde el dashboard).
--
-- INSERT (anon, acotado a retiro activo): onFormSubmit y
--   sincronizarTodasLasRespuestas en Apps Script, confirmados
--   insertando directo contra la API REST de Supabase con la clave
--   "publishable" (equivalente a anon). /api/correos/forms/inscripcion
--   NO es el camino real -- ver hallazgo de código muerto en el
--   resumen de esta sesión (no se toca en esta migración).
--
-- UPDATE (authenticated): dashboard/caminantes/[id] (observaciones,
--   es_sorpresa, inscrito_oficialmente), dashboard/retiro (es_dificil,
--   motivo_dificil), servidor/retiro (campos de salud), dashboard/
--   identidades/[id] (id_persona).
--
-- UPDATE (anon, acotado a retiro activo): el PATCH sobre estado_correo
--   que hace Apps Script con la clave publishable. Ver ADVERTENCIA DE
--   RIESGO abajo.
--
-- DELETE: sin política para anon ni authenticated -- el único DELETE
--   real corre en app/api/caminantes/[id]/route.ts con
--   SUPABASE_SERVICE_ROLE_KEY, que bypasea RLS siempre. Efecto
--   colateral positivo: hoy, con RLS deshabilitado, cualquiera con la
--   anon key podría borrar filas directamente; esta migración cierra
--   esa exposición sin afectar el flujo real de borrado.
--
-- No necesitan política nueva (bypasean RLS siempre, confirmado con
-- service_role): app/api/pagos/registrar/route.ts,
-- app/api/caminantes/[id]/route.ts, app/api/correos/inscripcion/route.ts,
-- y los scripts de comprobantes/palancas en Apps Script (confirmados
-- por Antonia usando service_role, no anon).
--
-- ================================================================
-- ADVERTENCIA DE RIESGO -- anon INSERT/UPDATE de superficie amplia
-- ================================================================
-- Las políticas para `anon` son necesarias porque Apps Script no tiene
-- sesión de usuario -- no existe auth.uid() en una petición anónima,
-- así que no se puede aplicar el patrón usuarios.rol = 'lider' que usa
-- el resto del proyecto. Lo único que RLS estándar permite acotar es
-- la FILA (vía USING/WITH CHECK), no la COLUMNA. Por eso:
--   - INSERT para anon exige que retiro_id apunte a un retiro con
--     estado = 'activo' -- evita insertar contra un retiro equivocado
--     o inexistente, pero no valida ningún otro campo del payload.
--   - UPDATE para anon, con el mismo acotamiento por retiro activo, en
--     la práctica permite modificar CUALQUIER columna de esa fila
--     (salud, inscrito_oficialmente, etc.), no solo estado_correo,
--     porque Postgres no ofrece restricción nativa por columna en
--     UPDATE sin una función adicional.
--
-- Esto es un trade-off consciente, no un descuido: prioriza no romper
-- el flujo real de Apps Script en esta migración. Recomendado como
-- endurecimiento posterior, fuera de esta migración (Fase 6/7): mover
-- el PATCH de estado_correo a una función Postgres con SECURITY
-- DEFINER expuesta vía RPC, restringida a esa sola columna, y retirar
-- el UPDATE directo para anon una vez Apps Script llame a esa función.
--
-- ================================================================
-- NO APLICAR SIN CONFIRMAR ANTES
-- ================================================================
-- Que ningún otro flujo de Apps Script (fuera de onFormSubmit,
-- sincronizarTodasLasRespuestas, y los scripts de comprobantes/
-- palancas que ya usan service_role) toque `caminantes` con la clave
-- anon/publishable de una forma no cubierta por estas políticas.
--
-- ================================================================
-- POLÍTICAS VIEJAS A ELIMINAR (halladas por Antonia en Supabase
-- Studio -> Database -> Policies, 2026-08-03)
-- ================================================================
-- `caminantes` ya tenía 4 políticas creadas de antes, inactivas hoy
-- solo porque RLS está apagado en la tabla. Si se dejan coexistir con
-- las 6 políticas nuevas de abajo, seguirían siendo la puerta abierta
-- real: Postgres combina políticas permisivas de la misma operación
-- con OR, así que la más permisiva gana sin importar cuántas
-- políticas más estrictas se agreguen. Se eliminan explícitamente por
-- nombre antes de crear las nuevas:
--
-- * "Acceso autenticado caminantes" (ALL, to public,
--   using auth.role() = 'authenticated') -- se reemplaza por las
--   políticas SELECT/INSERT/UPDATE separadas de abajo, con el mismo
--   alcance para authenticated pero sin el ALL implícito (que también
--   cubría DELETE, algo que esta migración deja fuera a propósito).
--
-- * "Insercion desde forms" (INSERT, to anon+authenticated,
--   with check true) -- sin acotar a retiro_id ni a retiro activo:
--   permite insertar caminantes contra cualquier retiro, existente o
--   no. Se reemplaza por el INSERT para anon acotado a retiro activo.
--
-- * "Insercion publica caminantes" (INSERT, to public,
--   with check true) -- redundante con la anterior, mismo problema de
--   falta de acotamiento, y más amplia todavía (to public en vez de
--   anon+authenticated).
--
-- * "Líderes actualizan caminantes" (UPDATE, to public, using true)
--   -- el nombre es engañoso: no verifica rol de líder en absoluto
--   (no hay referencia a `usuarios.rol` ni a auth.uid() en la
--   condición). En la práctica permite actualizar cualquier columna
--   de cualquier caminante, sin restricción de retiro_id ni de
--   sesión. Es la política más peligrosa de las 4.
--
-- Ninguna de estas 4 corresponde a un camino confirmado en el
-- inventario que no esté ya cubierto por las 6 políticas nuevas --
-- ver RESUMEN DE COBERTURA arriba.

drop policy if exists "Acceso autenticado caminantes" on caminantes;
drop policy if exists "Insercion desde forms" on caminantes;
drop policy if exists "Insercion publica caminantes" on caminantes;
drop policy if exists "Líderes actualizan caminantes" on caminantes;

alter table caminantes enable row level security;

-- SELECT autenticado (líder o servidor, sin distinción en esta migración)
create policy "Autenticados pueden leer caminantes"
on caminantes
for select
to authenticated
using (true);

-- SELECT anonimo -- necesario para /api/correos/pago-completo (anon key, sin sesión)
create policy "Anonimo puede leer caminantes"
on caminantes
for select
to anon
using (true);

-- INSERT autenticado -- alta manual desde el dashboard
create policy "Autenticados pueden crear caminantes"
on caminantes
for insert
to authenticated
with check (true);

-- INSERT anonimo, acotado al retiro activo -- onFormSubmit / sincronizarTodasLasRespuestas
create policy "Anonimo puede crear caminantes en el retiro activo"
on caminantes
for insert
to anon
with check (
  exists (
    select 1 from retiros
    where retiros.id = caminantes.retiro_id
    and retiros.estado = 'activo'
  )
);

-- UPDATE autenticado -- cubre todos los campos editados desde el dashboard/servidor hoy
create policy "Autenticados pueden actualizar caminantes"
on caminantes
for update
to authenticated
using (true)
with check (true);

-- UPDATE anonimo, acotado al retiro activo -- PATCH de estado_correo desde Apps Script
-- (ver ADVERTENCIA DE RIESGO: técnicamente cubre cualquier columna, no solo esa)
create policy "Anonimo puede actualizar caminantes en el retiro activo"
on caminantes
for update
to anon
using (
  exists (
    select 1 from retiros
    where retiros.id = caminantes.retiro_id
    and retiros.estado = 'activo'
  )
)
with check (
  exists (
    select 1 from retiros
    where retiros.id = caminantes.retiro_id
    and retiros.estado = 'activo'
  )
);

-- Sin política DELETE para anon ni authenticated -- deliberado. Ver nota arriba.
