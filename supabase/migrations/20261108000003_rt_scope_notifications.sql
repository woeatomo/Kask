-- =============================================================================
-- 1) Wewenang per RT di komunitas RW
--    memberships.managed_rt_unit_id terisi  => pengurus hanya berwenang atas
--    warga, tagihan, pembayaran, iuran, kas, dan berita milik RT tersebut.
--    memberships.managed_rt_unit_id kosong  => pengurus tingkat RW (penuh).
--    Ketua selalu berwenang penuh.
--
-- 2) Notifikasi: kotak masuk di aplikasi + push (Expo) lewat Edge Function.
-- =============================================================================

-- -----------------------------------------------------------------------------
-- KOLOM BARU
-- -----------------------------------------------------------------------------
alter table public.memberships
  add column managed_rt_unit_id uuid,
  add constraint memberships_managed_rt_fk
    foreign key (managed_rt_unit_id, community_id)
    references public.rt_units (id, community_id) on delete set null (managed_rt_unit_id),
  add constraint scope_only_for_pengurus
    check (managed_rt_unit_id is null or role = 'pengurus');

-- Kas per RT (null = kas RW / kas utama komunitas)
alter table public.cash_transactions
  add column rt_unit_id uuid,
  add constraint cash_rt_fk
    foreign key (rt_unit_id, community_id)
    references public.rt_units (id, community_id) on delete restrict;

create index cash_rt_idx on public.cash_transactions (community_id, rt_unit_id, trx_date);

-- Berita khusus RT (null = untuk seluruh komunitas)
alter table public.news
  add column rt_unit_id uuid,
  add constraint news_rt_fk
    foreign key (rt_unit_id, community_id)
    references public.rt_units (id, community_id) on delete set null (rt_unit_id);

-- -----------------------------------------------------------------------------
-- FUNGSI OTORISASI
-- -----------------------------------------------------------------------------

