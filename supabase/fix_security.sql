-- Fix 1: Recreate the view with SECURITY INVOKER (default) instead of SECURITY DEFINER
-- Drop and recreate without SECURITY DEFINER
create or replace view public.inventory_with_available
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

-- Fix 2 & 3: Revoke EXECUTE on rls_auto_enable from anon and authenticated
revoke execute on function public.rls_auto_enable() from anon, authenticated, public;
