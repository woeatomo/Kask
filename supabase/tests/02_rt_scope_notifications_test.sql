-- Tes wewenang pengurus per RT di komunitas RW + notifikasi + antrean push.
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
grant execute on all functions in schema pg_temp to authenticated, service_role;

insert into auth.users (id, raw_user_meta_data) values
  ('00000000-0000-0000-0000-000000000011', '{"full_name":"Ketua RW"}'),
  ('00000000-0000-0000-0000-000000000012', '{"full_name":"Ketua RT 01"}'),
  ('00000000-0000-0000-0000-000000000013', '{"full_name":"Bendahara RW"}'),
  ('00000000-0000-0000-0000-000000000014', '{"full_name":"Warga RT 01"}'),
  ('00000000-0000-0000-0000-000000000015', '{"full_name":"Warga RT 02"}'),
  ('00000000-0000-0000-0000-000000000016', '{"full_name":"Warga Tanpa RT"}');

set role authenticated;

-- ===== Setup RW dengan 2 RT
select pg_temp.as_user('11');
select public.create_community('RW 09', 'RW', '09') as cid \gset
select invite_code as code from public.communities where id = :'cid' \gset
insert into public.rt_units (community_id, rt_number) values (:'cid', '01'), (:'cid', '02');
select id as rt1 from public.rt_units where community_id = :'cid' and rt_number = '01' \gset
select id as rt2 from public.rt_units where community_id = :'cid' and rt_number = '02' \gset

select pg_temp.as_user('12'); select public.join_community(:'code', :'rt1', 'A1') as m_r1 \gset
select pg_temp.as_user('13'); select public.join_community(:'code', null, 'B1') as m_b \gset
select pg_temp.as_user('11');
select public.approve_member(:'m_r1', true);
select public.approve_member(:'m_b', true);
select pg_temp.expect_error(format('select public.set_member_role(%L, %L, null, %L)', :'m_b', 'warga', :'rt1'), 'batas RT hanya untuk pengurus');
select public.set_member_role(:'m_r1', 'pengurus', 'Ketua RT 01', :'rt1');
select public.set_member_role(:'m_b', 'pengurus', 'Bendahara');
select pg_temp.assert((select managed_rt_unit_id from public.memberships where id = :'m_r1') = :'rt1', 'ketua RT 01 dibatasi ke RT 01');

-- ===== Warga bergabung
select pg_temp.as_user('14'); select public.join_community(:'code', :'rt1', 'C1') as m_w1 \gset
select pg_temp.as_user('15'); select public.join_community(:'code', :'rt2', 'D1') as m_w2 \gset
select pg_temp.as_user('16'); select public.join_community(:'code', null, 'E1') as m_x \gset

