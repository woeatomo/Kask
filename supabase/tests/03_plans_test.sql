-- Tes paket langganan komunitas
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

insert into auth.users (id, raw_user_meta_data) values
  ('00000000-0000-0000-0000-000000000021', '{"full_name":"Ketua Paket"}'),
  ('00000000-0000-0000-0000-000000000022', '{"full_name":"Warga Paket"}'),
  ('00000000-0000-0000-0000-0000000000ad', '{"full_name":"Dev"}');
update public.profiles set is_super_admin = true where id = '00000000-0000-0000-0000-0000000000ad';

set role authenticated;
select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-000000000021', false);
select public.create_community('RT 01 Paket', 'RT', '01', '01') as cid \gset
select invite_code as code from public.communities where id = :'cid' \gset
select pg_temp.assert(not public.is_premium(:'cid'), 'komunitas baru berpaket gratis');
select pg_temp.expect_error(format('update public.communities set plan = %L where id = %L', 'premium', :'cid'), 'ketua tidak bisa mengubah paket sendiri');
select pg_temp.expect_error(format('select public.admin_set_plan(%L, %L)', :'cid', 'premium'), 'non-admin tidak bisa mengubah paket');
select pg_temp.expect_error(format('insert into public.plan_changes (community_id, plan) values (%L, %L)', :'cid', 'premium'), 'user tidak bisa menulis riwayat paket');

select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-000000000022', false);
select public.join_community(:'code') as m_w \gset
select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-000000000021', false);
select public.approve_member(:'m_w', true);

select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-0000000000ad', false);
select pg_temp.expect_error(format('select public.admin_set_plan(%L, %L, now() - interval %L)', :'cid', 'premium', '1 day'), 'tanggal berakhir harus di masa depan');
select public.admin_set_plan(:'cid', 'premium', now() + interval '30 days', 'Transfer 50.000');
select pg_temp.assert(public.is_premium(:'cid'), 'premium aktif setelah diaktifkan admin');
select pg_temp.assert((select is_premium from public.admin_list_communities() where id = :'cid'), 'panel admin menampilkan status premium');

select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-000000000021', false);
select pg_temp.assert((select count(*) from public.notifications where title like 'Paket Premium aktif%') = 1, 'ketua dapat notifikasi premium aktif');
select pg_temp.assert((select count(*) from public.plan_changes) = 1, 'ketua bisa melihat riwayat paket');
select pg_temp.assert((select plan from public.communities where id = :'cid') = 'premium', 'anggota bisa membaca status paket');
select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-000000000022', false);
select pg_temp.assert((select count(*) from public.plan_changes) = 0, 'warga tidak melihat riwayat pembayaran paket');

reset role;
update public.communities set plan_expires_at = now() - interval '1 minute' where id = :'cid';
set role authenticated;
select pg_temp.assert(not public.is_premium(:'cid'), 'premium yang kedaluwarsa otomatis tidak aktif');

select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-0000000000ad', false);
select public.admin_set_plan(:'cid', 'premium', null, 'Seumur hidup');
select pg_temp.assert(public.is_premium(:'cid'), 'premium tanpa batas waktu');
select public.admin_set_plan(:'cid', 'free');
select pg_temp.assert(not public.is_premium(:'cid'), 'kembali ke gratis');
select pg_temp.assert((select count(*) from public.plan_changes where community_id = :'cid') = 3, 'riwayat paket tercatat 3x');
reset role;
\o
\echo 'SEMUA TES PAKET LULUS'
