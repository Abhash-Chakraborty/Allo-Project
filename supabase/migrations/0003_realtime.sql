-- =============================================================================
-- Allo: Supabase Realtime publication
-- =============================================================================
-- Allow the browser (anon role) to subscribe to changes on `reservations`
-- so the checkout page can flip from `pending → confirmed/released/expired`
-- without polling.
--
-- Notes
-- -----
-- * `supabase_realtime` is the publication Supabase creates by default.
--   We guard the ALTER so re-running the migration is a no-op.
-- * Only `reservations` is published. The browser doesn't need realtime
--   on `products`, `warehouses`, or `inventory` — those are loaded
--   server-side on each page render and are stable enough.
-- =============================================================================

do $$
begin
  if exists (select 1 from pg_publication where pubname = 'supabase_realtime') then
    -- Add `reservations` to the publication if it isn't already a member.
    if not exists (
      select 1
        from pg_publication_tables
       where pubname    = 'supabase_realtime'
         and schemaname = 'public'
         and tablename  = 'reservations'
    ) then
      alter publication supabase_realtime add table public.reservations;
    end if;
  end if;
end $$;
