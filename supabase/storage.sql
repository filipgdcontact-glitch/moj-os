-- Moj OS — skladište priloga (slike i PDF), privatno po korisniku.
-- Putanja fajla: <user_id>/<vrsta>/<id zapisa>/<id priloga>.<ekstenzija>
-- Bezbedno je pokrenuti više puta.

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('prilozi', 'prilozi', false, 15728640, array['image/jpeg','image/png','image/webp','image/gif','image/heic','image/heif','application/pdf'])
on conflict (id) do update set public = false, file_size_limit = excluded.file_size_limit, allowed_mime_types = excluded.allowed_mime_types;

drop policy if exists "prilozi_select_own" on storage.objects;
drop policy if exists "prilozi_insert_own" on storage.objects;
drop policy if exists "prilozi_update_own" on storage.objects;
drop policy if exists "prilozi_delete_own" on storage.objects;

create policy "prilozi_select_own" on storage.objects for select to authenticated
  using (bucket_id = 'prilozi' and (storage.foldername(name))[1] = (select auth.uid())::text);
create policy "prilozi_insert_own" on storage.objects for insert to authenticated
  with check (bucket_id = 'prilozi' and (storage.foldername(name))[1] = (select auth.uid())::text);
create policy "prilozi_update_own" on storage.objects for update to authenticated
  using (bucket_id = 'prilozi' and (storage.foldername(name))[1] = (select auth.uid())::text);
create policy "prilozi_delete_own" on storage.objects for delete to authenticated
  using (bucket_id = 'prilozi' and (storage.foldername(name))[1] = (select auth.uid())::text);
