-- Política mínima para que la pantalla de Identidades (solo lectura) funcione.
-- personas se creó con RLS habilitado y sin políticas (ver migración
-- 20260712000000_create_personas.sql) — sin esta política, ni siquiera
-- un líder puede leer la tabla.
--
-- Alcance: solo SELECT, solo para usuarios autenticados con rol 'lider'.
-- No se agrega INSERT/UPDATE/DELETE en esta fase — la pantalla es de
-- solo lectura, sin creación, edición, vinculación ni eliminación.

create policy "Lideres pueden ver personas"
on personas
for select
to authenticated
using (
  exists (
    select 1 from usuarios
    where usuarios.id = auth.uid()
    and usuarios.rol = 'lider'
  )
);
