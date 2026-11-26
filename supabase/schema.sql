-- ─────────────────────────────────────────────────────────────
--  SCHERZANDO.AR · Esquema de la base de datos.
--  Se ejecuta en el proyecto de Supabase PROPIO de Scherzando
--  (nunca en el del libro): SQL Editor → New query → pegar todo → Run.
--  Se puede ejecutar más de una vez: no borra tablas ni datos.
-- ─────────────────────────────────────────────────────────────

-- Contenido editable del sitio (una sola fila): textos, precio, stock, envíos, fotos.
create table if not exists public.settings (
  id          int primary key default 1 check (id = 1),
  content     jsonb not null default '{}'::jsonb,
  updated_at  timestamptz not null default now()
);
insert into public.settings (id, content) values (1, '{}'::jsonb) on conflict (id) do nothing;

-- Stock del mazo. Se descuenta en forma atómica al iniciar el pago y se devuelve
-- si el pago se rechaza o vence. Nunca puede quedar negativo.
create table if not exists public.inventory (
  sku         text primary key,
  available   integer not null default 0 check (available >= 0),
  updated_at  timestamptz not null default now()
);
insert into public.inventory (sku, available) values ('mazo', 0) on conflict (sku) do nothing;

-- Pedidos
create table if not exists public.orders (
  id                  uuid primary key default gen_random_uuid(),
  numero              bigint generated always as identity unique,
  created_at          timestamptz not null default now(),
  updated_at          timestamptz not null default now(),
  status              text not null default 'pendiente'
                      check (status in ('pendiente', 'en_proceso', 'pagado', 'rechazado', 'cancelado', 'vencido', 'devuelto')),
  access_key          text not null,
  email               text not null,
  first_name          text not null,
  last_name           text not null,
  dni                 text,
  phone               text not null,
  address             jsonb not null,          -- calle, número, piso, localidad, provincia, código postal, notas
  product_id          text not null default 'mazo',  -- producto comprado (sku del inventario)
  product_name        text,
  quantity            integer not null check (quantity between 1 and 20),
  unit_price          integer not null,
  items_total         integer not null,
  shipping_option     text not null,           -- id de la opción elegida
  shipping_label      text not null,           -- zona y modalidad, como se mostró al comprador
  shipping_cost       integer not null,
  shipping_source     text not null default 'tabla' check (shipping_source in ('tabla', 'micorreo')),
  agency_code         text,                    -- sucursal de Correo Argentino para retiro
  total               integer not null,
  currency            text not null default 'ARS',
  stock_reserved      boolean not null default false,
  reserved_until      timestamptz,
  mp_preference_id    text,
  mp_payment_id       text,
  mp_status           text,
  mp_status_detail    text,
  mp_live             boolean,
  paid_at             timestamptz,
  fulfillment_status  text not null default 'pendiente'
                      check (fulfillment_status in ('pendiente', 'preparando', 'despachado', 'entregado')),
  carrier             text not null default 'Correo Argentino',
  tracking            text,
  dispatched_at       timestamptz,
  micorreo_imported   boolean not null default false,
  admin_notes         text,
  emails_log          jsonb not null default '[]'::jsonb
);
create index if not exists orders_created_idx on public.orders (created_at desc);
create index if not exists orders_status_idx  on public.orders (status);
create index if not exists orders_payment_idx on public.orders (mp_payment_id);

-- Registro de errores y eventos importantes (webhooks, Correo Argentino, correo).
create table if not exists public.event_log (
  id          bigint generated always as identity primary key,
  at          timestamptz not null default now(),
  level       text not null check (level in ('info', 'aviso', 'error')),
  source      text not null,
  message     text not null,
  order_id    uuid references public.orders (id) on delete set null
);
create index if not exists event_log_at_idx on public.event_log (at desc);

-- Reserva atómica de stock. Devuelve false si no alcanza.
create or replace function public.reservar_stock(p_sku text, p_qty int)
returns boolean language plpgsql security definer set search_path = public as $$
begin
  update public.inventory set available = available - p_qty, updated_at = now()
   where sku = p_sku and available >= p_qty;
  return found;
end $$;

-- Devuelve stock reservado (pago vencido o cancelado) al producto del pedido. Idempotente.
create or replace function public.liberar_stock(p_order uuid)
returns boolean language plpgsql security definer set search_path = public as $$
declare q int; sku_ text;
begin
  update public.orders set stock_reserved = false, updated_at = now()
   where id = p_order and stock_reserved = true
   returning quantity, product_id into q, sku_;
  if not found then return false; end if;
  insert into public.inventory (sku, available) values (sku_, q)
    on conflict (sku) do update set available = public.inventory.available + excluded.available, updated_at = now();
  return true;
end $$;

-- Seguridad: RLS activado y sin políticas públicas.
-- Sólo el servidor (clave secreta, rol service_role) lee y escribe. El navegador no tiene acceso.
alter table public.settings  enable row level security;
alter table public.inventory enable row level security;
alter table public.orders    enable row level security;
alter table public.event_log enable row level security;

grant usage on schema public to service_role;
grant select, insert, update, delete on public.settings, public.inventory, public.orders, public.event_log to service_role;
grant usage, select on all sequences in schema public to service_role;
revoke all on public.settings, public.inventory, public.orders, public.event_log from anon, authenticated;

revoke all on function public.reservar_stock(text, int) from public, anon, authenticated;
revoke all on function public.liberar_stock(uuid) from public, anon, authenticated;
grant execute on function public.reservar_stock(text, int) to service_role;
grant execute on function public.liberar_stock(uuid) to service_role;

-- Depósito público para las fotografías que se suban desde el panel.
insert into storage.buckets (id, name, public) values ('publico', 'publico', true) on conflict (id) do nothing;
