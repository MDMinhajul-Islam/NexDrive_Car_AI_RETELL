-- 05: Storage policies for admin image uploads. Requires 01.
-- The bucket `vehicle-images` already exists and is public, so this file does NOT create
-- or modify it. Public buckets serve files by URL without a select policy; the admin
-- select policy below is only needed so upsert/replace and listing work for admins.
-- Writes are limited to the path shape the vehicle_images check constraint requires:
--   vehicles/<VEH-000000>/<file>.(webp|jpg|jpeg|png|avif)
-- Idempotent: safe to re-run.

drop policy if exists "nexdrive_admin_select_vehicle_images_bucket" on storage.objects;
create policy "nexdrive_admin_select_vehicle_images_bucket" on storage.objects
  for select to authenticated
  using (bucket_id = 'vehicle-images' and public.is_admin());

drop policy if exists "nexdrive_admin_insert_vehicle_images_bucket" on storage.objects;
create policy "nexdrive_admin_insert_vehicle_images_bucket" on storage.objects
  for insert to authenticated
  with check (
    bucket_id = 'vehicle-images'
    and public.is_admin()
    and name ~ '^vehicles/VEH-[0-9]{6}/[A-Za-z0-9][A-Za-z0-9._/-]*\.(webp|jpg|jpeg|png|avif)$'
    and name !~ '(^|/)\.\.(/|$)'
  );

drop policy if exists "nexdrive_admin_update_vehicle_images_bucket" on storage.objects;
create policy "nexdrive_admin_update_vehicle_images_bucket" on storage.objects
  for update to authenticated
  using (bucket_id = 'vehicle-images' and public.is_admin())
  with check (
    bucket_id = 'vehicle-images'
    and public.is_admin()
    and name ~ '^vehicles/VEH-[0-9]{6}/[A-Za-z0-9][A-Za-z0-9._/-]*\.(webp|jpg|jpeg|png|avif)$'
    and name !~ '(^|/)\.\.(/|$)'
  );

drop policy if exists "nexdrive_admin_delete_vehicle_images_bucket" on storage.objects;
create policy "nexdrive_admin_delete_vehicle_images_bucket" on storage.objects
  for delete to authenticated
  using (bucket_id = 'vehicle-images' and public.is_admin());
