-- =============================================================================
-- Kask: iuran, kas, dan berita untuk RT / RW (multi-komunitas)
--
-- Prinsip:
--   * Setiap baris data milik tepat satu komunitas (community_id).
--   * Isolasi data antar komunitas dipaksakan oleh Row Level Security (RLS),
--     bukan oleh aplikasi. Foreign key komposit (id, community_id) menjamin
--     baris anak tidak bisa "menyeberang" ke komunitas lain.
--   * Peran per komunitas: ketua (tertinggi: Ketua RW / Ketua RT),
--     pengurus (bendahara, sekretaris, ketua RT di dalam RW, dst), warga.
--   * Super admin (developer) = profiles.is_super_admin, bisa melihat dan
--     mengelola semua komunitas. Diset manual lewat SQL editor.
--   * Operasi sensitif (gabung, approve, ubah peran, verifikasi pembayaran,
--     generate tagihan) hanya lewat fungsi RPC security definer.
-- =============================================================================

create extension if not exists pgcrypto with schema extensions;

-- -----------------------------------------------------------------------------
-- ENUM
-- -----------------------------------------------------------------------------
create type public.community_type as enum ('RT', 'RW');
create type public.member_role    as enum ('ketua', 'pengurus', 'warga');
create type public.member_status  as enum ('pending', 'active', 'rejected', 'inactive');
create type public.due_kind       as enum ('wajib', 'sukarela');
create type public.due_frequency  as enum ('bulanan', 'sekali');
create type public.bill_status    as enum ('belum_bayar', 'menunggu_verifikasi', 'lunas');
create type public.payment_status as enum ('menunggu', 'diterima', 'ditolak');
create type public.payment_method as enum ('tunai', 'transfer', 'qris', 'lainnya');
create type public.cash_type      as enum ('masuk', 'keluar');

-- -----------------------------------------------------------------------------
-- UTIL
-- -----------------------------------------------------------------------------
create or replace function public.gen_invite_code()
returns text
language sql
volatile
set search_path = ''
as $$
  -- 6 karakter, tanpa karakter yang mirip (0/O, 1/I/L)
  select string_agg(substr('ABCDEFGHJKMNPQRSTUVWXYZ23456789', 1 + floor(random() * 31)::int, 1), '')
  from generate_series(1, 6);
$$;

create or replace function public.try_uuid(p text)
returns uuid
language plpgsql
immutable
set search_path = ''
as $$
begin
  return p::uuid;
exception when others then
  return null;
end;
$$;

create or replace function public.touch_updated_at()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

-- -----------------------------------------------------------------------------
-- PROFILES
-- -----------------------------------------------------------------------------
create table public.profiles (
  id             uuid primary key references auth.users (id) on delete cascade,
  full_name      text not null default '',
  phone          text,
  avatar_url     text,
  is_super_admin boolean not null default false,
  created_at     timestamptz not null default now()
);

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.profiles (id, full_name, phone)
  values (
    new.id,
    coalesce(new.raw_user_meta_data ->> 'full_name', ''),
    new.raw_user_meta_data ->> 'phone'
  )
  on conflict (id) do nothing;
  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- -----------------------------------------------------------------------------
-- COMMUNITIES (satu RT atau satu RW)
-- -----------------------------------------------------------------------------
create table public.communities (
  id          uuid primary key default gen_random_uuid(),
  name        text not null check (length(trim(name)) > 0),
  type        public.community_type not null,
  rw_number   text not null,
  rt_number   text,
  kelurahan   text,
  kecamatan   text,
  kota        text,
  provinsi    text,
  address     text,
  bank_info   text,  -- info rekening / QRIS untuk transfer iuran
  invite_code text not null unique default public.gen_invite_code(),
  is_active   boolean not null default true,  -- dinonaktifkan oleh super admin
  created_by  uuid references auth.users (id) on delete set null,
  created_at  timestamptz not null default now(),
  constraint rt_requires_number check (type = 'RW' or rt_number is not null)
);

-- Daftar RT di dalam komunitas RW (opsional, untuk pengelompokan warga)
create table public.rt_units (
  id           uuid primary key default gen_random_uuid(),
  community_id uuid not null references public.communities (id) on delete cascade,
  rt_number    text not null,
  name         text,
  created_at   timestamptz not null default now(),
  unique (community_id, rt_number),
  unique (id, community_id)
);

