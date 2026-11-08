-- Tes alur utama + isolasi data antar komunitas.
-- Jalankan lewat supabase/tests/run_local.sh
\set ON_ERROR_STOP 1
\set QUIET 1
\o /dev/null

-- helper assert
create or replace function pg_temp.assert(cond boolean, msg text) returns void language plpgsql as $$
begin
  if cond is distinct from true then raise exception 'ASSERT GAGAL: %', msg; end if;
  raise notice 'ok - %', msg;
end $$;
grant execute on function pg_temp.assert(boolean, text) to authenticated;

-- helper: harus error
create or replace function pg_temp.expect_error(sql text, msg text) returns void language plpgsql as $$
begin
  begin
    execute sql;
  exception when others then
    raise notice 'ok - % (error: %)', msg, sqlerrm;
    return;
  end;
  raise exception 'ASSERT GAGAL (seharusnya error): %', msg;
end $$;
grant execute on function pg_temp.expect_error(text, text) to authenticated;

insert into auth.users (id, email, raw_user_meta_data) values
  ('00000000-0000-0000-0000-00000000000a', 'admin@x', '{"full_name":"Developer"}'),
  ('00000000-0000-0000-0000-000000000001', 'ketua@x', '{"full_name":"Pak Ketua RW"}'),
  ('00000000-0000-0000-0000-000000000002', 'bend@x',  '{"full_name":"Bu Bendahara"}'),
  ('00000000-0000-0000-0000-000000000003', 'w1@x',    '{"full_name":"Warga Satu"}'),
  ('00000000-0000-0000-0000-000000000004', 'w2@x',    '{"full_name":"Warga Dua"}'),
  ('00000000-0000-0000-0000-000000000005', 'rt@x',    '{"full_name":"Ketua RT Lain"}');
update public.profiles set is_super_admin = true where id = '00000000-0000-0000-0000-00000000000a';

select pg_temp.assert((select count(*) from public.profiles) = 6, 'profil otomatis dibuat saat signup');

set role authenticated;

-- ===== Ketua RW membuat komunitas
select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-000000000001', false);
select public.create_community('RW 05 Mawar', 'RW', '05', null, 'Sukamaju', null, 'Bandung') as cid \gset
select invite_code as code from public.communities where id = :'cid' \gset
insert into public.rt_units (community_id, rt_number) values (:'cid', '01'), (:'cid', '02');
select id as rt01 from public.rt_units where community_id = :'cid' and rt_number = '01' \gset
select pg_temp.assert(public.is_ketua(:'cid'), 'pembuat komunitas menjadi ketua');

-- ===== Komunitas lain (RT) oleh user 5
select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-000000000005', false);
select public.create_community('RT 07 Melati', 'RT', '09', '07') as cid2 \gset
insert into public.news (community_id, title, body) values (:'cid2', 'Rahasia RT 07', 'x');

-- ===== Warga bergabung
select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-000000000002', false);
select pg_temp.assert((public.find_community_by_code(:'code') ->> 'name') = 'RW 05 Mawar', 'cari komunitas via kode');
select public.join_community(:'code', :'rt01', 'Jl. Mawar 1') as m_bend \gset
select pg_temp.assert(not public.is_member(:'cid'), 'pending belum jadi anggota');
select pg_temp.assert((select count(*) from public.news) = 0, 'pending tidak bisa baca berita');

select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-000000000003', false);
select public.join_community(:'code', :'rt01', 'Jl. Mawar 2') as m_w1 \gset
select pg_temp.expect_error(format('select public.approve_member(%L, true)', :'m_w1'), 'warga tidak bisa approve dirinya');

select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-000000000004', false);
select public.join_community(:'code', null, 'Jl. Mawar 3') as m_w2 \gset

-- ===== Ketua approve & angkat bendahara
select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-000000000001', false);
select public.approve_member(:'m_bend', true);
select public.approve_member(:'m_w1', true);
select public.approve_member(:'m_w2', true);
select public.set_member_role(:'m_bend', 'pengurus', 'Bendahara');
select pg_temp.assert((select count(*) from public.news) = 0, 'ketua RW tidak melihat berita RT lain');
select pg_temp.assert((select count(*) from public.communities) = 1, 'ketua RW hanya melihat komunitasnya');
select pg_temp.expect_error(format('update public.communities set is_active = false where id = %L', :'cid'), 'ketua tidak bisa ubah is_active');

