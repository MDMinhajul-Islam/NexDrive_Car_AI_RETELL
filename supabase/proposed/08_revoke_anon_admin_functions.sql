-- 08: Tighten execute rights. grant / revoke only; no function, table or policy changes.
--
-- The 07 verification showed anon can still execute the admin and dashboard functions.
-- Cause: files 01, 03 and 04 revoked execute from PUBLIC, but Supabase grants execute on
-- every new public function to anon and authenticated by name (default privileges), and
-- revoking from PUBLIC does not remove those named grants.
--
-- Impact today: none that I can find. Each of these functions is SECURITY INVOKER and
-- starts with `if not public.is_admin() then raise`, and is_admin() is false for anon,
-- so an anonymous call fails with "not authorized" before touching any table (RLS would
-- block it as well). This file removes the grant anyway, so the roles match the intent.
--
-- Left as they are, on purpose:
--   public.inventory_facets()  anon needs it for the public inventory filters
--   public.is_admin()          returns false for anon; kept so a future policy that
--                              applies to anon can never fail on a missing privilege

revoke all on function public.admin_create_vehicle(jsonb) from public, anon;
revoke all on function public.dashboard_kpis(date, date) from public, anon;
revoke all on function public.dashboard_bookings_over_time(date, date) from public, anon;
revoke all on function public.dashboard_bookings_by_status(date, date) from public, anon;
revoke all on function public.dashboard_top_vehicles(date, date, integer) from public, anon;
revoke all on function public.dashboard_bookings_by_weekday(date, date) from public, anon;
revoke all on function public.dashboard_bookings_by_hour(date, date) from public, anon;
revoke all on function public.dashboard_inventory_breakdown(text) from public, anon;

grant execute on function public.admin_create_vehicle(jsonb) to authenticated;
grant execute on function public.dashboard_kpis(date, date) to authenticated;
grant execute on function public.dashboard_bookings_over_time(date, date) to authenticated;
grant execute on function public.dashboard_bookings_by_status(date, date) to authenticated;
grant execute on function public.dashboard_top_vehicles(date, date, integer) to authenticated;
grant execute on function public.dashboard_bookings_by_weekday(date, date) to authenticated;
grant execute on function public.dashboard_bookings_by_hour(date, date) to authenticated;
grant execute on function public.dashboard_inventory_breakdown(text) to authenticated;

-- Read-only check: every row should show anon = false, authenticated = true.
select p.proname as function,
       has_function_privilege('anon', p.oid, 'execute') as anon,
       has_function_privilege('authenticated', p.oid, 'execute') as authenticated
from pg_proc p
where p.pronamespace = 'public'::regnamespace
  and (p.proname like 'dashboard\_%' or p.proname like 'admin\_%')
order by 1;
