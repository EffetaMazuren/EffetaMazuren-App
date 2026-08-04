-- Política RLS necesaria para habilitar la vinculación de identidades
-- (Fase 4 — Persona + Participación).
--
-- Alcance corregido tras auditoría manual de Antonia en Supabase Studio
-- -> Database -> Policies (2026-07-12). La versión anterior de este
-- archivo proponía políticas UPDATE sobre `caminantes` y
-- `servidores_inscripcion` que resultaron innecesarias o inútiles:
--
-- * servidores_inscripcion: ya existe una política UPDATE llamada
--   "Autenticados pueden actualizar servidores", aplicada al rol
--   `authenticated` sin restricción adicional — el UPDATE de
--   `id_persona` para vincular servidores ya funciona hoy sin agregar
--   nada. Verificado directamente en el panel, no por inferencia.
--
-- * caminantes: RLS está DESHABILITADO en toda la tabla (no es que
--   falte una política — el toggle de RLS está apagado). Cualquier
--   política que se cree aquí no tendría ningún efecto mientras RLS
--   siga deshabilitado. Habilitar RLS en `caminantes` es una tarea
--   aparte y más grande — requiere auditar todos los caminos que leen
--   y escriben esa tabla (registro público, dashboard, borrado en
--   cascada, sincronización con Apps Script) antes de activarlo, para
--   no romper ninguno. Queda explícitamente fuera de alcance de esta
--   migración.
--
-- Por eso esta migración se reduce a la única política que sí hace
-- falta y sí tiene efecto: permitir que un líder cree una fila en
-- `personas` (necesario para app/dashboard/identidades/nueva/page.tsx).

create policy "Lideres pueden crear personas"
on personas
for insert
to authenticated
with check (
  exists (
    select 1 from usuarios
    where usuarios.id = auth.uid()
    and usuarios.rol = 'lider'
  )
);