-- ===== Bendahara membuat iuran & tagihan
select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-000000000002', false);
insert into public.dues (community_id, name, kind, amount) values (:'cid', 'Iuran Kebersihan', 'wajib', 25000) returning id as due_w \gset
insert into public.dues (community_id, name, kind, target_amount) values (:'cid', 'Donasi 17an', 'sukarela', 1000000) returning id as due_s \gset
select pg_temp.assert(public.generate_bills(:'due_w', '2026-11-15') = 4, '4 tagihan dibuat (termasuk ketua & bendahara)');
select pg_temp.assert(public.generate_bills(:'due_w', '2026-11-01') = 0, 'generate tagihan idempoten');
select pg_temp.expect_error(format('insert into public.dues (community_id, name, kind, amount) values (%L, %L, %L, 1)', :'cid2', 'x', 'wajib'), 'bendahara RW tidak bisa buat iuran di RT lain');

-- ===== Warga 1 bayar dengan bukti transfer
select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-000000000003', false);
select pg_temp.assert((select count(*) from public.bills) = 1, 'warga hanya melihat tagihannya sendiri');
select id as bill_w1 from public.bills \gset
select pg_temp.expect_error(format('select public.verify_payment(gen_random_uuid(), true)'), 'warga tidak bisa verifikasi');
insert into public.payments (community_id, due_id, membership_id, bill_id, amount, status, proof_path)
values (:'cid', :'due_w', :'m_w1', :'bill_w1', 25000, 'diterima', 'x/y/z.jpg') returning id as pay1 \gset
select pg_temp.assert((select status from public.payments where id = :'pay1') = 'menunggu', 'warga tidak bisa set status diterima sendiri');
select pg_temp.assert((select status from public.bills where id = :'bill_w1') = 'menunggu_verifikasi', 'tagihan menunggu verifikasi');
select pg_temp.expect_error(format('update public.payments set status = %L where id = %L', 'diterima', :'pay1'), 'warga tidak bisa update pembayaran');
select pg_temp.expect_error(format('insert into public.payments (community_id, due_id, membership_id, amount) values (%L, %L, %L, 1000)', :'cid', :'due_s', :'m_w2'), 'warga tidak bisa bayar atas nama warga lain');
insert into public.payments (community_id, due_id, membership_id, amount, method) values (:'cid', :'due_s', :'m_w1', 50000, 'transfer');

-- ===== Bendahara verifikasi
select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-000000000002', false);
select public.verify_payment(:'pay1', true);
select pg_temp.assert((select status from public.bills where id = :'bill_w1') = 'lunas', 'tagihan lunas setelah diverifikasi');
select pg_temp.assert((select count(*) from public.cash_transactions where payment_id = :'pay1') = 1, 'kas masuk otomatis tercatat');
delete from public.cash_transactions where payment_id = :'pay1';
select pg_temp.assert((select count(*) from public.cash_transactions where payment_id = :'pay1') = 1, 'kas dari iuran tidak bisa dihapus manual');

-- tolak donasi, catat tunai untuk warga 2, catat pengeluaran
select id as pay_s from public.payments where due_id = :'due_s' \gset
select public.verify_payment(:'pay_s', false, 'Bukti tidak jelas');
select id as bill_w2 from public.bills where membership_id = :'m_w2' \gset
insert into public.payments (community_id, due_id, membership_id, bill_id, amount, method, status)
values (:'cid', :'due_w', :'m_w2', :'bill_w2', 25000, 'tunai', 'diterima');
select pg_temp.assert((select status from public.bills where id = :'bill_w2') = 'lunas', 'pembayaran tunai oleh pengurus langsung lunas');
insert into public.cash_transactions (community_id, type, amount, category, description, trx_date)
values (:'cid', 'keluar', 30000, 'Kebersihan', 'Beli kantong sampah', '2026-11-20');
select pg_temp.expect_error(format('insert into public.cash_transactions (community_id, type, amount) values (%L, %L, 1)', :'cid2', 'masuk'), 'tidak bisa catat kas di komunitas lain');