select pg_temp.as_user('12');
select pg_temp.assert((select count(*) from public.memberships where status = 'pending') = 1, 'pengurus RT hanya melihat pendaftar RT-nya');
select pg_temp.assert((select count(*) from public.notifications where title = 'Permintaan bergabung') = 1, 'pengurus RT hanya dapat notifikasi pendaftar RT-nya');
select public.approve_member(:'m_w1', true);
select pg_temp.expect_error(format('select public.approve_member(%L, true)', :'m_w2'), 'pengurus RT 01 tidak bisa approve warga RT 02');
select pg_temp.expect_error(format('select public.approve_member(%L, true)', :'m_x'), 'pengurus RT tidak bisa approve warga tanpa RT');
select pg_temp.expect_error('insert into public.rt_units (community_id, rt_number) values (''' || :'cid' || ''', ''03'')', 'pengurus RT tidak bisa menambah RT');

select pg_temp.as_user('13');
select pg_temp.assert((select count(*) from public.notifications where title = 'Permintaan bergabung') = 3, 'pengurus RW dapat notifikasi semua pendaftar');
select public.approve_member(:'m_w2', true);
select public.approve_member(:'m_x', true);

select pg_temp.as_user('14');
select pg_temp.assert((select count(*) from public.notifications where title = 'Permintaan disetujui') = 1, 'warga dapat notifikasi disetujui');
select pg_temp.expect_error(format('select public.update_member_info(%L, %L, %L)', :'m_w1', :'rt2', 'C1'), 'warga tidak bisa pindah RT sendiri');
select public.update_member_info(:'m_w1', :'rt1', 'C1 No. 5');
select pg_temp.assert((select address from public.memberships where id = :'m_w1') = 'C1 No. 5', 'warga bisa ubah alamat sendiri');

-- ===== Iuran & tagihan
select pg_temp.as_user('13');
insert into public.dues (community_id, name, kind, amount) values (:'cid', 'Iuran RW', 'wajib', 20000) returning id as due_rw \gset
select pg_temp.as_user('12');
insert into public.dues (community_id, name, kind, amount, rt_unit_id) values (:'cid', 'Iuran RT 01', 'wajib', 10000, :'rt1') returning id as due_rt1 \gset
select pg_temp.expect_error(format('insert into public.dues (community_id, name, kind, amount, rt_unit_id) values (%L, %L, %L, 1, %L)', :'cid', 'x', 'wajib', :'rt2'), 'pengurus RT 01 tidak bisa buat iuran RT 02');
select pg_temp.expect_error(format('insert into public.dues (community_id, name, kind, amount) values (%L, %L, %L, 1)', :'cid', 'x', 'wajib'), 'pengurus RT tidak bisa buat iuran tingkat RW');
update public.dues set amount = 1 where id = :'due_rw';
select pg_temp.assert((select amount from public.dues where id = :'due_rw') = 20000, 'pengurus RT tidak bisa ubah iuran RW');
select pg_temp.assert(public.generate_bills(:'due_rw', '2026-11-01') = 2, 'pengurus RT: tagihan iuran RW hanya untuk warga RT-nya (2)');
select pg_temp.assert(public.generate_bills(:'due_rt1', '2026-11-01') = 2, 'pengurus RT: tagihan iuran RT-nya');
select pg_temp.assert((select count(*) from public.bills) = 4, 'pengurus RT hanya melihat tagihan RT-nya');

select pg_temp.as_user('13');
select pg_temp.assert(public.generate_bills(:'due_rw', '2026-11-01') = 4, 'pengurus RW: sisa tagihan iuran RW (4 warga lain)');
select pg_temp.assert((select count(*) from public.bills) = 8, 'pengurus RW melihat semua tagihan');

-- ===== Pembayaran & verifikasi
select pg_temp.as_user('14');
select pg_temp.assert((select count(*) from public.notifications where title like 'Tagihan baru:%') = 2, 'warga dapat notifikasi tagihan baru');
select id as bill_w1 from public.bills where due_id = :'due_rt1' \gset
insert into public.payments (community_id, due_id, membership_id, bill_id, amount) values (:'cid', :'due_rt1', :'m_w1', :'bill_w1', 10000) returning id as pay_w1 \gset
insert into storage.objects (bucket_id, name) values ('payment-proofs', :'cid' || '/00000000-0000-0000-0000-000000000014/a.jpg');

select pg_temp.as_user('15');
select id as bill_w2 from public.bills where due_id = :'due_rw' \gset
insert into public.payments (community_id, due_id, membership_id, bill_id, amount) values (:'cid', :'due_rw', :'m_w2', :'bill_w2', 20000) returning id as pay_w2 \gset
insert into storage.objects (bucket_id, name) values ('payment-proofs', :'cid' || '/00000000-0000-0000-0000-000000000015/b.jpg');

select pg_temp.as_user('12');
select pg_temp.assert((select count(*) from public.notifications where title = 'Pembayaran menunggu verifikasi') = 1, 'pengurus RT hanya dapat notifikasi pembayaran RT-nya');
select pg_temp.assert((select count(*) from public.payments) = 1, 'pengurus RT hanya melihat pembayaran RT-nya');
select pg_temp.assert((select count(*) from storage.objects where bucket_id = 'payment-proofs') = 1, 'pengurus RT hanya melihat bukti transfer RT-nya');
select pg_temp.expect_error(format('select public.verify_payment(%L, true)', :'pay_w2'), 'pengurus RT 01 tidak bisa verifikasi pembayaran RT 02');
select public.verify_payment(:'pay_w1', true);
select pg_temp.assert((select rt_unit_id from public.cash_transactions where payment_id = :'pay_w1') = :'rt1', 'pemasukan iuran RT masuk kas RT');

-- ===== Kas per RT
insert into public.cash_transactions (community_id, rt_unit_id, type, amount, category, trx_date) values (:'cid', :'rt1', 'keluar', 4000, 'Kebersihan', current_date);
select pg_temp.expect_error(format('insert into public.cash_transactions (community_id, type, amount) values (%L, %L, 1)', :'cid', 'keluar'), 'pengurus RT tidak bisa catat kas RW');
select pg_temp.expect_error(format('insert into public.cash_transactions (community_id, rt_unit_id, type, amount) values (%L, %L, %L, 1)', :'cid', :'rt2', 'keluar'), 'pengurus RT 01 tidak bisa catat kas RT 02');

select pg_temp.as_user('13');
select public.verify_payment(:'pay_w2', true);
select pg_temp.assert((select rt_unit_id from public.cash_transactions where payment_id = :'pay_w2') is null, 'pemasukan iuran RW masuk kas RW');
select (public.cash_report(:'cid', '2000-01-01', current_date + 1, false, :'rt1') ->> 'closing_balance')::numeric as kas_rt1 \gset
select (public.cash_report(:'cid', '2000-01-01', current_date + 1, true) ->> 'closing_balance')::numeric as kas_rw \gset
select (public.cash_report(:'cid', '2000-01-01', current_date + 1) ->> 'closing_balance')::numeric as kas_all \gset
select pg_temp.assert(:'kas_rt1'::numeric = 6000, 'laporan kas RT 01 = 6.000');
select pg_temp.assert(:'kas_rw'::numeric = 20000, 'laporan kas RW = 20.000');
select pg_temp.assert(:'kas_all'::numeric = 26000, 'laporan semua kas = 26.000');

select pg_temp.as_user('15');
select pg_temp.assert((select count(*) from public.notifications where title = 'Pembayaran diterima ✓') = 1, 'warga dapat notifikasi pembayaran diterima');

-- ===== Berita RT
select pg_temp.as_user('12');
insert into public.news (community_id, rt_unit_id, title, body) values (:'cid', :'rt1', 'Ronda RT 01', 'Jadwal ronda baru');
select pg_temp.expect_error(format('insert into public.news (community_id, title) values (%L, %L)', :'cid', 'x'), 'pengurus RT tidak bisa posting berita tingkat RW');
update public.communities set name = 'x' where id = :'cid';
select pg_temp.assert((select name from public.communities where id = :'cid') = 'RW 09', 'pengurus RT tidak bisa ubah data komunitas');
select pg_temp.as_user('14');
select pg_temp.assert((select count(*) from public.news) = 1, 'warga RT 01 melihat berita RT 01');
select pg_temp.assert((select count(*) from public.notifications where title = '📢 Ronda RT 01') = 1, 'warga RT 01 dapat notifikasi berita RT');
select pg_temp.as_user('15');
select pg_temp.assert((select count(*) from public.news) = 0, 'warga RT 02 tidak melihat berita RT 01');
select pg_temp.assert((select count(*) from public.notifications where title like '📢%') = 0, 'warga RT 02 tidak dapat notifikasi berita RT 01');
select pg_temp.as_user('13');
select pg_temp.assert((select count(*) from public.news) = 1, 'pengurus RW melihat berita RT');

-- ===== Notifikasi & push
select pg_temp.as_user('14');
select public.register_push_token('ExponentPushToken[w1-device]', 'android');
select pg_temp.expect_error('select public.register_push_token(''bukan-token'')', 'token push tidak valid ditolak');
select pg_temp.expect_error(format('insert into public.notifications (user_id, title) values (%L, %L)', '00000000-0000-0000-0000-000000000015', 'spam'), 'user tidak bisa membuat notifikasi');
update public.notifications set read_at = now();
select pg_temp.assert((select count(*) from public.notifications where read_at is null) = 0, 'tandai notifikasi sudah dibaca');
select pg_temp.expect_error('select * from public.claim_push_batch()', 'user biasa tidak bisa memanggil antrean push');

reset role;
set role service_role;
-- warga RT 01: disetujui, 2 tagihan baru, pembayaran diterima, berita RT = 5
select pg_temp.assert((select count(*) from public.claim_push_batch(1000) where token = 'ExponentPushToken[w1-device]') = 5, 'antrean push berisi 5 notifikasi warga RT 01');
select pg_temp.assert((select count(*) from public.claim_push_batch(1000)) = 0, 'notifikasi tidak dikirim dua kali');
select pg_temp.assert(public.fmt_rupiah(1234567) = 'Rp1.234.567', 'format rupiah');
reset role;
\o
\echo 'SEMUA TES WEWENANG RT & NOTIFIKASI LULUS'
