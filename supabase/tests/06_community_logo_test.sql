-- Tes logo komunitas
\set ON_ERROR_STOP 1
\set QUIET 1
\o /dev/null

create or replace function pg_temp.assert(cond boolean, msg text) returns void language plpgsql as $$
begin
  if cond is distinct from true then raise exception 'ASSERT GAGAL: %', msg; end if;
  raise notice 'ok - %', msg;
end $$;
create or replace function pg_temp.expect_error(sql text, msg text) returns void language plpgsql as $$
begin
  begin execute sql; exception when others then raise notice 'ok - % (error: %)', msg, sqlerrm; return; end;
  raise exception 'ASSERT GAGAL (seharusnya error): %', msg;
end $$;
grant execute on all functions in schema pg_temp to authenticated;

insert into auth.users (id, phone, raw_user_meta_data) values
  ('00000000-0000-0000-0000-000000000051', '6281100000051', '{"full_name":"Ketua Logo"}'),
  ('00000000-0000-0000-0000-000000000052', '6281100000052', '{"full_name":"Bendahara Logo"}'),
  ('00000000-0000-0000-0000-000000000053', '6281100000053', '{"full_name":"Ketua Lain"}');

set role authenticated;
select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-000000000053', false);
select public.create_community('RT Lain', 'RT', '01', '02') as cid_lain \gset

select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-000000000051', false);
select public.create_community('RT Berlogo', 'RT', '03', '04') as cid \gset
select invite_code as code from public.communities where id = :'cid' \gset

insert into storage.objects (bucket_id, name) values ('community-logos', :'cid' || '/logo-1.png');
update public.communities set logo_path = :'cid' || '/logo-1.png' where id = :'cid';
select pg_temp.assert((select logo_path from public.communities where id = :'cid') = :'cid' || '/logo-1.png', 'ketua bisa memasang logo');
select pg_temp.expect_error(format('update public.communities set logo_path = %L where id = %L', :'cid_lain' || '/x.png', :'cid'), 'logo harus di folder komunitasnya sendiri');
select pg_temp.expect_error(format('insert into storage.objects (bucket_id, name) values (%L, %L)', 'community-logos', :'cid_lain' || '/hack.png'), 'tidak bisa unggah logo ke komunitas lain');

select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-000000000052', false);
select (public.find_community_by_code(:'code') ->> 'logo_path') = :'cid' || '/logo-1.png' as ok_preview \gset
select pg_temp.assert(:'ok_preview'::boolean, 'pratinjau kode undangan menampilkan logo');
select public.join_community(:'code') as m_b \gset
select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-000000000051', false);
select public.approve_member(:'m_b', true);
select public.set_member_role(:'m_b', 'pengurus', 'Bendahara');

select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-000000000052', false);
select pg_temp.assert((select logo_path from public.communities where id = :'cid') is not null, 'anggota bisa membaca logo komunitas');
update public.communities set logo_path = null where id = :'cid';
select pg_temp.assert((select logo_path from public.communities where id = :'cid') is not null, 'pengurus (bukan ketua) tidak bisa mengganti logo');
select pg_temp.expect_error(format('insert into storage.objects (bucket_id, name) values (%L, %L)', 'community-logos', :'cid' || '/logo-2.png'), 'pengurus (bukan ketua) tidak bisa unggah logo');

select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-000000000051', false);
delete from storage.objects where bucket_id = 'community-logos' and name = :'cid' || '/logo-1.png';
update public.communities set logo_path = null where id = :'cid';
select pg_temp.assert((select logo_path from public.communities where id = :'cid') is null, 'ketua bisa menghapus logo');
reset role;
\o
\echo 'SEMUA TES LOGO KOMUNITAS LULUS'
