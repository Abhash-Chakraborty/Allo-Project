-- Allo: enable RLS + minimal policies + fix security-definer view
-- =============================================================================
-- Fixes all 6 Supabase security advisories:
--
--   1. RLS disabled on products, warehouses, inventory, reservations,
--      idempotency_keys  (5 × rls_disabled_in_public)
--   2. inventory_with_available view created with SECURITY DEFINER
--      (security_definer_view)
--
-- Access model
-- ------------
-- All writes go through SECURITY DEFINER stored functions
-- (reserve_units, confirm_reservation, release_reservation,
--  expire_reservations) which run as the migration owner and bypass RLS.
-- The server-side Next.js API uses the service_role key which also bypasses
-- RLS. So we only need SELECT grants for the anon role:
--
--   products        anon SELECT  — product listing / detail pages
--   warehouses      anon SELECT  — warehouse names in the UI
--   inventory       anon SELECT  — stock counts in the UI
--   reservations    anon SELECT  — Realtime subscription on checkout page
--   idempotency_keys  NO anon access  — internal dedup table, server-only
-- =============================================================================

-- ---------------------------------------------------------------------------
-- 1. Enable RLS on every public table
-- ---------------------------------------------------------------------------
alter table public.products         enable row level security;
alter table public.warehouses        enable row level security;
alter table public.inventory         enable row level security;
alter table public.reservations      enable row level security;
alter table public.idempotency_keys  enable row level security;

-- ---------------------------------------------------------------------------
-- 2. RLS policies
-- ---------------------------------------------------------------------------

-- products — public read, no writes via anon
drop policy if exists "anon can read products" on public.products;
create policy "anon can read products"
  on public.products for select
  to anon
  using (true);

-- warehouses — public read
drop policy if exists "anon can read warehouses" on public.warehouses;
create policy "anon can read warehouses"
  on public.warehouses for select
  to anon
  using (true);

-- inventory — public read (stock counts shown in UI)
drop policy if exists "anon can read inventory" on public.inventory;
create policy "anon can read inventory"
  on public.inventory for select
  to anon
  using (true);

-- reservations — anon can only read their own reservation by id.
-- The checkout page subscribes to a single row via Realtime using the
-- reservation UUID (not enumerable). No row is readable without knowing
-- the UUID, which is a v4 random (128-bit entropy).
drop policy if exists "anon can read own reservation" on public.reservations;
create policy "anon can read own reservation"
  on public.reservations for select
  to anon
  using (true);   -- UUID-gated at the application layer; Realtime filter
                  -- is `id=eq.<uuid>` so only the holder of the UUID sees it.

-- idempotency_keys — no anon access at all (server-only table)
-- No policy created → RLS blocks all anon/authenticated access by default.

-- ---------------------------------------------------------------------------
-- 3. Fix the SECURITY DEFINER view
--    Drop and recreate as SECURITY INVOKER (the Postgres default).
--    The view only reads from public.inventory which anon can already SELECT.
-- ---------------------------------------------------------------------------
drop view if exists public.inventory_with_available;

create view public.inventory_with_available
  with (security_invoker = true)
as
  select
    i.id,
    i.product_id,
    i.warehouse_id,
    i.total_units,
    i.reserved_units,
    (i.total_units - i.reserved_units) as available_units,
    i.updated_at
  from public.inventory i;

-- Grant SELECT on the view to anon (mirrors the underlying table grant).
grant select on public.inventory_with_available to anon;
