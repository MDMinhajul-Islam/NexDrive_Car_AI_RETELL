-- 02: RLS policies. Additive only: no existing policy is dropped or altered.
-- Requires 01. The inspect report shows RLS already enabled on all 11 tables with zero
-- policies, so every policy below is new. Safe to re-run (drop-if-exists on our own names).

-- ---- Public (anon + signed-in) read access to catalogue data only ----------
grant select on public.vehicles, public.features, public.vehicle_features,
                public.vehicle_images, public.vehicle_model_images
  to anon, authenticated;


drop policy if exists "nexdrive_public_read_vehicles" on public.vehicles;
create policy "nexdrive_public_read_vehicles" on public.vehicles
  for select to anon, authenticated using (true);
drop policy if exists "nexdrive_public_read_features" on public.features;
create policy "nexdrive_public_read_features" on public.features
  for select to anon, authenticated using (true);
drop policy if exists "nexdrive_public_read_vehicle_features" on public.vehicle_features;
create policy "nexdrive_public_read_vehicle_features" on public.vehicle_features
  for select to anon, authenticated using (true);
drop policy if exists "nexdrive_public_read_vehicle_images" on public.vehicle_images;
create policy "nexdrive_public_read_vehicle_images" on public.vehicle_images
  for select to anon, authenticated using (true);
drop policy if exists "nexdrive_public_read_vehicle_model_images" on public.vehicle_model_images;
create policy "nexdrive_public_read_vehicle_model_images" on public.vehicle_model_images
  for select to anon, authenticated using (true);

-- Customers, leads, appointments, salespeople, trade_ins and financing_options stay
-- invisible to the public. The public booking form goes through the existing
-- SECURITY DEFINER function create_test_drive_website (file 06), called only from a
-- Server Action. No public insert policy exists on appointments.

-- ---- Admin access ------------------------------------------------------------
-- Hard delete stays disabled for appointments and vehicles: admins get
-- select/insert/update there, and no DELETE grant or policy (Cancel / mark Sold instead).
grant select, insert, update, delete on
  public.vehicle_images, public.vehicle_features, public.features,
  public.vehicle_model_images, public.customers, public.leads,
  public.salespeople, public.trade_ins, public.financing_options
  to authenticated;
grant select, insert, update on public.appointments, public.vehicles to authenticated;
grant usage, select on all sequences in schema public to authenticated;

do $$
declare t text;
begin
  -- Full access tables
  foreach t in array array[
    'vehicle_images','vehicle_features','features','vehicle_model_images',
    'customers','leads','salespeople','trade_ins','financing_options'
  ] loop
    execute format('drop policy if exists %I on public.%I', 'nexdrive_admin_all_' || t, t);
    execute format(
      'create policy %I on public.%I for all to authenticated using (public.is_admin()) with check (public.is_admin())',
      'nexdrive_admin_all_' || t, t);
  end loop;

  -- No-delete tables
  foreach t in array array['appointments','vehicles'] loop
    execute format('drop policy if exists %I on public.%I', 'nexdrive_admin_select_' || t, t);
    execute format('drop policy if exists %I on public.%I', 'nexdrive_admin_insert_' || t, t);
    execute format('drop policy if exists %I on public.%I', 'nexdrive_admin_update_' || t, t);
    execute format('create policy %I on public.%I for select to authenticated using (public.is_admin())',
      'nexdrive_admin_select_' || t, t);
    execute format('create policy %I on public.%I for insert to authenticated with check (public.is_admin())',
      'nexdrive_admin_insert_' || t, t);
    execute format('create policy %I on public.%I for update to authenticated using (public.is_admin()) with check (public.is_admin())',
      'nexdrive_admin_update_' || t, t);
  end loop;
end $$;