-- Boleh mengelola objek milik RT p_rt (p_rt null = objek tingkat komunitas)?
create or replace function public.can_manage_rt(p_community_id uuid, p_rt uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select public.is_super_admin() or exists (
    select 1
    from public.memberships m
    join public.communities c on c.id = m.community_id
    where m.community_id = p_community_id
      and m.user_id = auth.uid()
      and m.status = 'active'
      and c.is_active
      and (m.role = 'ketua'
           or (m.role = 'pengurus'
               and (m.managed_rt_unit_id is null or m.managed_rt_unit_id = p_rt)))
  );
$$;

-- Pengurus penuh (ketua / pengurus tanpa batas RT). Semantik lama dipertahankan.
create or replace function public.is_pengurus(p_community_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select public.can_manage_rt(p_community_id, null);
$$;

-- Pengurus apa pun, termasuk yang dibatasi per RT
create or replace function public.is_any_pengurus(p_community_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select public.is_super_admin()
      or coalesce(public.my_role(p_community_id) in ('ketua', 'pengurus'), false);
$$;

create or replace function public.my_rt_unit(p_community_id uuid)
returns uuid
language sql
stable
security definer
set search_path = ''
as $$
  select m.rt_unit_id from public.memberships m
  where m.community_id = p_community_id and m.user_id = auth.uid() and m.status = 'active';
$$;

create or replace function public.can_manage_member(p_membership_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select coalesce(
    (select public.can_manage_rt(m.community_id, m.rt_unit_id)
     from public.memberships m where m.id = p_membership_id),
    false);
$$;

create or replace function public.can_manage_user(p_community_id uuid, p_user_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select coalesce(
    (select public.can_manage_rt(m.community_id, m.rt_unit_id)
     from public.memberships m
     where m.community_id = p_community_id and m.user_id = p_user_id),
    false);
$$;

-- -----------------------------------------------------------------------------
-- RLS: ganti kebijakan agar memperhatikan wewenang RT
-- -----------------------------------------------------------------------------
drop policy memberships_select on public.memberships;
create policy memberships_select on public.memberships
  for select to authenticated using (
    user_id = auth.uid()
    or (status = 'active' and public.is_member(community_id))
    or public.can_manage_rt(community_id, rt_unit_id)
  );

drop policy dues_write on public.dues;
create policy dues_insert on public.dues
  for insert to authenticated with check (public.can_manage_rt(community_id, rt_unit_id));
create policy dues_update on public.dues
  for update to authenticated
  using (public.can_manage_rt(community_id, rt_unit_id))
  with check (public.can_manage_rt(community_id, rt_unit_id));
create policy dues_delete on public.dues
  for delete to authenticated using (public.can_manage_rt(community_id, rt_unit_id));

drop policy bills_select on public.bills;
drop policy bills_insert on public.bills;
drop policy bills_update on public.bills;
drop policy bills_delete on public.bills;
create policy bills_select on public.bills
  for select to authenticated using (
    membership_id = public.my_membership_id(community_id)
    or public.can_manage_member(membership_id)
  );
create policy bills_insert on public.bills
  for insert to authenticated with check (public.can_manage_member(membership_id));
create policy bills_update on public.bills
  for update to authenticated
  using (public.can_manage_member(membership_id))
  with check (public.can_manage_member(membership_id));
create policy bills_delete on public.bills
  for delete to authenticated using (public.can_manage_member(membership_id) and status <> 'lunas');

drop policy payments_select on public.payments;
drop policy payments_insert on public.payments;
drop policy payments_delete on public.payments;
create policy payments_select on public.payments
  for select to authenticated using (
    membership_id = public.my_membership_id(community_id)
    or public.can_manage_member(membership_id)
  );
create policy payments_insert on public.payments
  for insert to authenticated with check (
    membership_id = public.my_membership_id(community_id)
    or public.can_manage_member(membership_id)
  );
create policy payments_delete on public.payments
  for delete to authenticated using (
    (status = 'menunggu' and membership_id = public.my_membership_id(community_id))
    or (status <> 'diterima' and public.can_manage_member(membership_id))
  );

drop policy cash_insert on public.cash_transactions;
drop policy cash_update on public.cash_transactions;
drop policy cash_delete on public.cash_transactions;
create policy cash_insert on public.cash_transactions
  for insert to authenticated
  with check (public.can_manage_rt(community_id, rt_unit_id) and payment_id is null);
create policy cash_update on public.cash_transactions
  for update to authenticated
  using (public.can_manage_rt(community_id, rt_unit_id) and payment_id is null)
  with check (public.can_manage_rt(community_id, rt_unit_id) and payment_id is null);
create policy cash_delete on public.cash_transactions
  for delete to authenticated
  using (public.can_manage_rt(community_id, rt_unit_id) and payment_id is null);

-- Berita RT hanya untuk warga RT tsb + pengurus yang berwenang
drop policy news_select on public.news;
drop policy news_write on public.news;
create policy news_select on public.news
  for select to authenticated using (
    public.is_member(community_id)
    and (rt_unit_id is null
         or rt_unit_id = public.my_rt_unit(community_id)
         or public.can_manage_rt(community_id, rt_unit_id))
  );
create policy news_insert on public.news
  for insert to authenticated with check (public.can_manage_rt(community_id, rt_unit_id));
create policy news_update on public.news
  for update to authenticated
  using (public.can_manage_rt(community_id, rt_unit_id))
  with check (public.can_manage_rt(community_id, rt_unit_id));
create policy news_delete on public.news
  for delete to authenticated using (public.can_manage_rt(community_id, rt_unit_id));

-- Storage
drop policy "proofs_select" on storage.objects;
create policy "proofs_select" on storage.objects
  for select to authenticated using (
    bucket_id = 'payment-proofs'
    and (
      (storage.foldername(name))[2] = auth.uid()::text
      or public.can_manage_user(public.try_uuid((storage.foldername(name))[1]),
                                public.try_uuid((storage.foldername(name))[2]))
    )
  );
drop policy "news_images_insert" on storage.objects;
drop policy "news_images_delete" on storage.objects;
create policy "news_images_insert" on storage.objects
  for insert to authenticated with check (
    bucket_id = 'news-images'
    and public.is_any_pengurus(public.try_uuid((storage.foldername(name))[1]))
  );
create policy "news_images_delete" on storage.objects
  for delete to authenticated using (
    bucket_id = 'news-images'
    and public.is_any_pengurus(public.try_uuid((storage.foldername(name))[1]))
  );

-- -----------------------------------------------------------------------------
-- TRIGGER & RPC yang diperbarui
-- -----------------------------------------------------------------------------
create or replace function public.payments_before_insert()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_due  public.dues;
  v_bill public.bills;
begin
  select * into v_due from public.dues where id = new.due_id and community_id = new.community_id;
  if not found then
    raise exception 'Iuran tidak ditemukan';
  end if;

  if v_due.kind = 'wajib' then
    if new.bill_id is null then
      raise exception 'Pembayaran iuran wajib harus terkait tagihan';
    end if;
    select * into v_bill from public.bills where id = new.bill_id;
    if v_bill.due_id <> new.due_id or v_bill.membership_id <> new.membership_id then
      raise exception 'Tagihan tidak sesuai dengan iuran / warga';
    end if;
    if v_bill.status = 'lunas' then
      raise exception 'Tagihan sudah lunas';
    end if;
  else
    new.bill_id := null;
  end if;

  if public.can_manage_member(new.membership_id) then
    if new.status = 'diterima' then
      new.verified_by := auth.uid();
      new.verified_at := now();
    elsif new.status = 'ditolak' then
      raise exception 'Status awal pembayaran tidak valid';
    end if;
  else
    new.status := 'menunggu';
    new.verified_by := null;
    new.verified_at := null;
    new.reject_reason := null;
  end if;

  new.submitted_by := auth.uid();
  return new;
end;
$$;

-- Pemasukan iuran masuk ke kas sesuai RT iurannya (iuran RW -> kas RW)
create or replace function public.payments_after_change()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_due public.dues;
begin
  if tg_op = 'DELETE' then
    perform public.refresh_bill_status(old.bill_id);
    return old;
  end if;

  if new.status = 'diterima' then
    select * into v_due from public.dues where id = new.due_id;
    insert into public.cash_transactions
      (community_id, rt_unit_id, type, amount, category, description, trx_date, payment_id, created_by)
    values
      (new.community_id, v_due.rt_unit_id, 'masuk', new.amount, 'Iuran',
       v_due.name || coalesce(' - ' || (select coalesce(nullif(p.full_name, ''), 'Warga')
                                         from public.memberships m
                                         join public.profiles p on p.id = m.user_id
                                         where m.id = new.membership_id), ''),
       coalesce(new.verified_at, now())::date, new.id, new.verified_by)
    on conflict (payment_id) do update
      set amount = excluded.amount;
  else
    delete from public.cash_transactions where payment_id = new.id;
  end if;

  perform public.refresh_bill_status(new.bill_id);
  if tg_op = 'UPDATE' and old.bill_id is distinct from new.bill_id then
    perform public.refresh_bill_status(old.bill_id);
  end if;
  return new;
end;
$$;

create or replace function public.approve_member(p_membership_id uuid, p_approve boolean)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_m public.memberships;
begin
  select * into v_m from public.memberships where id = p_membership_id;
  if not found or not public.can_manage_rt(v_m.community_id, v_m.rt_unit_id) then
    raise exception 'Tidak diizinkan';
  end if;
  if v_m.status <> 'pending' then
    raise exception 'Permintaan sudah diproses';
  end if;

  update public.memberships
  set status = case when p_approve then 'active'::public.member_status
                    else 'rejected'::public.member_status end,
      approved_by = auth.uid(),
      approved_at = now()
  where id = p_membership_id;
end;
$$;

-- Pengurus: pindah RT hanya dalam wewenangnya. Warga: hanya ubah alamat sendiri.
create or replace function public.update_member_info(
  p_membership_id uuid,
  p_rt_unit_id    uuid,
  p_address       text
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_m public.memberships;
begin
  select * into v_m from public.memberships where id = p_membership_id;
  if not found then
    raise exception 'Tidak diizinkan';
  end if;

  if public.can_manage_rt(v_m.community_id, v_m.rt_unit_id) then
    if p_rt_unit_id is distinct from v_m.rt_unit_id
       and not public.can_manage_rt(v_m.community_id, p_rt_unit_id) then
      raise exception 'Tidak berwenang memindahkan ke RT tersebut';
    end if;
  elsif v_m.user_id = auth.uid() and v_m.status = 'active' then
    if p_rt_unit_id is distinct from v_m.rt_unit_id then
      raise exception 'Perpindahan RT dilakukan oleh pengurus';
    end if;
  else
    raise exception 'Tidak diizinkan';
  end if;

  if p_rt_unit_id is not null and not exists (
    select 1 from public.rt_units where id = p_rt_unit_id and community_id = v_m.community_id
  ) then
    raise exception 'RT tidak valid';
  end if;

  update public.memberships
  set rt_unit_id = p_rt_unit_id, address = p_address
  where id = p_membership_id;
end;
$$;

create or replace function public.remove_member(p_membership_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_m public.memberships;
begin
  select * into v_m from public.memberships where id = p_membership_id;
  if not found
     or not (public.can_manage_member(p_membership_id) or v_m.user_id = auth.uid()) then
    raise exception 'Tidak diizinkan';
  end if;
  if v_m.role = 'ketua' and v_m.status = 'active' then
    raise exception 'Ketua tidak dapat dikeluarkan. Serahkan jabatan terlebih dahulu';
  end if;
  if v_m.role = 'pengurus' and v_m.user_id <> auth.uid()
     and not public.is_ketua(v_m.community_id) then
    raise exception 'Hanya ketua yang dapat mengeluarkan pengurus';
  end if;

  update public.memberships
  set status = 'inactive', role = 'warga', position = null, managed_rt_unit_id = null
  where id = p_membership_id;
end;
$$;

-- Ubah peran + (opsional) batasi wewenang pengurus ke satu RT
drop function public.set_member_role(uuid, public.member_role, text);
create or replace function public.set_member_role(
  p_membership_id      uuid,
  p_role               public.member_role,
  p_position           text default null,
  p_managed_rt_unit_id uuid default null
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_m public.memberships;
begin
  select * into v_m from public.memberships where id = p_membership_id;
  if not found or not public.is_ketua(v_m.community_id) then
    raise exception 'Hanya ketua yang dapat mengubah peran';
  end if;
  if v_m.status <> 'active' then
    raise exception 'Anggota belum aktif';
  end if;
  if v_m.role = 'ketua' and p_role <> 'ketua' then
    raise exception 'Serahkan jabatan ketua ke anggota lain terlebih dahulu';
  end if;
  if p_managed_rt_unit_id is not null then
    if p_role <> 'pengurus' then
      raise exception 'Batas wewenang RT hanya untuk pengurus';
    end if;
    if not exists (select 1 from public.rt_units
                   where id = p_managed_rt_unit_id and community_id = v_m.community_id) then
      raise exception 'RT tidak valid';
    end if;
  end if;

  if p_role = 'ketua' and v_m.role <> 'ketua' then
    update public.memberships
    set role = 'pengurus', position = 'Mantan Ketua', managed_rt_unit_id = null
    where community_id = v_m.community_id and role = 'ketua' and status = 'active';
  end if;

  update public.memberships
  set role = p_role,
      managed_rt_unit_id = case when p_role = 'pengurus' then p_managed_rt_unit_id end,
      position = coalesce(nullif(trim(p_position), ''),
                          case when p_role = 'warga' then null else position end)
  where id = p_membership_id;
end;
$$;

-- Pengurus RT: iuran RW -> tagihan hanya untuk warga RT-nya; iuran RT -> RT-nya.
create or replace function public.generate_bills(p_due_id uuid, p_period date)
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_due    public.dues;
  v_period date;
  v_count  integer;
  v_full   boolean;
  v_scope  uuid;
begin
  select * into v_due from public.dues where id = p_due_id;
  if not found then
    raise exception 'Tidak diizinkan';
  end if;

  v_full := public.is_pengurus(v_due.community_id);
  if not v_full then
    select m.managed_rt_unit_id into v_scope
    from public.memberships m
    where m.community_id = v_due.community_id and m.user_id = auth.uid()
      and m.status = 'active' and m.role = 'pengurus';
    if v_scope is null
       or not public.is_any_pengurus(v_due.community_id)
       or (v_due.rt_unit_id is not null and v_due.rt_unit_id <> v_scope) then
      raise exception 'Tidak diizinkan';
    end if;
  end if;

  if v_due.kind <> 'wajib' then
    raise exception 'Tagihan hanya untuk iuran wajib';
  end if;
  if not v_due.is_active then
    raise exception 'Iuran tidak aktif';
  end if;

  v_period := case when v_due.frequency = 'bulanan'
                   then date_trunc('month', p_period)::date
                   else p_period end;

  insert into public.bills (community_id, due_id, membership_id, period, amount, due_date)
  select v_due.community_id, v_due.id, m.id, v_period, v_due.amount,
         case when v_due.frequency = 'bulanan'
              then v_period + (v_due.due_day - 1)
              else v_period end
  from public.memberships m
  where m.community_id = v_due.community_id
    and m.status = 'active'
    and (v_due.rt_unit_id is null or m.rt_unit_id = v_due.rt_unit_id)
    and (v_full or m.rt_unit_id = v_scope)
  on conflict (due_id, membership_id, period) do nothing;

  get diagnostics v_count = row_count;
  return v_count;
end;
$$;

create or replace function public.verify_payment(
  p_payment_id uuid,
  p_accept     boolean,
  p_reason     text default null
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_p public.payments;
begin
  select * into v_p from public.payments where id = p_payment_id;
  if not found or not public.can_manage_member(v_p.membership_id) then
    raise exception 'Tidak diizinkan';
  end if;
  if v_p.status <> 'menunggu' then
    raise exception 'Pembayaran sudah diverifikasi';
  end if;

  update public.payments
  set status = case when p_accept then 'diterima'::public.payment_status
                    else 'ditolak'::public.payment_status end,
      verified_by = auth.uid(),
      verified_at = now(),
      reject_reason = case when p_accept then null else p_reason end
  where id = p_payment_id;
end;
$$;

-- Laporan kas: semua kas (default), hanya kas RW (p_only_rw), atau kas satu RT
create or replace function public.cash_in_scope(p_row_rt uuid, p_only_rw boolean, p_rt uuid)
returns boolean
language sql
immutable
set search_path = ''
as $$
  select case
           when p_rt is not null then p_row_rt is not distinct from p_rt
           when p_only_rw then p_row_rt is null
           else true
         end;
$$;

drop function public.cash_report(uuid, date, date);
create or replace function public.cash_report(
  p_community_id uuid,
  p_from         date,
  p_to           date,
  p_only_rw      boolean default false,
  p_rt_unit_id   uuid default null
)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_opening numeric;
  v_income  numeric;
  v_expense numeric;
  v_cats    jsonb;
begin
  if not public.is_member(p_community_id) then
    raise exception 'Tidak diizinkan';
  end if;

  select
    coalesce(sum(case when t.type = 'masuk' then t.amount else -t.amount end)
             filter (where t.trx_date < p_from), 0),
    coalesce(sum(t.amount) filter (where t.type = 'masuk' and t.trx_date >= p_from), 0),
    coalesce(sum(t.amount) filter (where t.type = 'keluar' and t.trx_date >= p_from), 0)
    into v_opening, v_income, v_expense
  from public.cash_transactions t
  where t.community_id = p_community_id
    and t.trx_date <= p_to
    and public.cash_in_scope(t.rt_unit_id, p_only_rw, p_rt_unit_id);

  select coalesce(jsonb_agg(jsonb_build_object('type', type, 'category', category, 'total', total)
                            order by type, total desc), '[]'::jsonb)
    into v_cats
  from (select t.type, t.category, sum(t.amount) as total
        from public.cash_transactions t
        where t.community_id = p_community_id
          and t.trx_date between p_from and p_to
          and public.cash_in_scope(t.rt_unit_id, p_only_rw, p_rt_unit_id)
        group by t.type, t.category) c;

  return jsonb_build_object(
    'opening_balance', v_opening,
    'income', v_income,
    'expense', v_expense,
    'closing_balance', v_opening + v_income - v_expense,
    'by_category', v_cats
  );
end;
$$;

-- =============================================================================
-- NOTIFIKASI
-- =============================================================================
create table public.push_tokens (
  token      text primary key,  -- ExponentPushToken[...]
  user_id    uuid not null references public.profiles (id) on delete cascade,
  platform   text,
  updated_at timestamptz not null default now()
);
create index push_tokens_user_idx on public.push_tokens (user_id);

create table public.notifications (
  id           uuid primary key default gen_random_uuid(),
  user_id      uuid not null references public.profiles (id) on delete cascade,
  community_id uuid references public.communities (id) on delete cascade,
  title        text not null,
  body         text not null default '',
  url          text,  -- rute di aplikasi, mis. '/iuran'
  created_at   timestamptz not null default now(),
  read_at      timestamptz,
  pushed_at    timestamptz
);
create index notifications_user_idx on public.notifications (user_id, created_at desc);
create index notifications_unpushed_idx on public.notifications (created_at) where pushed_at is null;

alter table public.push_tokens enable row level security;
alter table public.notifications enable row level security;

create policy push_tokens_select on public.push_tokens
  for select to authenticated using (user_id = auth.uid());
create policy push_tokens_delete on public.push_tokens
  for delete to authenticated using (user_id = auth.uid());

create policy notifications_select on public.notifications
  for select to authenticated using (user_id = auth.uid());
create policy notifications_update on public.notifications
  for update to authenticated using (user_id = auth.uid()) with check (user_id = auth.uid());
create policy notifications_delete on public.notifications
  for delete to authenticated using (user_id = auth.uid());

create or replace function public.register_push_token(p_token text, p_platform text default null)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if auth.uid() is null then
    raise exception 'Harus login';
  end if;
  if p_token !~ '^Expo(nent)?PushToken\[.+\]$' then
    raise exception 'Token push tidak valid';
  end if;
  -- satu perangkat = satu token; jika berganti akun, token pindah pemilik
  insert into public.push_tokens (token, user_id, platform, updated_at)
  values (p_token, auth.uid(), p_platform, now())
  on conflict (token) do update
    set user_id = excluded.user_id, platform = excluded.platform, updated_at = now();
end;
$$;

-- ---- Format teks --------------------------------------------------------------
create or replace function public.fmt_rupiah(p numeric)
returns text
language sql
immutable
set search_path = ''
as $$
  select 'Rp' || regexp_replace(round(p)::bigint::text, '(\d)(?=(\d{3})+$)', '\1.', 'g');
$$;

create or replace function public.fmt_period(p date, p_frequency public.due_frequency)
returns text
language sql
immutable
set search_path = ''
as $$
  select case when p_frequency = 'bulanan'
    then (array['Januari','Februari','Maret','April','Mei','Juni','Juli','Agustus',
                'September','Oktober','November','Desember'])[extract(month from p)::int]
         || ' ' || extract(year from p)::int
    else to_char(p, 'DD-MM-YYYY') end;
$$;

-- ---- Penerima -------------------------------------------------------------------
-- User yang berwenang atas RT p_rt (ketua, pengurus RW, pengurus RT tsb)
create or replace function public.managers_of(p_community_id uuid, p_rt uuid)
returns setof uuid
language sql
stable
security definer
set search_path = ''
as $$
  select m.user_id from public.memberships m
  where m.community_id = p_community_id
    and m.status = 'active'
    and (m.role = 'ketua'
         or (m.role = 'pengurus'
             and (m.managed_rt_unit_id is null or m.managed_rt_unit_id = p_rt)));
$$;

create or replace function public.notify(
  p_user_ids     uuid[],
  p_community_id uuid,
  p_title        text,
  p_body         text,
  p_url          text
)
returns void
language sql
security definer
set search_path = ''
as $$
  insert into public.notifications (user_id, community_id, title, body, url)
  select distinct u, p_community_id, p_title, coalesce(p_body, ''), p_url
  from unnest(p_user_ids) as u
  where u is not null
    and u is distinct from auth.uid();  -- pelaku aksi tidak perlu dinotifikasi
$$;

-- ---- Trigger: keanggotaan -----------------------------------------------------
create or replace function public.memberships_notify()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_name      text;
  v_community text;
begin
  select full_name into v_name from public.profiles where id = new.user_id;
  select name into v_community from public.communities where id = new.community_id;

  if new.status = 'pending' and (tg_op = 'INSERT' or old.status <> 'pending') then
    perform public.notify(
      array(select public.managers_of(new.community_id, new.rt_unit_id)),
      new.community_id, 'Permintaan bergabung',
      coalesce(nullif(v_name, ''), 'Seseorang') || ' ingin bergabung ke ' || v_community,
      '/manage/members');
  elsif tg_op = 'UPDATE' and old.status = 'pending' and new.status = 'active' then
    perform public.notify(array[new.user_id], new.community_id, 'Permintaan disetujui',
      'Selamat datang di ' || v_community || '!', '/home');
  elsif tg_op = 'UPDATE' and old.status = 'pending' and new.status = 'rejected' then
    perform public.notify(array[new.user_id], new.community_id, 'Permintaan ditolak',
      'Permintaan bergabung ke ' || v_community || ' ditolak pengurus.', null);
  elsif tg_op = 'UPDATE' and new.status = 'active'
        and (old.role <> new.role or old.managed_rt_unit_id is distinct from new.managed_rt_unit_id) then
    perform public.notify(array[new.user_id], new.community_id, 'Peran Anda diperbarui',
      'Anda sekarang ' || coalesce(new.position, initcap(new.role::text)) || ' di ' || v_community, '/akun');
  end if;
  return new;
end;
$$;

create trigger memberships_notify
  after insert or update on public.memberships
  for each row execute function public.memberships_notify();

-- ---- Trigger: tagihan baru ----------------------------------------------------
create or replace function public.bills_notify()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_due  public.dues;
  v_user uuid;
begin
  select * into v_due from public.dues where id = new.due_id;
  select user_id into v_user from public.memberships where id = new.membership_id;
  perform public.notify(array[v_user], new.community_id,
    'Tagihan baru: ' || v_due.name,
    public.fmt_period(new.period, v_due.frequency) || ' · ' || public.fmt_rupiah(new.amount)
      || coalesce(' · jatuh tempo ' || to_char(new.due_date, 'DD-MM-YYYY'), ''),
    '/iuran');
  return new;
end;
$$;

create trigger bills_notify
  after insert on public.bills
  for each row execute function public.bills_notify();

-- ---- Trigger: pembayaran ------------------------------------------------------
create or replace function public.payments_notify()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_due  text;
  v_m    public.memberships;
  v_name text;
  v_info text;
begin
  select name into v_due from public.dues where id = new.due_id;
  select * into v_m from public.memberships where id = new.membership_id;
  select full_name into v_name from public.profiles where id = v_m.user_id;
  v_info := v_due || ' · ' || public.fmt_rupiah(new.amount);

  if tg_op = 'INSERT' and new.status = 'menunggu' then
    perform public.notify(array(select public.managers_of(new.community_id, v_m.rt_unit_id)),
      new.community_id, 'Pembayaran menunggu verifikasi',
      coalesce(nullif(v_name, ''), 'Warga') || ' · ' || v_info, '/manage/verify');
  elsif tg_op = 'INSERT' and new.status = 'diterima' then
    perform public.notify(array[v_m.user_id], new.community_id, 'Pembayaran tercatat',
      v_info || ' telah dicatat pengurus. Terima kasih!', '/iuran');
  elsif tg_op = 'UPDATE' and old.status = 'menunggu' and new.status = 'diterima' then
    perform public.notify(array[v_m.user_id], new.community_id, 'Pembayaran diterima ✓',
      v_info || '. Terima kasih!', '/iuran');
  elsif tg_op = 'UPDATE' and old.status = 'menunggu' and new.status = 'ditolak' then
    perform public.notify(array[v_m.user_id], new.community_id, 'Pembayaran ditolak',
      v_info || coalesce('. Alasan: ' || new.reject_reason, ''), '/iuran');
  end if;
  return new;
end;
$$;

create trigger payments_notify
  after insert or update of status on public.payments
  for each row execute function public.payments_notify();

-- ---- Trigger: berita ----------------------------------------------------------
create or replace function public.news_notify()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  perform public.notify(
    array(
      select m.user_id from public.memberships m
      where m.community_id = new.community_id
        and m.status = 'active'
        and (new.rt_unit_id is null or m.rt_unit_id = new.rt_unit_id)
      union
      select public.managers_of(new.community_id, new.rt_unit_id)
      where new.rt_unit_id is not null
    ),
    new.community_id,
    '📢 ' || new.title,
    left(regexp_replace(new.body, '\s+', ' ', 'g'), 140),
    '/news/' || new.id);
  return new;
end;
$$;

create trigger news_notify
  after insert on public.news
  for each row execute function public.news_notify();

-- ---- Pengiriman push (dipanggil Edge Function dengan service role) -------------
-- Mengklaim notifikasi yang belum dikirim secara atomik (aman dipanggil paralel)
create or replace function public.claim_push_batch(p_limit integer default 500)
returns table (notification_id uuid, token text, title text, body text, url text, community_id uuid)
language sql
security definer
set search_path = ''
as $$
  with claimed as (
    update public.notifications n
    set pushed_at = now()
    where n.id in (
      select id from public.notifications
      where pushed_at is null and created_at > now() - interval '1 day'
      order by created_at
      limit p_limit
      for update skip locked
    )
    returning n.id, n.user_id, n.title, n.body, n.url, n.community_id
  )
  select c.id, t.token, c.title, c.body, c.url, c.community_id
  from claimed c
  join public.push_tokens t on t.user_id = c.user_id;
$$;

-- =============================================================================
-- HAK AKSES
-- =============================================================================
revoke all on public.push_tokens, public.notifications from anon;
revoke insert, update on public.push_tokens from authenticated;
grant select, delete on public.push_tokens to authenticated;
revoke insert, update on public.notifications from authenticated;
grant select, delete on public.notifications to authenticated;
grant update (read_at) on public.notifications to authenticated;

-- Supabase memberi EXECUTE default ke anon untuk fungsi baru: cabut ulang
revoke all on all functions in schema public from public, anon;
grant execute on all functions in schema public to authenticated;
revoke execute on function
  public.handle_new_user(),
  public.payments_before_insert(),
  public.payments_after_change(),
  public.bills_after_amount_change(),
  public.refresh_bill_status(uuid),
  public.memberships_notify(),
  public.bills_notify(),
  public.payments_notify(),
  public.news_notify(),
  public.notify(uuid[], uuid, text, text, text),
  public.managers_of(uuid, uuid),
  public.claim_push_batch(integer)
from authenticated;
grant execute on function public.claim_push_batch(integer) to service_role;
