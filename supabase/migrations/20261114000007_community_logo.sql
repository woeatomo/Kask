-- =============================================================================
-- Logo komunitas (diunggah ketua, tampil di header aplikasi)
--
-- Bucket publik "community-logos": logo bukan data sensitif dan perlu tampil
-- cepat di header. Path: community-logos/{community_id}/{nama-file}
-- Setiap unggahan memakai nama file baru, jadi cache gambar otomatis berganti.
-- =============================================================================

alter table public.communities
  add column logo_path text,
  add constraint logo_path_in_own_folder
    check (logo_path is null or logo_path like id::text || '/%');

-- ketua boleh mengubah logo (kebijakan communities_update sudah membatasi ke ketua)
grant update (logo_path) on public.communities to authenticated;

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('community-logos', 'community-logos', true, 1048576,
        array['image/png', 'image/jpeg', 'image/webp'])
on conflict (id) do nothing;

create policy "community_logos_select" on storage.objects
  for select to authenticated using (bucket_id = 'community-logos');

create policy "community_logos_insert" on storage.objects
  for insert to authenticated with check (
    bucket_id = 'community-logos'
    and public.is_ketua(public.try_uuid((storage.foldername(name))[1]))
  );

create policy "community_logos_update" on storage.objects
  for update to authenticated using (
    bucket_id = 'community-logos'
    and public.is_ketua(public.try_uuid((storage.foldername(name))[1]))
  );

create policy "community_logos_delete" on storage.objects
  for delete to authenticated using (
    bucket_id = 'community-logos'
    and public.is_ketua(public.try_uuid((storage.foldername(name))[1]))
  );

-- Pratinjau saat bergabung ikut menampilkan logo
create or replace function public.find_community_by_code(p_code text)
returns jsonb
language sql
stable
security definer
set search_path = ''
as $$
  select jsonb_build_object(
    'id', c.id,
    'name', c.name,
    'type', c.type,
    'rw_number', c.rw_number,
    'rt_number', c.rt_number,
    'kelurahan', c.kelurahan,
    'kota', c.kota,
    'logo_path', c.logo_path,
    'rt_units', coalesce((
      select jsonb_agg(jsonb_build_object('id', r.id, 'rt_number', r.rt_number, 'name', r.name)
                       order by r.rt_number)
      from public.rt_units r where r.community_id = c.id
    ), '[]'::jsonb)
  )
  from public.communities c
  where c.invite_code = upper(trim(p_code))
    and c.is_active
    and auth.uid() is not null;
$$;

revoke all on function public.find_community_by_code(text) from public, anon;
grant execute on function public.find_community_by_code(text) to authenticated;
