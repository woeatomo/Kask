-- Tes batas anggota paket Gratis & hapus akun
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
create or replace function pg_temp.as_user(u text) returns void language sql as $$
  select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-0000000000' || u, false);
$$;
grant execute on all functions in schema pg_temp to authenticated;

insert into auth.users (id, raw_user_meta_data) values
  ('00000000-0000-0000-0000-000000000031', '{"full_name":"Ketua Kecil", "phone":"0811"}'),
  ('00000000-0000-0000-0000-000000000032', '{"full_name":"Warga A", "phone":"0812"}'),
  ('00000000-0000-0000-0000-000000000033', '{"full_name":"Warga B"}'),
  ('00000000-0000-0000-0000-000000000034', '{"full_name":"Ketua Sendiri"}'),
  ('00000000-0000-0000-0000-0000000000ae', '{"full_name":"Dev 2"}');
update public.profiles set is_super_admin = true where id = '00000000-0000-0000-0000-0000000000ae';

set role authenticated;

-- ===== Batas anggota
select pg_temp.as_user('ae');
select pg_temp.expect_error('select public.admin_set_setting(''free_member_limit'', ''0'')', 'batas anggota harus >= 1');
select public.admin_set_setting('free_member_limit', '2');
select pg_temp.as_user('31');
select pg_temp.expect_error('select public.admin_set_setting(''free_member_limit'', ''999'')', 'non-admin tidak bisa ubah pengaturan');
select pg_temp.assert(public.free_member_limit() = 2, 'batas anggota gratis terbaca (2)');

select public.create_community('RT Kecil', 'RT', '02', '05') as cid \gset
select invite_code as code from public.communities where id = :'cid' \gset
select pg_temp.as_user('32'); select public.join_community(:'code', null, 'Jl. A 1') as m_a \gset
select pg_temp.as_user('33'); select public.join_community(:'code', null, 'Jl. B 2') as m_b \gset
select pg_temp.as_user('31');
select public.approve_member(:'m_a', true);
select pg_temp.assert((public.community_usage(:'cid') ->> 'active_members')::int = 2, 'pemakaian kuota: 2 anggota aktif');
select pg_temp.assert((public.community_usage(:'cid') ->> 'member_limit')::int = 2, 'pemakaian kuota: batas 2');
select pg_temp.expect_error(format('select public.approve_member(%L, true)', :'m_b'), 'paket gratis: tidak bisa approve melebihi batas');
select public.approve_member(:'m_b', false);
select pg_temp.assert((select status from public.memberships where id = :'m_b') = 'rejected', 'menolak tetap bisa meski kuota penuh');

select pg_temp.as_user('33'); select public.join_community(:'code', null, 'Jl. B 2') as m_b \gset
select pg_temp.as_user('ae'); select public.admin_set_plan(:'cid', 'premium', null, 'tes');
select pg_temp.as_user('31');
select public.approve_member(:'m_b', true);
select pg_temp.assert((public.community_usage(:'cid') ->> 'member_limit') is null, 'premium: tanpa batas anggota');

-- ===== Data keuangan sebelum hapus akun
insert into public.dues (community_id, name, kind, amount) values (:'cid', 'Iuran', 'wajib', 10000) returning id as due \gset
select public.generate_bills(:'due', '2026-11-01');
select id as bill_a from public.bills where membership_id = :'m_a' \gset
insert into public.payments (community_id, due_id, membership_id, bill_id, amount, method, status)
values (:'cid', :'due', :'m_a', :'bill_a', 10000, 'tunai', 'diterima');

-- ===== Hapus akun warga
select pg_temp.as_user('32');
select public.register_push_token('ExponentPushToken[a]');
select public.delete_my_account();
reset role;
select pg_temp.assert(not exists (select 1 from auth.users where id = '00000000-0000-0000-0000-000000000032'), 'login warga terhapus');
select pg_temp.assert((select full_name from public.profiles where id = '00000000-0000-0000-0000-000000000032') = 'Akun dihapus', 'profil dianonimkan');
select pg_temp.assert((select phone from public.profiles where id = '00000000-0000-0000-0000-000000000032') is null, 'nomor HP dihapus');
select pg_temp.assert((select status from public.memberships where id = :'m_a') = 'inactive' and (select address from public.memberships where id = :'m_a') is null, 'keanggotaan nonaktif & alamat dihapus');
select pg_temp.assert(not exists (select 1 from public.push_tokens where user_id = '00000000-0000-0000-0000-000000000032'), 'token push dihapus');
select pg_temp.assert((select count(*) from public.cash_transactions where community_id = :'cid') = 1, 'catatan kas komunitas tetap utuh');
select pg_temp.assert((select status from public.bills where id = :'bill_a') = 'lunas', 'riwayat tagihan tetap utuh');
set role authenticated;

-- ===== Ketua dengan anggota lain tidak bisa hapus akun
select pg_temp.as_user('31');
select pg_temp.expect_error('select public.delete_my_account()', 'ketua harus serah terima sebelum hapus akun');

-- ===== Ketua sendirian: komunitasnya ikut dihapus
select pg_temp.as_user('34');
select public.create_community('RT Sendiri', 'RT', '03', '01') as cid_solo \gset
select public.delete_my_account();
reset role;
select pg_temp.assert(not exists (select 1 from public.communities where id = :'cid_solo'), 'komunitas tanpa anggota lain ikut dihapus');

-- daftar ulang dengan akun baru tetap bisa
insert into auth.users (id, raw_user_meta_data) values ('00000000-0000-0000-0000-000000000035', '{"full_name":"Warga A Baru"}');
select pg_temp.assert((select full_name from public.profiles where id = '00000000-0000-0000-0000-000000000035') = 'Warga A Baru', 'daftar ulang membuat profil baru');
\o
\echo 'SEMUA TES BATAS ANGGOTA & HAPUS AKUN LULUS'
