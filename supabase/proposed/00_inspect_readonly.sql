-- READ-ONLY diagnostics. Changes nothing. Run in the Supabase SQL editor and paste the result back.
-- It answers what the anon key cannot see: allowed status values, existing RLS policies,
-- check constraints, function bodies and storage buckets.
select jsonb_pretty(jsonb_build_object(
  'appointment_status',  (select jsonb_agg(distinct status) from public.appointments),
  'appointment_types',   (select jsonb_agg(distinct appointment_type) from public.appointments),
  'appointment_created_by', (select jsonb_agg(distinct created_by) from public.appointments),
  'sample_appointment_ids', (select jsonb_agg(appointment_id) from (select appointment_id from public.appointments order by created_at desc limit 3) s),
  'vehicle_status',      (select jsonb_agg(distinct vehicle_status) from public.vehicles),
  'vehicle_condition',   (select jsonb_agg(distinct condition) from public.vehicles),
  'body_types',          (select jsonb_agg(distinct body_type) from public.vehicles),
  'fuel_types',          (select jsonb_agg(distinct fuel_type) from public.vehicles),
  'transmissions',       (select jsonb_agg(distinct transmission) from public.vehicles),
  'row_counts',          jsonb_build_object(
      'vehicles', (select count(*) from public.vehicles),
      'appointments', (select count(*) from public.appointments),
      'customers', (select count(*) from public.customers),
      'leads', (select count(*) from public.leads),
      'vehicle_images', (select count(*) from public.vehicle_images),
      'vehicle_model_images', (select count(*) from public.vehicle_model_images)),
  'sample_vehicle_image', (select to_jsonb(i) from public.vehicle_images i limit 1),
  'sample_model_image',   (select to_jsonb(i) from public.vehicle_model_images i limit 1),
  'check_constraints',   (select jsonb_agg(jsonb_build_object('table', conrelid::regclass::text, 'def', pg_get_constraintdef(oid)))
                            from pg_constraint where contype = 'c' and connamespace = 'public'::regnamespace),
  'rls',                 (select jsonb_agg(jsonb_build_object('table', relname, 'rls_enabled', relrowsecurity))
                            from pg_class where relnamespace = 'public'::regnamespace and relkind = 'r'),
  'policies',            (select jsonb_agg(jsonb_build_object('table', tablename, 'name', policyname, 'cmd', cmd, 'roles', roles, 'using', qual, 'check', with_check))
                            from pg_policies where schemaname in ('public','storage')),
  'buckets',             (select jsonb_agg(jsonb_build_object('id', id, 'public', public)) from storage.buckets),
  'atomic_function_defs',(select jsonb_agg(jsonb_build_object('name', proname, 'def', pg_get_functiondef(oid)))
                            from pg_proc where pronamespace = 'public'::regnamespace
                             and proname in ('create_test_drive_atomic','upsert_lead_atomic','create_test_drive'))
)) as nexdrive_schema_report;
