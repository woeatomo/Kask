-- Tes login nomor WhatsApp: sinkronisasi nomor ke profil
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

insert into auth.users (id, phone, raw_user_meta_data)
values ('00000000-0000-0000-0000-000000000041', '6281234567890', '{"full_name":"Warga WA"}');
select pg_temp.assert((select phone from public.profiles where id = '00000000-0000-0000-0000-000000000041') = '+6281234567890', 'nomor WA login tersalin ke profil (format +62)');
select pg_temp.assert((select full_name from public.profiles where id = '00000000-0000-0000-0000-000000000041') = 'Warga WA', 'nama dari metadata pendaftaran');

update auth.users set phone = '6289876543210' where id = '00000000-0000-0000-0000-000000000041';
select pg_temp.assert((select phone from public.profiles where id = '00000000-0000-0000-0000-000000000041') = '+6289876543210', 'ganti nomor login ikut memperbarui profil');

set role authenticated;
select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-000000000041', false);
select pg_temp.expect_error('update public.profiles set phone = ''+620000'' where id = auth.uid()', 'nomor di profil tidak bisa diubah manual');
update public.profiles set full_name = 'Nama Baru' where id = auth.uid();
select pg_temp.assert((select full_name from public.profiles where id = auth.uid()) = 'Nama Baru', 'nama tetap bisa diubah');
select public.delete_my_account();
reset role;
select pg_temp.assert((select phone from public.profiles where id = '00000000-0000-0000-0000-000000000041') is null, 'hapus akun menghapus nomor WA dari profil');

insert into auth.users (id, phone, raw_user_meta_data)
values ('00000000-0000-0000-0000-000000000042', '6289876543210', '{"full_name":"Daftar Ulang"}');
select pg_temp.assert((select phone from public.profiles where id = '00000000-0000-0000-0000-000000000042') = '+6289876543210', 'nomor yang sama bisa daftar ulang setelah akun dihapus');
\o
\echo 'SEMUA TES LOGIN WHATSAPP LULUS'
