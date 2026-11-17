-- Visibilidad de los roles del fin de semana (roles_retiro) para los servidores.
-- El líder puede cargar/sincronizar los roles cuando quiera; los servidores
-- solo los ven en su app cuando el líder prende este interruptor.
-- Arranca en false: los roles ya cargados quedan ocultos hasta que se publiquen.

alter table retiros
  add column if not exists roles_visibles boolean not null default false;

comment on column retiros.roles_visibles is 'Si es true, cada servidor ve sus roles del fin de semana (roles_retiro) en su app. Lo controla el líder desde Retiro → Roles.';

-- Para que la app del servidor se entere en vivo cuando el líder publica,
-- la tabla retiros debe estar en la publicación de Realtime.
do $$
begin
  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'retiros'
  ) then
    alter publication supabase_realtime add table retiros;
  end if;
end $$;
