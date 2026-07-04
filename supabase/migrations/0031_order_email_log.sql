-- Bitácora de cada intento de correo transaccional ligado a un pedido
-- (confirmación de pago, en camino, listo para recoger, gift cards).
-- Se escribe siempre vía service-role desde el server; el admin la ve
-- integrada en el timeline del pedido para saber qué correos llegaron
-- al cliente y cuáles fallaron (y por qué) sin ir a los logs de Resend.
create table if not exists order_email_log (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null references orders(id) on delete cascade,
  -- 'order_paid' | 'order_shipped' | 'order_ready'
  -- | 'gift_card_recipient' | 'gift_card_buyer'
  email_type text not null,
  -- NULL cuando no había destinatario (p.ej. cuenta sin correo).
  recipient text,
  success boolean not null,
  -- Razón del fallo tal como la reportó la capa de envío.
  error text,
  created_at timestamptz not null default now()
);

create index if not exists order_email_log_order_idx
  on order_email_log(order_id, created_at desc);

alter table order_email_log enable row level security;

-- Solo lectura para admins. No hay política de escritura: todas las
-- inserciones pasan por el cliente service-role, que ignora RLS. Los
-- clientes no ven esta tabla (los fallos de correo son internos).
drop policy if exists "order_email_log_admin_read" on order_email_log;
create policy "order_email_log_admin_read"
  on order_email_log for select using (is_admin());
