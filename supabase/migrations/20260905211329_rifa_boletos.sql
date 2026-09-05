-- Rifa: venta de boletos numerados 00-99 por retiro. Un servidor registra el
-- pago (comprador, cédula, teléfono, quién vendió) con comprobante; el número
-- se reserva de inmediato para que no se venda dos veces mientras un líder lo
-- revisa. Si el líder lo rechaza, el número vuelve a quedar disponible.

create table rifa_boletos (
  id uuid primary key default gen_random_uuid(),
  retiro_id uuid not null references retiros(id),
  numero smallint not null check (numero between 0 and 99),
  comprador_nombre text not null,
  comprador_documento text not null,
  comprador_telefono text not null,
  vendedor_nombre text not null,
  comprobante_url text not null,
  comprobante_nombre text,
  estado text not null default 'pendiente' check (estado in ('pendiente', 'confirmado', 'rechazado')),
  registrado_por uuid references usuarios(id),
  created_at timestamptz not null default now()
);

-- Reserva atómica: solo puede existir UN boleto no rechazado por número y
-- retiro. Al rechazar uno, deja de contar aquí y el número queda libre de
-- nuevo para un intento distinto.
create unique index rifa_boletos_numero_activo
  on rifa_boletos (retiro_id, numero)
  where estado in ('pendiente', 'confirmado');

alter table rifa_boletos enable row level security;

create policy "Autenticados pueden ver boletos de rifa"
on rifa_boletos for select
to authenticated
using (true);

-- Solo aprobar/rechazar desde el cliente -- crear boletos pasa siempre por
-- /api/rifa/registrar (service_role), que maneja la carrera del número
-- ocupado y dispara el espejo hacia el Google Sheet.
create policy "Autenticados pueden actualizar boletos de rifa"
on rifa_boletos for update
to authenticated
using (true)
with check (true);
