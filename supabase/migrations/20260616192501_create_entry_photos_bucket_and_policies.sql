-- Private bucket for entry photos
insert into storage.buckets (id, name, public)
values ('entry-photos', 'entry-photos', false)
on conflict (id) do nothing;

-- Per-user access: a user may only touch objects whose first path segment is their uid.
create policy "entry_photos_select_own"
  on storage.objects for select to authenticated
  using (bucket_id = 'entry-photos' and (storage.foldername(name))[1] = auth.uid()::text);

create policy "entry_photos_insert_own"
  on storage.objects for insert to authenticated
  with check (bucket_id = 'entry-photos' and (storage.foldername(name))[1] = auth.uid()::text);

create policy "entry_photos_update_own"
  on storage.objects for update to authenticated
  using (bucket_id = 'entry-photos' and (storage.foldername(name))[1] = auth.uid()::text)
  with check (bucket_id = 'entry-photos' and (storage.foldername(name))[1] = auth.uid()::text);

create policy "entry_photos_delete_own"
  on storage.objects for delete to authenticated
  using (bucket_id = 'entry-photos' and (storage.foldername(name))[1] = auth.uid()::text);