-- -----------------------------------------------------------------------------
-- MEMBERSHIPS (user <-> komunitas, satu baris = satu rumah tangga/akun)
-- -----------------------------------------------------------------------------
create table public.memberships (
  id           uuid primary key default gen_random_uuid(),
  community_id uuid not null references public.communities (id) on delete cascade,
  -- FK ke profiles (bukan auth.users) agar bisa di-join lewat API: memberships -> profiles
  user_id      uuid not null references public.profiles (id) on delete cascade,
  role         public.member_role not null default 'warga',
  position     text,  -- jabatan: "Ketua RW", "Bendahara", "Ketua RT 03", ...
  status       public.member_status not null default 'pending',
  rt_unit_id   uuid,
  address      text,  -- alamat / nomor rumah
  joined_at    timestamptz not null default now(),
  approved_by  uuid references auth.users (id) on delete set null,
  approved_at  timestamptz,
  unique (community_id, user_id),
  unique (id, community_id),
  foreign key (rt_unit_id, community_id)
    references public.rt_units (id, community_id) on delete set null (rt_unit_id)
);

-- Maksimal satu ketua aktif per komunitas
create unique index memberships_one_ketua
  on public.memberships (community_id)
  where role = 'ketua' and status = 'active';

create index memberships_user_idx on public.memberships (user_id);

-- -----------------------------------------------------------------------------
-- DUES (jenis iuran)
-- -----------------------------------------------------------------------------
create table public.dues (
  id            uuid primary key default gen_random_uuid(),
  community_id  uuid not null references public.communities (id) on delete cascade,
  name          text not null check (length(trim(name)) > 0),
  description   text,
  kind          public.due_kind not null,
  frequency     public.due_frequency not null default 'bulanan',
  amount        numeric(14, 2) check (amount is null or amount > 0),
  target_amount numeric(14, 2) check (target_amount is null or target_amount > 0),
  rt_unit_id    uuid,          -- null = berlaku untuk semua warga
  due_day       smallint not null default 10 check (due_day between 1 and 28),
  is_active     boolean not null default true,
  created_by    uuid references auth.users (id) on delete set null default auth.uid(),
  created_at    timestamptz not null default now(),
  unique (id, community_id),
  constraint wajib_requires_amount check (kind = 'sukarela' or amount is not null),
  foreign key (rt_unit_id, community_id)
    references public.rt_units (id, community_id) on delete set null (rt_unit_id)
);

create index dues_community_idx on public.dues (community_id);

-- -----------------------------------------------------------------------------
-- BILLS (tagihan iuran wajib per warga per periode)
-- -----------------------------------------------------------------------------
create table public.bills (
  id            uuid primary key default gen_random_uuid(),
  community_id  uuid not null references public.communities (id) on delete cascade,
  due_id        uuid not null,
  membership_id uuid not null,
  period        date not null,  -- bulanan: tanggal 1 bulan tsb; sekali: tanggal tagihan
  amount        numeric(14, 2) not null check (amount > 0),
  due_date      date,
  status        public.bill_status not null default 'belum_bayar',
  paid_at       timestamptz,
  created_at    timestamptz not null default now(),
  unique (due_id, membership_id, period),
  unique (id, community_id),
  foreign key (due_id, community_id)
    references public.dues (id, community_id) on delete cascade,
  foreign key (membership_id, community_id)
    references public.memberships (id, community_id) on delete cascade
);

create index bills_community_period_idx on public.bills (community_id, period);
create index bills_membership_idx on public.bills (membership_id);

-- -----------------------------------------------------------------------------
-- PAYMENTS (pembayaran iuran wajib maupun sukarela)
-- -----------------------------------------------------------------------------
create table public.payments (
  id            uuid primary key default gen_random_uuid(),
  community_id  uuid not null references public.communities (id) on delete cascade,
  due_id        uuid not null,
  membership_id uuid not null,
  bill_id       uuid,  -- wajib: tagihan yang dibayar; sukarela: null
  amount        numeric(14, 2) not null check (amount > 0),
  method        public.payment_method not null default 'transfer',
  proof_path    text,  -- path file di bucket 'payment-proofs'
  note          text,
  status        public.payment_status not null default 'menunggu',
  submitted_by  uuid references auth.users (id) on delete set null default auth.uid(),
  verified_by   uuid references auth.users (id) on delete set null,
  verified_at   timestamptz,
  reject_reason text,
  created_at    timestamptz not null default now(),
  unique (id, community_id),
  foreign key (due_id, community_id)
    references public.dues (id, community_id) on delete cascade,
  foreign key (membership_id, community_id)
    references public.memberships (id, community_id) on delete cascade,
  foreign key (bill_id, community_id)
    references public.bills (id, community_id) on delete set null (bill_id)
);

