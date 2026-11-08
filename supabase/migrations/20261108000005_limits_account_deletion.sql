-- =============================================================================
-- 1) Batas anggota aktif untuk paket Gratis (Premium: tanpa batas)
-- 2) Pengaturan aplikasi yang bisa diubah developer (app_settings)
-- 3) Hapus akun oleh pengguna sendiri (wajib App Store / Google Play)
-- =============================================================================

-- -----------------------------------------------------------------------------
-- PENGATURAN APLIKASI
-- -----------------------------------------------------------------------------
create table public.app_settings (
  key        text primary key,
  value      jsonb not null,
  updated_at timestamptz not null default now()
);

insert into public.app_settings (key, value) values ('free_member_limit', '50');

alter table public.app_settings enable row level security;
create policy app_settings_select on public.app_settings
  for select to authenticated using (true);

create or replace function public.free_member_limit()
returns integer
language sql
stable
security definer
set search_path = ''
as $$
  select coalesce((select (value #>> '{}')::int from public.app_settings where key = 'free_member_limit'), 50);
$$;

create or replace function public.admin_set_setting(p_key text, p_value jsonb)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if not public.is_super_admin() then
    raise exception 'Khusus admin';
  end if;
  if p_key = 'free_member_limit'
     and (jsonb_typeof(p_value) <> 'number' or (p_value #>> '{}')::numeric < 1) then
    raise exception 'Batas anggota harus angka >= 1';
  end if;
  insert into public.app_settings (key, value, updated_at)
  values (p_key, p_value, now())
  on conflict (key) do update set value = excluded.value, updated_at = now();
end;
$$;

-- Pemakaian kuota komunitas (untuk ditampilkan di aplikasi)
create or replace function public.community_usage(p_community_id uuid)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_active  integer;
  v_premium boolean;
begin
  if not public.is_member(p_community_id) then
    raise exception 'Tidak diizinkan';
  end if;
  select count(*) into v_active from public.memberships
  where community_id = p_community_id and status = 'active';
  v_premium := public.is_premium(p_community_id);
  return jsonb_build_object(
    'active_members', v_active,
    'member_limit', case when v_premium then null else public.free_member_limit() end,
    'is_premium', v_premium
  );
end;
$$;

-- Persetujuan anggota memperhatikan kuota paket Gratis.
-- Anggota yang sudah ada tidak dikeluarkan bila komunitas turun ke Gratis;
-- hanya penambahan anggota baru yang ditahan.
create or replace function public.approve_member(p_membership_id uuid, p_approve boolean)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_m     public.memberships;
  v_limit integer;
begin
  select * into v_m from public.memberships where id = p_membership_id;
  if not found or not public.can_manage_rt(v_m.community_id, v_m.rt_unit_id) then
    raise exception 'Tidak diizinkan';
  end if;
  if v_m.status <> 'pending' then
    raise exception 'Permintaan sudah diproses';
  end if;

  if p_approve and not public.is_premium(v_m.community_id) then
    v_limit := public.free_member_limit();
    -- kunci baris komunitas agar dua persetujuan paralel tidak melewati batas
    perform 1 from public.communities where id = v_m.community_id for update;
    if (select count(*) from public.memberships
        where community_id = v_m.community_id and status = 'active') >= v_limit then
      raise exception 'Batas % anggota paket Gratis tercapai. Upgrade ke Premium untuk anggota tanpa batas.', v_limit
        using errcode = 'P0001', hint = 'member_limit';
    end if;
  end if;

  update public.memberships
  set status = case when p_approve then 'active'::public.member_status
                    else 'rejected'::public.member_status end,
      approved_by = auth.uid(),
      approved_at = now()
  where id = p_membership_id;
end;
$$;

-- -----------------------------------------------------------------------------
-- HAPUS AKUN
--
-- Data keuangan komunitas (tagihan, pembayaran, kas) adalah catatan milik
-- komunitas dan harus tetap utuh, jadi akun TIDAK dihapus berantai:
--   * login (auth.users) dihapus
--   * profil dianonimkan ("Akun dihapus"), nomor HP & alamat dihapus
--   * keanggotaan dinonaktifkan, token push & notifikasi dihapus
--   * komunitas yang hanya beranggotakan dirinya sendiri (sebagai ketua) dihapus
-- -----------------------------------------------------------------------------

-- Profil tidak lagi ikut terhapus berantai saat user auth dihapus
alter table public.profiles drop constraint profiles_id_fkey;

create or replace function public.delete_my_account()
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid uuid := auth.uid();
  v_c   record;
begin
  if v_uid is null then
    raise exception 'Harus login';
  end if;

  for v_c in
    select c.id, c.name,
           (select count(*) from public.memberships o
             where o.community_id = c.id and o.status = 'active' and o.user_id <> v_uid) as others
    from public.memberships m
    join public.communities c on c.id = m.community_id
    where m.user_id = v_uid and m.role = 'ketua' and m.status = 'active'
  loop
    if v_c.others > 0 then
      raise exception 'Anda masih menjadi ketua di "%". Serahkan jabatan ketua terlebih dahulu.', v_c.name;
    end if;
    delete from public.communities where id = v_c.id;
  end loop;

  update public.memberships
  set status = 'inactive', role = 'warga', position = null,
      managed_rt_unit_id = null, address = null
  where user_id = v_uid;

  update public.profiles
  set full_name = 'Akun dihapus', phone = null, avatar_url = null, is_super_admin = false
  where id = v_uid;

  delete from public.push_tokens where user_id = v_uid;
  delete from public.notifications where user_id = v_uid;
  delete from auth.users where id = v_uid;
end;
$$;

-- -----------------------------------------------------------------------------
-- HAK AKSES
-- -----------------------------------------------------------------------------
revoke all on public.app_settings from anon;
revoke insert, update, delete on public.app_settings from authenticated;
grant select on public.app_settings to authenticated;

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
