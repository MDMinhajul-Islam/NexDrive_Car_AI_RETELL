-- READ-ONLY follow-up report. Changes nothing. Output is small (function bodies are
-- whitespace-collapsed and limited to the three I still need).
select jsonb_pretty(jsonb_build_object(
  -- Item 5: are the two appointment ID generators in sync?
  'appointment_id_sync', (
    select jsonb_build_object(
      'sequence_last_value', s.last_value,
      'sequence_is_called',  s.is_called,
      'sequence_next_value', case when s.is_called then s.last_value + 1 else s.last_value end,
      'table_max_number',    m.max_num,
      'max_plus_one',        m.max_num + 1,
      'in_sync',             (case when s.is_called then s.last_value + 1 else s.last_value end) = m.max_num + 1,
      'sequence_would_collide', (case when s.is_called then s.last_value + 1 else s.last_value end) <= m.max_num
    )
    from public.appointment_id_seq s,
         (select coalesce(max(substring(appointment_id from 5)::int), 0) as max_num from public.appointments) m),
  -- Which existing functions can the website call without the Retell key?
  'function_access', (
    select jsonb_agg(jsonb_build_object(
      'name', p.proname,
      'args', pg_get_function_identity_arguments(p.oid),
      'security_definer', p.prosecdef,
      'requires_retell_key', p.prosrc ilike '%require_retell_tool_key%',
      'anon_can_execute', has_function_privilege('anon', p.oid, 'execute'),
      'authenticated_can_execute', has_function_privilege('authenticated', p.oid, 'execute')))
    from pg_proc p where p.pronamespace = 'public'::regnamespace and p.prokind = 'f'),
  'function_bodies', (
    select jsonb_agg(jsonb_build_object('name', p.proname,
      'body', regexp_replace(regexp_replace(p.prosrc, '--[^\n\r]*', '', 'g'), '\s+', ' ', 'g')))
    from pg_proc p where p.pronamespace = 'public'::regnamespace
      and p.proname in ('resolve_or_create_customer', 'upsert_lead_atomic', 'get_test_drive_slots')),
  -- How the existing key check works (header name and storage location only; this
  -- prints the function source, which should not contain the secret value itself).
  'retell_key_check', (
    select jsonb_agg(jsonb_build_object('schema', n.nspname, 'name', p.proname,
      'body', regexp_replace(p.prosrc, '\s+', ' ', 'g')))
    from pg_proc p join pg_namespace n on n.oid = p.pronamespace
    where p.proname = 'require_retell_tool_key'),
  'vault_available', exists (select 1 from pg_extension where extname = 'supabase_vault'),
  -- Item 8: image hosts to allow in next.config
  'model_image_hosts', (
    select jsonb_agg(distinct substring(image_url from '^https://([^/]+)')) from public.vehicle_model_images),
  'appointment_indexes', (
    select jsonb_agg(indexdef) from pg_indexes where schemaname = 'public' and tablename = 'appointments')
)) as nexdrive_followup_report;
