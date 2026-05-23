-- =============================================================================
-- Allo: stored functions for race-condition-free inventory mutations
-- =============================================================================
-- The invariant we have to defend is:
--
--      reserved_units <= total_units      (per inventory row)
--
-- Approach:
--   Every state-changing function takes a row-level lock on the relevant
--   `inventory` row with `SELECT ... FOR UPDATE` *before* deciding whether
--   the mutation is allowed. Postgres serializes those locks, so even with
--   N concurrent reserve calls for the last unit, exactly one wins; the
--   others see the updated `reserved_units` and raise INSUFFICIENT_STOCK.
--
-- Error signaling:
--   Postgres exceptions surface to PostgREST (and therefore the Supabase
--   client) as RPC errors with `code` and `message`. We use:
--
--     22023  → INSUFFICIENT_STOCK (mapped to HTTP 409 by the API layer)
--     P0002  → NOT_FOUND          (mapped to HTTP 404)
--     22023 with token RESERVATION_EXPIRED (mapped to HTTP 410)
--     22023 with token RESERVATION_RELEASED / ALREADY_CONFIRMED (HTTP 409)
--
--   The application layer matches on the textual token of MESSAGE_TEXT
--   so we can keep one SQLSTATE for "client-side" errors. See
--   `src/lib/api-error.ts`.
-- =============================================================================

-- ---------------------------------------------------------------------------
-- reserve_units
--   * Locks the (product, warehouse) inventory row.
--   * Atomically increments reserved_units and inserts a `pending`
--     reservation expiring at now() + p_ttl_seconds.
--   * Raises INSUFFICIENT_STOCK if available < requested quantity.
-- ---------------------------------------------------------------------------
create or replace function public.reserve_units(
  p_product_id    uuid,
  p_warehouse_id  uuid,
  p_quantity      integer,
  p_ttl_seconds   integer,
  p_customer_ref  text default null
) returns public.reservations
language plpgsql
security definer
set search_path = public
as $$
declare
  v_inv         public.inventory%rowtype;
  v_available   integer;
  v_reservation public.reservations;
begin
  if p_quantity is null or p_quantity <= 0 then
    raise exception 'INVALID_QUANTITY' using errcode = '22023';
  end if;
  if p_ttl_seconds is null or p_ttl_seconds <= 0 then
    raise exception 'INVALID_TTL' using errcode = '22023';
  end if;

  -- Take the row-level lock. Concurrent reservers wait here.
  select * into v_inv
    from public.inventory
   where product_id   = p_product_id
     and warehouse_id = p_warehouse_id
   for update;

  if not found then
    raise exception 'INVENTORY_NOT_FOUND' using errcode = 'P0002';
  end if;

  v_available := v_inv.total_units - v_inv.reserved_units;

  if v_available < p_quantity then
    raise exception 'INSUFFICIENT_STOCK available=% requested=%',
      v_available, p_quantity
      using errcode = '22023';
  end if;

  update public.inventory
     set reserved_units = reserved_units + p_quantity,
         updated_at     = now()
   where id = v_inv.id;

  insert into public.reservations
    (product_id, warehouse_id, quantity, status, expires_at, customer_ref)
  values
    (p_product_id, p_warehouse_id, p_quantity, 'pending',
     now() + make_interval(secs => p_ttl_seconds), p_customer_ref)
  returning * into v_reservation;

  return v_reservation;
end;
$$;

-- ---------------------------------------------------------------------------
-- confirm_reservation
--   * Locks the reservation, then the inventory row.
--   * If pending and not expired: status → confirmed, total_units AND
--     reserved_units both decrement by quantity (because the reservation
--     is consumed: the units leave the warehouse).
--   * If already confirmed: idempotent return.
--   * If expired (or expires_at <= now()): atomically expire it (release
--     the held units) and raise RESERVATION_EXPIRED.
--   * If already released: raise RESERVATION_RELEASED.
-- ---------------------------------------------------------------------------
create or replace function public.confirm_reservation(p_id uuid)
returns public.reservations
language plpgsql
security definer
set search_path = public
as $$
declare
  v_res public.reservations;
  v_now timestamptz := now();
