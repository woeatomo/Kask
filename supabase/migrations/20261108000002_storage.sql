-- =============================================================================
-- Storage: bukti pembayaran & gambar berita (keduanya privat, akses via signed URL)
--
-- Konvensi path:
--   payment-proofs/{community_id}/{user_id}/{nama-file}
--   news-images/{community_id}/{nama-file}
-- =============================================================================

insert into storage.buckets (id, name, public)
values ('payment-proofs', 'payment-proofs', false),
       ('news-images', 'news-images', false)
on conflict (id) do nothing;

-- Bukti pembayaran: pengunggah & pengurus komunitas bisa melihat
create policy "proofs_select" on storage.objects
  for select to authenticated using (
    bucket_id = 'payment-proofs'
    and (
      (storage.foldername(name))[2] = auth.uid()::text
      or public.is_pengurus(public.try_uuid((storage.foldername(name))[1]))
    )
  );

create policy "proofs_insert" on storage.objects
  for insert to authenticated with check (
    bucket_id = 'payment-proofs'
    and (storage.foldername(name))[2] = auth.uid()::text
    and public.is_member(public.try_uuid((storage.foldername(name))[1]))
  );

create policy "proofs_delete" on storage.objects
  for delete to authenticated using (
    bucket_id = 'payment-proofs'
    and (storage.foldername(name))[2] = auth.uid()::text
  );

-- Gambar berita: semua anggota bisa melihat, pengurus bisa unggah/hapus
create policy "news_images_select" on storage.objects
  for select to authenticated using (
    bucket_id = 'news-images'
    and public.is_member(public.try_uuid((storage.foldername(name))[1]))
  );

create policy "news_images_insert" on storage.objects
  for insert to authenticated with check (
    bucket_id = 'news-images'
    and public.is_pengurus(public.try_uuid((storage.foldername(name))[1]))
  );

create policy "news_images_delete" on storage.objects
  for delete to authenticated using (
    bucket_id = 'news-images'
    and public.is_pengurus(public.try_uuid((storage.foldername(name))[1]))
  );