select (public.cash_report(:'cid', '2026-11-01', '2026-11-30')) as rep \gset
select pg_temp.assert((:'rep'::jsonb ->> 'income')::numeric = 50000, 'laporan: pemasukan 50.000');
select pg_temp.assert((:'rep'::jsonb ->> 'expense')::numeric = 30000, 'laporan: pengeluaran 30.000');
select pg_temp.assert((:'rep'::jsonb ->> 'closing_balance')::numeric = 20000, 'laporan: saldo 20.000');

-- ===== Warga melihat kas (transparansi) tapi tidak bisa ubah
select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-000000000004', false);
select pg_temp.assert((select count(*) from public.cash_transactions) = 3, 'warga bisa melihat buku kas');
select pg_temp.expect_error(format('insert into public.cash_transactions (community_id, type, amount) values (%L, %L, 1)', :'cid', 'keluar'), 'warga tidak bisa catat kas');
select pg_temp.expect_error(format('insert into public.news (community_id, title) values (%L, %L)', :'cid', 'hoax'), 'warga tidak bisa posting berita');
select pg_temp.assert((select collected from public.due_totals(:'cid') where due_id = :'due_w') = 50000, 'warga bisa melihat total iuran terkumpul');
select pg_temp.expect_error(format('select public.cash_report(%L, %L, %L)', :'cid2', '2026-01-01', '2026-12-31'), 'warga tidak bisa lihat laporan komunitas lain');
select pg_temp.expect_error('update public.profiles set is_super_admin = true where id = auth.uid()', 'user tidak bisa menjadikan dirinya super admin');

-- ===== Storage
select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-000000000004', false);
insert into storage.objects (bucket_id, name) values ('payment-proofs', :'cid' || '/00000000-0000-0000-0000-000000000004/a.jpg');
select pg_temp.expect_error(format('insert into storage.objects (bucket_id, name) values (%L, %L)', 'payment-proofs', :'cid' || '/00000000-0000-0000-0000-000000000003/b.jpg'), 'tidak bisa upload ke folder user lain');
select pg_temp.expect_error(format('insert into storage.objects (bucket_id, name) values (%L, %L)', 'news-images', :'cid' || '/c.jpg'), 'warga tidak bisa upload gambar berita');
select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-000000000003', false);
select pg_temp.assert((select count(*) from storage.objects) = 0, 'warga lain tidak bisa melihat bukti transfer orang lain');
select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-000000000002', false);
select pg_temp.assert((select count(*) from storage.objects) = 1, 'pengurus bisa melihat bukti transfer');


-- ===== Peran
select pg_temp.expect_error(format('select public.set_member_role(%L, %L)', :'m_w2', 'pengurus'), 'warga tidak bisa ubah peran');
select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-000000000002', false);
select pg_temp.expect_error(format('select public.set_member_role(%L, %L)', :'m_w2', 'pengurus'), 'pengurus (bukan ketua) tidak bisa ubah peran');

select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-000000000001', false);
select id as m_ketua from public.memberships where user_id = auth.uid() \gset
select pg_temp.expect_error(format('select public.set_member_role(%L, %L)', :'m_ketua', 'warga'), 'ketua tidak bisa turun tanpa serah terima');
select public.set_member_role(:'m_w1', 'ketua', 'Ketua RW 05');
select pg_temp.assert((select role from public.memberships where id = :'m_ketua') = 'pengurus', 'serah terima: ketua lama jadi pengurus');
select pg_temp.assert((select role from public.memberships where id = :'m_w1') = 'ketua', 'serah terima: ketua baru');

-- ===== Super admin
select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-00000000000a', false);
select pg_temp.assert((select count(*) from public.admin_list_communities()) = 2, 'admin melihat semua komunitas');
select public.admin_set_community_active(:'cid2', false);
select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-000000000005', false);
select pg_temp.assert((select count(*) from public.news) = 0, 'komunitas nonaktif: data tidak bisa diakses anggota');
select pg_temp.expect_error('select * from public.admin_list_communities()', 'non-admin tidak bisa akses fungsi admin');

reset role;
\o
\echo 'SEMUA TES LULUS'