create index payments_community_status_idx on public.payments (community_id, status);
create index payments_bill_idx on public.payments (bill_id);
create index payments_due_idx on public.payments (due_id);

-- -----------------------------------------------------------------------------
-- CASH TRANSACTIONS (buku kas)
-- -----------------------------------------------------------------------------
create table public.cash_transactions (
  id              uuid primary key default gen_random_uuid(),
  community_id    uuid not null references public.communities (id) on delete cascade,
  type            public.cash_type not null,
  amount          numeric(14, 2) not null check (amount > 0),
  category        text not null default 'Lainnya',
  description     text,
  trx_date        date not null default current_date,
  payment_id      uuid unique,  -- terisi otomatis untuk pemasukan dari iuran
  attachment_path text,
  created_by      uuid references auth.users (id) on delete set null default auth.uid(),
  created_at      timestamptz not null default now(),
  foreign key (payment_id, community_id)
    references public.payments (id, community_id) on delete cascade
);

create index cash_community_date_idx on public.cash_transactions (community_id, trx_date);

-- -----------------------------------------------------------------------------
-- NEWS (berita / pengumuman)
-- -----------------------------------------------------------------------------
create table public.news (
  id           uuid primary key default gen_random_uuid(),
  community_id uuid not null references public.communities (id) on delete cascade,
  title        text not null check (length(trim(title)) > 0),
  body         text not null default '',
  image_path   text,  -- path file di bucket 'news-images'
  is_pinned    boolean not null default false,
  author_id    uuid references public.profiles (id) on delete set null default auth.uid(),
  published_at timestamptz not null default now(),
  updated_at   timestamptz not null default now()
);

create index news_community_idx on public.news (community_id, published_at desc);

create trigger news_touch before update on public.news
  for each row execute function public.touch_updated_at();

-- =============================================================================
-- FUNGSI OTORISASI (dipakai oleh RLS)
-- =============================================================================
create or replace function public.is_super_admin()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select coalesce(
    (select p.is_super_admin from public.profiles p where p.id = auth.uid()),
    false
  );
$$;

-- Peran aktif user saat ini di komunitas (null jika bukan anggota aktif
-- atau komunitasnya dinonaktifkan)
create or replace function public.my_role(p_community_id uuid)
returns public.member_role
language sql
stable
security definer
set search_path = ''
as $$
  select m.role
  from public.memberships m
  join public.communities c on c.id = m.community_id
  where m.community_id = p_community_id
    and m.user_id = auth.uid()
    and m.status = 'active'
    and c.is_active;
$$;

create or replace function public.my_membership_id(p_community_id uuid)
returns uuid
language sql
stable
security definer
set search_path = ''
as $$
  select m.id
  from public.memberships m
  where m.community_id = p_community_id
    and m.user_id = auth.uid()
    and m.status = 'active';
$$;

