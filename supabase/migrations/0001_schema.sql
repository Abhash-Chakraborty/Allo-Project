-- Allo inventory schema
-- =============================================================================
-- Allo: schema migration
-- =============================================================================
-- Tables for inventory + reservations with strict invariants on stock.
--
-- Notes
-- -----
-- * `gen_random_uuid()` requires the `pgcrypto` extension. Supabase enables
--   it by default, but we make it idempotent here for safety.
-- * The hot path is `inventory(product_id, warehouse_id)`. We back it with a
--   composite UNIQUE constraint so the row is the natural lock target for
--   `SELECT ... FOR UPDATE`.
-- * `reservations(status, expires_at)` is the index the cron / lazy expiry
--   scans. Partial indexes would shave a bit off but keep this simple.
-- * `idempotency_keys` is keyed on (key, endpoint) so that the same client
--   `Idempotency-Key` can be reused across distinct endpoints (e.g. reserve
--   and confirm) without colliding.
-- =============================================================================

create extension if not exists pgcrypto;

-- ---------------------------------------------------------------------------
-- products
-- ---------------------------------------------------------------------------
create table if not exists public.products (
  id            uuid        primary key default gen_random_uuid(),
  sku           text        not null unique,
  name          text        not null,
  description   text,
  price_cents   integer     not null check (price_cents >= 0),
  image_url     text,
  created_at    timestamptz not null default now()
);

-- ---------------------------------------------------------------------------
-- warehouses
-- ---------------------------------------------------------------------------
create table if not exists public.warehouses (
  id          uuid        primary key default gen_random_uuid(),
  code        text        not null unique,
  name        text        not null,
  location    text,
  created_at  timestamptz not null default now()
);

-- ---------------------------------------------------------------------------
-- inventory: total + reserved units per (product, warehouse)
-- The CHECK invariant `reserved_units <= total_units` is the single
-- correctness guarantee enforced at the DB layer; nothing else can violate
-- it without a CHECK violation rolling the txn back.
-- ---------------------------------------------------------------------------
create table if not exists public.inventory (
  id              uuid        primary key default gen_random_uuid(),
  product_id      uuid        not null references public.products(id)   on delete cascade,
  warehouse_id    uuid        not null references public.warehouses(id) on delete cascade,
  total_units     integer     not null default 0 check (total_units >= 0),
  reserved_units  integer     not null default 0
                              check (reserved_units >= 0
                                 and reserved_units <= total_units),
  updated_at      timestamptz not null default now(),
  unique (product_id, warehouse_id)
);

create index if not exists inventory_product_idx   on public.inventory(product_id);
create index if not exists inventory_warehouse_idx on public.inventory(warehouse_id);

-- ---------------------------------------------------------------------------
-- reservation_status enum (idempotent)
-- ---------------------------------------------------------------------------
do $$
begin
  if not exists (select 1 from pg_type where typname = 'reservation_status') then
    create type public.reservation_status as enum
      ('pending', 'confirmed', 'released', 'expired');
  end if;
end $$;

-- ---------------------------------------------------------------------------
-- reservations
-- ---------------------------------------------------------------------------
create table if not exists public.reservations (
  id            uuid                       primary key default gen_random_uuid(),
  product_id    uuid                       not null references public.products(id),
  warehouse_id  uuid                       not null references public.warehouses(id),
  quantity      integer                    not null check (quantity > 0),
  status        public.reservation_status  not null default 'pending',
  expires_at    timestamptz                not null,
  created_at    timestamptz                not null default now(),
  confirmed_at  timestamptz,
  released_at   timestamptz,
  expired_at    timestamptz,
  customer_ref  text
);

create index if not exists reservations_status_expires_idx
  on public.reservations(status, expires_at);
create index if not exists reservations_product_warehouse_idx
  on public.reservations(product_id, warehouse_id);

-- ---------------------------------------------------------------------------
-- idempotency_keys (bonus)
-- ---------------------------------------------------------------------------
create table if not exists public.idempotency_keys (
  key            text        not null,
  endpoint       text        not null,
  request_hash   text        not null,
  status_code    integer     not null,   -- 0 = in-flight; >0 = final HTTP status
  response_body  jsonb       not null,
  created_at     timestamptz not null default now(),
  primary key (key, endpoint)
);

create index if not exists idempotency_keys_created_idx
  on public.idempotency_keys(created_at);

-- ---------------------------------------------------------------------------
-- inventory_with_available view
-- A convenience view exposing `available_units` so the products endpoint
-- can read it in a single round-trip.
-- ---------------------------------------------------------------------------
create or replace view public.inventory_with_available as
  select
    i.id,
    i.product_id,
    i.warehouse_id,
    i.total_units,
    i.reserved_units,
    (i.total_units - i.reserved_units) as available_units,
    i.updated_at
  from public.inventory i;
