-- Allo: schedule expire_reservations() via Supabase pg_cron
-- =============================================================================
-- Runs `expire_reservations()` once per minute inside Postgres so we no
-- longer depend on an external HTTP cron (Vercel free-tier limits crons
-- to once per day, which is unusable for a 10-minute reservation TTL).
--
-- pg_cron lives in the `extensions` schema on Supabase. Scheduled jobs
-- live in the `cron` schema and run as the role that called
-- `cron.schedule` — here, the migration owner (postgres). That role has
-- privileges to call the SECURITY DEFINER function defined in
-- 0002_functions.sql, so the schedule "just works" without any extra
-- grants.
--
-- The schedule is idempotent: re-running this migration first
-- unschedules any existing job with the same name, then re-creates it.
-- =============================================================================

create extension if not exists pg_cron with schema extensions;

do $$
declare
  v_jobid bigint;
begin
  for v_jobid in
    select jobid from cron.job where jobname = 'allo-expire-reservations'
  loop
    perform cron.unschedule(v_jobid);
  end loop;
end $$;

select cron.schedule(
  'allo-expire-reservations',
  '* * * * *',
  $$select public.expire_reservations();$$
);