create or replace function public.is_member(p_community_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select public.is_super_admin() or public.my_role(p_community_id) is not null;
$$;

create or replace function public.is_pengurus(p_community_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select public.is_super_admin()
      or coalesce(public.my_role(p_community_id) in ('ketua', 'pengurus'), false);
$$;

create or replace function public.is_ketua(p_community_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select public.is_super_admin()
      or coalesce(public.my_role(p_community_id) = 'ketua', false);
$$;

-- Apakah user saat ini berbagi komunitas dengan user lain (untuk melihat profil)
create or replace function public.can_see_profile(p_user_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select p_user_id = auth.uid()
      or public.is_super_admin()
      or exists (
        select 1
        from public.memberships me
        join public.memberships other on other.community_id = me.community_id
        where me.user_id = auth.uid()
          and me.status = 'active'
          and other.user_id = p_user_id
          and (other.status = 'active' or me.role in ('ketua', 'pengurus'))
      );
$$;

-- =============================================================================
-- TRIGGER PEMBAYARAN -> TAGIHAN & KAS
-- =============================================================================

-- Hitung ulang status tagihan dari pembayaran yang ada
create or replace function public.refresh_bill_status(p_bill_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_amount   numeric;
  v_paid     numeric;
  v_pending  boolean;
  v_last_at  timestamptz;
begin
  if p_bill_id is null then
    return;
  end if;

  select amount into v_amount from public.bills where id = p_bill_id;
  if not found then
    return;
  end if;

  select coalesce(sum(amount) filter (where status = 'diterima'), 0),
         coalesce(bool_or(status = 'menunggu'), false),
         max(verified_at) filter (where status = 'diterima')
    into v_paid, v_pending, v_last_at
  from public.payments
  where bill_id = p_bill_id;

  update public.bills
  set status = case
                 when v_paid >= v_amount then 'lunas'::public.bill_status
                 when v_pending then 'menunggu_verifikasi'::public.bill_status
                 else 'belum_bayar'::public.bill_status
               end,
      paid_at = case when v_paid >= v_amount then coalesce(v_last_at, now()) else null end
  where id = p_bill_id;
end;
$$;

-- Validasi & normalisasi sebelum pembayaran disimpan
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

  if public.is_pengurus(new.community_id) then
    -- pengurus mencatat pembayaran (mis. tunai) -> boleh langsung diterima
    if new.status = 'diterima' then
      new.verified_by := auth.uid();
      new.verified_at := now();
    elsif new.status = 'ditolak' then
      raise exception 'Status awal pembayaran tidak valid';
    end if;
  else
    -- warga hanya bisa mengajukan, menunggu verifikasi pengurus
    new.status := 'menunggu';
    new.verified_by := null;
    new.verified_at := null;
    new.reject_reason := null;
  end if;

  new.submitted_by := auth.uid();
  return new;
end;
$$;

create trigger payments_before_insert
  before insert on public.payments
  for each row execute function public.payments_before_insert();

-- Sinkronkan tagihan dan buku kas setelah pembayaran berubah
create or replace function public.payments_after_change()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_due_name text;
begin
  if tg_op = 'DELETE' then
    perform public.refresh_bill_status(old.bill_id);
    return old;
  end if;

  if new.status = 'diterima' then
    select name into v_due_name from public.dues where id = new.due_id;
    insert into public.cash_transactions
      (community_id, type, amount, category, description, trx_date, payment_id, created_by)
    values
      (new.community_id, 'masuk', new.amount, 'Iuran',
       v_due_name || coalesce(' - ' || (select coalesce(nullif(p.full_name, ''), 'Warga')
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

create trigger payments_after_change
  after insert or update or delete on public.payments
  for each row execute function public.payments_after_change();

-- Perubahan nominal tagihan -> hitung ulang status
create or replace function public.bills_after_amount_change()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  perform public.refresh_bill_status(new.id);
  return new;
end;
$$;

create trigger bills_after_amount_change
  after update of amount on public.bills
  for each row execute function public.bills_after_amount_change();

-- =============================================================================
-- RPC
-- =============================================================================

-- Buat komunitas baru; pembuat otomatis jadi ketua
create or replace function public.create_community(
  p_name        text,
  p_type        public.community_type,
  p_rw_number   text,
  p_rt_number   text default null,
  p_kelurahan   text default null,
  p_kecamatan   text default null,
  p_kota        text default null,
  p_provinsi    text default null,
  p_address     text default null,
  p_my_address  text default null
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_id   uuid;
  v_code text;
begin
  if auth.uid() is null then
    raise exception 'Harus login';
  end if;

  loop
    v_code := public.gen_invite_code();
    exit when not exists (select 1 from public.communities where invite_code = v_code);
  end loop;

  insert into public.communities
    (name, type, rw_number, rt_number, kelurahan, kecamatan, kota, provinsi, address,
     invite_code, created_by)
  values
    (p_name, p_type, p_rw_number, case when p_type = 'RT' then p_rt_number end,
     p_kelurahan, p_kecamatan, p_kota, p_provinsi, p_address, v_code, auth.uid())
  returning id into v_id;

  insert into public.memberships
    (community_id, user_id, role, position, status, address, approved_by, approved_at)
  values
    (v_id, auth.uid(), 'ketua',
     case when p_type = 'RW' then 'Ketua RW ' || p_rw_number
          else 'Ketua RT ' || p_rt_number end,
     'active', p_my_address, auth.uid(), now());

  return v_id;
end;
$$;

-- Lihat info komunitas dari kode undangan (sebelum bergabung)
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

-- Ajukan bergabung (status pending, menunggu persetujuan pengurus)
create or replace function public.join_community(
  p_code       text,
  p_rt_unit_id uuid default null,
  p_address    text default null
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_cid      uuid;
  v_existing public.memberships;
  v_id       uuid;
begin
  if auth.uid() is null then
    raise exception 'Harus login';
  end if;

  select id into v_cid from public.communities
  where invite_code = upper(trim(p_code)) and is_active;
  if v_cid is null then
    raise exception 'Kode undangan tidak valid';
  end if;

  if p_rt_unit_id is not null and not exists (
    select 1 from public.rt_units where id = p_rt_unit_id and community_id = v_cid
  ) then
    raise exception 'RT tidak valid';
  end if;

  select * into v_existing from public.memberships
  where community_id = v_cid and user_id = auth.uid();

  if found then
    if v_existing.status in ('active', 'pending') then
      raise exception 'Anda sudah terdaftar / sedang menunggu persetujuan';
    end if;
    update public.memberships
    set status = 'pending', role = 'warga', position = null,
        rt_unit_id = p_rt_unit_id, address = p_address,
        joined_at = now(), approved_by = null, approved_at = null
    where id = v_existing.id
    returning id into v_id;
  else
    insert into public.memberships (community_id, user_id, rt_unit_id, address)
    values (v_cid, auth.uid(), p_rt_unit_id, p_address)
    returning id into v_id;
  end if;

  return v_id;
end;
$$;

-- Setujui / tolak permintaan bergabung
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
  if not found or not public.is_pengurus(v_m.community_id) then
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

-- Ubah peran anggota (hanya ketua / super admin).
-- Menjadikan orang lain 'ketua' = serah terima jabatan: ketua lama jadi pengurus.
create or replace function public.set_member_role(
  p_membership_id uuid,
  p_role          public.member_role,
  p_position      text default null
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

  if p_role = 'ketua' and v_m.role <> 'ketua' then
    update public.memberships
    set role = 'pengurus', position = 'Mantan Ketua'
    where community_id = v_m.community_id and role = 'ketua' and status = 'active';
  end if;

  update public.memberships
  set role = p_role,
      position = coalesce(nullif(trim(p_position), ''),
                          case when p_role = 'warga' then null else position end)
  where id = p_membership_id;
end;
$$;

-- Ubah data anggota (RT, alamat). Pengurus untuk semua, warga untuk dirinya.
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
  if not found
     or not (public.is_pengurus(v_m.community_id)
             or (v_m.user_id = auth.uid() and v_m.status = 'active')) then
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

-- Keluarkan anggota (pengurus) atau keluar sendiri
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
     or not (public.is_pengurus(v_m.community_id) or v_m.user_id = auth.uid()) then
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
  set status = 'inactive', role = 'warga', position = null
  where id = p_membership_id;
end;
$$;

create or replace function public.regenerate_invite_code(p_community_id uuid)
returns text
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_code text;
begin
  if not public.is_ketua(p_community_id) then
    raise exception 'Hanya ketua yang dapat mengganti kode undangan';
  end if;
  loop
    v_code := public.gen_invite_code();
    exit when not exists (select 1 from public.communities where invite_code = v_code);
  end loop;
  update public.communities set invite_code = v_code where id = p_community_id;
  return v_code;
end;
$$;

-- Buat tagihan iuran wajib untuk satu periode bagi semua anggota aktif
-- (atau anggota RT tertentu jika iuran dibatasi per RT). Idempoten.
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
begin
  select * into v_due from public.dues where id = p_due_id;
  if not found or not public.is_pengurus(v_due.community_id) then
    raise exception 'Tidak diizinkan';
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
  on conflict (due_id, membership_id, period) do nothing;

  get diagnostics v_count = row_count;
  return v_count;
end;
$$;

-- Verifikasi pembayaran yang diajukan warga
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
  if not found or not public.is_pengurus(v_p.community_id) then
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

-- Total terkumpul per iuran (transparansi, boleh dilihat semua anggota)
create or replace function public.due_totals(p_community_id uuid)
returns table (due_id uuid, collected numeric, contributors bigint)
language sql
stable
security definer
set search_path = ''
as $$
  select p.due_id, sum(p.amount), count(distinct p.membership_id)
  from public.payments p
  where p.community_id = p_community_id
    and p.status = 'diterima'
    and public.is_member(p_community_id)
  group by p.due_id;
$$;

-- Laporan kas untuk rentang tanggal
create or replace function public.cash_report(
  p_community_id uuid,
  p_from         date,
  p_to           date
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

  select coalesce(sum(case when type = 'masuk' then amount else -amount end), 0)
    into v_opening
  from public.cash_transactions
  where community_id = p_community_id and trx_date < p_from;

  select coalesce(sum(amount) filter (where type = 'masuk'), 0),
         coalesce(sum(amount) filter (where type = 'keluar'), 0)
    into v_income, v_expense
  from public.cash_transactions
  where community_id = p_community_id and trx_date between p_from and p_to;

  select coalesce(jsonb_agg(jsonb_build_object('type', type, 'category', category, 'total', total)
                            order by type, total desc), '[]'::jsonb)
    into v_cats
  from (
    select type, category, sum(amount) as total
    from public.cash_transactions
    where community_id = p_community_id and trx_date between p_from and p_to
    group by type, category
  ) t;

  return jsonb_build_object(
    'opening_balance', v_opening,
    'income', v_income,
    'expense', v_expense,
    'closing_balance', v_opening + v_income - v_expense,
    'by_category', v_cats
  );
end;
$$;

-- ---- Super admin -------------------------------------------------------------
create or replace function public.admin_list_communities()
returns table (
  id uuid, name text, type public.community_type, rw_number text, rt_number text,
  kota text, is_active boolean, created_at timestamptz,
  member_count bigint, ketua_name text, balance numeric
)
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  if not public.is_super_admin() then
    raise exception 'Khusus admin';
  end if;
  return query
  select c.id, c.name, c.type, c.rw_number, c.rt_number, c.kota, c.is_active, c.created_at,
         (select count(*) from public.memberships m
           where m.community_id = c.id and m.status = 'active'),
         (select p.full_name from public.memberships m
           join public.profiles p on p.id = m.user_id
           where m.community_id = c.id and m.role = 'ketua' and m.status = 'active'),
         (select coalesce(sum(case when t.type = 'masuk' then t.amount else -t.amount end), 0)
           from public.cash_transactions t where t.community_id = c.id)
  from public.communities c
  order by c.created_at desc;
end;
$$;

create or replace function public.admin_set_community_active(p_community_id uuid, p_active boolean)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if not public.is_super_admin() then
    raise exception 'Khusus admin';
  end if;
  update public.communities set is_active = p_active where id = p_community_id;
end;
$$;

-- =============================================================================
-- ROW LEVEL SECURITY
-- =============================================================================
alter table public.profiles          enable row level security;
alter table public.communities       enable row level security;
alter table public.rt_units          enable row level security;
alter table public.memberships       enable row level security;
alter table public.dues              enable row level security;
alter table public.bills             enable row level security;
alter table public.payments          enable row level security;
alter table public.cash_transactions enable row level security;
alter table public.news              enable row level security;

-- profiles
create policy profiles_select on public.profiles
  for select to authenticated using (public.can_see_profile(id));
create policy profiles_update on public.profiles
  for update to authenticated using (id = auth.uid()) with check (id = auth.uid());

-- communities: anggota (termasuk yang masih pending) bisa melihat komunitasnya
create policy communities_select on public.communities
  for select to authenticated using (
    public.is_super_admin()
    or exists (select 1 from public.memberships m
               where m.community_id = communities.id and m.user_id = auth.uid())
  );
create policy communities_update on public.communities
  for update to authenticated
  using (public.is_ketua(id)) with check (public.is_ketua(id));
create policy communities_delete on public.communities
  for delete to authenticated using (public.is_super_admin());

-- rt_units
create policy rt_units_select on public.rt_units
  for select to authenticated using (public.is_member(community_id));
create policy rt_units_write on public.rt_units
  for all to authenticated
  using (public.is_pengurus(community_id)) with check (public.is_pengurus(community_id));

-- memberships: baca saja; perubahan lewat RPC
create policy memberships_select on public.memberships
  for select to authenticated using (
    user_id = auth.uid()
    or (status = 'active' and public.is_member(community_id))
    or public.is_pengurus(community_id)
  );

-- dues
create policy dues_select on public.dues
  for select to authenticated using (public.is_member(community_id));
create policy dues_write on public.dues
  for all to authenticated
  using (public.is_pengurus(community_id)) with check (public.is_pengurus(community_id));

-- bills: warga hanya melihat tagihannya sendiri
create policy bills_select on public.bills
  for select to authenticated using (
    public.is_pengurus(community_id)
    or membership_id = public.my_membership_id(community_id)
  );
create policy bills_insert on public.bills
  for insert to authenticated with check (public.is_pengurus(community_id));
create policy bills_update on public.bills
  for update to authenticated
  using (public.is_pengurus(community_id)) with check (public.is_pengurus(community_id));
create policy bills_delete on public.bills
  for delete to authenticated using (public.is_pengurus(community_id) and status <> 'lunas');

-- payments
create policy payments_select on public.payments
  for select to authenticated using (
    public.is_pengurus(community_id)
    or membership_id = public.my_membership_id(community_id)
  );
create policy payments_insert on public.payments
  for insert to authenticated with check (
    public.is_pengurus(community_id)
    or membership_id = public.my_membership_id(community_id)
  );
create policy payments_delete on public.payments
  for delete to authenticated using (
    (status = 'menunggu' and membership_id = public.my_membership_id(community_id))
    or (status <> 'diterima' and public.is_pengurus(community_id))
  );

-- cash_transactions: semua anggota bisa melihat (transparansi kas)
create policy cash_select on public.cash_transactions
  for select to authenticated using (public.is_member(community_id));
create policy cash_insert on public.cash_transactions
  for insert to authenticated
  with check (public.is_pengurus(community_id) and payment_id is null);
create policy cash_update on public.cash_transactions
  for update to authenticated
  using (public.is_pengurus(community_id) and payment_id is null)
  with check (public.is_pengurus(community_id) and payment_id is null);
create policy cash_delete on public.cash_transactions
  for delete to authenticated
  using (public.is_pengurus(community_id) and payment_id is null);

-- news
create policy news_select on public.news
  for select to authenticated using (public.is_member(community_id));
create policy news_write on public.news
  for all to authenticated
  using (public.is_pengurus(community_id)) with check (public.is_pengurus(community_id));

-- =============================================================================
-- HAK AKSES TABEL / KOLOM / FUNGSI
-- =============================================================================
revoke all on all tables in schema public from anon;
revoke all on all functions in schema public from public, anon;

-- profiles: is_super_admin tidak boleh diubah oleh user
revoke insert, update, delete on public.profiles from authenticated;
grant select on public.profiles to authenticated;
grant update (full_name, phone, avatar_url) on public.profiles to authenticated;

-- communities: is_active & invite_code hanya lewat RPC
revoke insert, update on public.communities from authenticated;
grant select, delete on public.communities to authenticated;
grant update (name, rw_number, rt_number, kelurahan, kecamatan, kota, provinsi, address, bank_info)
  on public.communities to authenticated;

-- memberships: hanya baca
revoke insert, update, delete on public.memberships from authenticated;
grant select on public.memberships to authenticated;

-- bills: status dihitung otomatis; yang bisa diubah manual hanya nominal & jatuh tempo
revoke update on public.bills from authenticated;
grant select, insert, delete on public.bills to authenticated;
grant update (amount, due_date) on public.bills to authenticated;

-- payments: perubahan status lewat verify_payment
revoke update on public.payments from authenticated;
grant select, insert, delete on public.payments to authenticated;

grant select, insert, update, delete
  on public.rt_units, public.dues, public.cash_transactions, public.news
  to authenticated;

grant execute on all functions in schema public to authenticated;
-- fungsi internal trigger tidak perlu dipanggil langsung
revoke execute on function
  public.handle_new_user(),
  public.payments_before_insert(),
  public.payments_after_change(),
  public.bills_after_amount_change(),
  public.refresh_bill_status(uuid)
from authenticated;