begin
  -- Lock the reservation row first so two confirms don't race.
  select * into v_res from public.reservations where id = p_id for update;

  if not found then
    raise exception 'RESERVATION_NOT_FOUND' using errcode = 'P0002';
  end if;

  if v_res.status = 'confirmed' then
    return v_res;  -- idempotent
  end if;

  if v_res.status = 'released' then
    raise exception 'RESERVATION_RELEASED' using errcode = '22023';
  end if;

  if v_res.status = 'expired' then
    raise exception 'RESERVATION_EXPIRED' using errcode = '22023';
  end if;

  -- status is pending; check time.
  if v_res.expires_at <= v_now then
    -- Lazy expiry: release the held units and mark expired, then 410.
    update public.inventory
       set reserved_units = greatest(reserved_units - v_res.quantity, 0),
           updated_at     = v_now
     where product_id   = v_res.product_id
       and warehouse_id = v_res.warehouse_id;

    update public.reservations
       set status     = 'expired',
           expired_at = v_now
     where id = p_id
     returning * into v_res;

    raise exception 'RESERVATION_EXPIRED' using errcode = '22023';
  end if;

  -- Lock and consume from inventory.
  perform 1 from public.inventory
    where product_id   = v_res.product_id
      and warehouse_id = v_res.warehouse_id
    for update;

  update public.inventory
     set total_units    = total_units    - v_res.quantity,
         reserved_units = reserved_units - v_res.quantity,
         updated_at     = v_now
   where product_id   = v_res.product_id
     and warehouse_id = v_res.warehouse_id;

  update public.reservations
     set status       = 'confirmed',
         confirmed_at = v_now
   where id = p_id
   returning * into v_res;

  return v_res;
end;
$$;

-- ---------------------------------------------------------------------------
-- release_reservation
--   * Pending          → released (inventory units returned).
--   * Released/expired → idempotent return.
--   * Confirmed        → raise RESERVATION_ALREADY_CONFIRMED.
-- ---------------------------------------------------------------------------
create or replace function public.release_reservation(p_id uuid)
returns public.reservations
language plpgsql
security definer
set search_path = public
as $$
declare
  v_res public.reservations;
  v_now timestamptz := now();
begin
  select * into v_res from public.reservations where id = p_id for update;

  if not found then
    raise exception 'RESERVATION_NOT_FOUND' using errcode = 'P0002';
  end if;

  if v_res.status in ('released', 'expired') then
    return v_res;  -- idempotent
  end if;

  if v_res.status = 'confirmed' then
    raise exception 'RESERVATION_ALREADY_CONFIRMED' using errcode = '22023';
  end if;

  -- status is pending → release.
  update public.inventory
     set reserved_units = greatest(reserved_units - v_res.quantity, 0),
         updated_at     = v_now
   where product_id   = v_res.product_id
     and warehouse_id = v_res.warehouse_id;

  update public.reservations
     set status      = 'released',
         released_at = v_now
   where id = p_id
   returning * into v_res;

  return v_res;
end;
$$;

-- ---------------------------------------------------------------------------
-- expire_reservations
--   * Bulk-expire all `pending` reservations whose expires_at has passed.
--   * Uses `FOR UPDATE SKIP LOCKED` so two concurrent runs (cron + lazy
--     cleanup) never block each other; whichever takes the lock first
--     wins, the other simply sees fewer rows to process.
--   * Returns the number of reservations expired.
-- ---------------------------------------------------------------------------
create or replace function public.expire_reservations()
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  v_count integer := 0;
  r       public.reservations%rowtype;
  v_now   timestamptz := now();
begin
  for r in
    select * from public.reservations
     where status = 'pending'
       and expires_at <= v_now
     for update skip locked
  loop
    update public.inventory
       set reserved_units = greatest(reserved_units - r.quantity, 0),
           updated_at     = v_now
     where product_id   = r.product_id
       and warehouse_id = r.warehouse_id;

    update public.reservations
       set status     = 'expired',
           expired_at = v_now
     where id = r.id;

    v_count := v_count + 1;
  end loop;

  return v_count;
end;
$$;

-- ---------------------------------------------------------------------------
-- Permissions
-- ---------------------------------------------------------------------------
-- Service-role already has full access. Allow `anon` and `authenticated`
-- to call the RPCs is NOT required for this app — all writes go through
-- our server API. We deliberately grant nothing to `anon`/`authenticated`
-- on the mutation functions to keep the surface area tight.
revoke all on function public.reserve_units(uuid, uuid, integer, integer, text) from public, anon, authenticated;
revoke all on function public.confirm_reservation(uuid) from public, anon, authenticated;
revoke all on function public.release_reservation(uuid) from public, anon, authenticated;
revoke all on function public.expire_reservations()     from public, anon, authenticated;
