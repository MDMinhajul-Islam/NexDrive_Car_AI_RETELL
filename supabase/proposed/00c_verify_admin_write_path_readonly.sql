-- READ-ONLY. Changes nothing. Confirms that a signed-in admin (role `authenticated`,
-- profiles.role = 'admin') can mint IDs and insert through admin_create_appointment and
-- admin_create_vehicle under the live grants and RLS policies.
-- Expect: every "ok" value true, and the three policy lists non-empty.
select jsonb_pretty(jsonb_build_object(
  'sequence_usage_for_authenticated', (
    select jsonb_object_agg(seq, has_sequence_privilege('authenticated', 'public.' || seq, 'USAGE'))
    from unnest(array['appointment_id_seq', 'lead_id_seq', 'customer_id_seq']) as seq
    where to_regclass('public.' || seq) is not null),
  'table_privileges_for_authenticated', (
    select jsonb_object_agg(t, jsonb_build_object(
             'select', has_table_privilege('authenticated', 'public.' || t, 'SELECT'),
             'insert', has_table_privilege('authenticated', 'public.' || t, 'INSERT'),
             'update', has_table_privilege('authenticated', 'public.' || t, 'UPDATE'),
             'delete', has_table_privilege('authenticated', 'public.' || t, 'DELETE')))
    from unnest(array['appointments', 'leads', 'vehicles', 'customers']) as t),
  'function_execute_for_authenticated', (
    select jsonb_object_agg(p.proname, has_function_privilege('authenticated', p.oid, 'execute'))
    from pg_proc p
    where p.pronamespace = 'public'::regnamespace
      and p.proname in ('admin_create_appointment', 'admin_create_vehicle', 'is_admin')),
  'functions_are_security_invoker', (
    select jsonb_object_agg(p.proname, not p.prosecdef)
    from pg_proc p
    where p.pronamespace = 'public'::regnamespace
      and p.proname in ('admin_create_appointment', 'admin_create_vehicle')),
  'policies', (
    select jsonb_object_agg(tablename, list)
    from (
      select tablename,
             jsonb_agg(jsonb_build_object('policy', policyname, 'cmd', cmd, 'roles', roles,
                                          'using', qual, 'with_check', with_check) order by cmd, policyname) as list
      from pg_policies
      where schemaname = 'public' and tablename in ('appointments', 'leads', 'vehicles', 'customers')
      group by tablename) x),
  'rls_enabled', (
    select jsonb_object_agg(relname, relrowsecurity)
    from pg_class
    where relnamespace = 'public'::regnamespace and relname in ('appointments', 'leads', 'vehicles', 'customers')),
  'vehicle_sequence_exists', (
    select coalesce(jsonb_agg(sequencename), '[]'::jsonb)
    from pg_sequences where schemaname = 'public' and sequencename ilike '%vehicle%')
)) as nexdrive_admin_write_path;
