-- =============================================================================
-- Paket langganan per komunitas (sumber penghasilan developer)
--
--   free    : semua fitur inti + iklan banner; export PDF terkunci
--   premium : tanpa iklan + export PDF laporan kas & rekap tagihan
--
-- Paket hanya bisa diubah oleh super admin (developer), mis. setelah
-- komunitas membayar. Setiap perubahan dicatat di plan_changes.
-- =============================================================================

create type public.community_plan as enum ('free', 'premium');

alter table public.communities
  add column plan            public.community_plan not null default 'free',
  add column plan_expires_at timestamptz;  -- null + premium = tanpa batas waktu

-- Riwayat perubahan paket (untuk pembukuan developer)
create table public.plan_changes (
  id           uuid primary key default gen_random_uuid(),
  community_id uuid not null references public.communities (id) on delete cascade,
  plan         public.community_plan not null,
  expires_at   timestamptz,
  note         text,  -- mis. "Transfer BCA 120.000, 12 bulan"
  changed_by   uuid references public.profiles (id) on delete set null default auth.uid(),
  created_at   timestamptz not null default now()
);
create index plan_changes_community_idx on public.plan_changes (community_id, created_at desc);

alter table public.plan_changes enable row level security;
create policy plan_changes_select on public.plan_changes
  for select to authenticated using (public.is_super_admin() or public.is_ketua(community_id));

create or replace function public.is_premium(p_community_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select coalesce((
    select c.plan = 'premium' and (c.plan_expires_at is null or c.plan_expires_at > now())
    from public.communities c where c.id = p_community_id
  ), false);
$$;

-- Super admin: ubah paket komunitas
create or replace function public.admin_set_plan(
  p_community_id uuid,
  p_plan         public.community_plan,
  p_expires_at   timestamptz default null,
  p_note         text default null
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if not public.is_super_admin() then
    raise exception 'Khusus admin';
  end if;
  if p_plan = 'premium' and p_expires_at is not null and p_expires_at <= now() then
    raise exception 'Tanggal berakhir harus di masa depan';
  end if;

  update public.communities
  set plan = p_plan,
      plan_expires_at = case when p_plan = 'premium' then p_expires_at end
  where id = p_community_id;
  if not found then
    raise exception 'Komunitas tidak ditemukan';
  end if;

  insert into public.plan_changes (community_id, plan, expires_at, note)
  values (p_community_id, p_plan, case when p_plan = 'premium' then p_expires_at end, p_note);

  -- beri tahu ketua komunitas
  perform public.notify(
    array(select m.user_id from public.memberships m
          where m.community_id = p_community_id and m.role = 'ketua' and m.status = 'active'),
    p_community_id,
    case when p_plan = 'premium' then 'Paket Premium aktif ⭐' else 'Paket kembali ke Gratis' end,
    case when p_plan = 'premium'
         then 'Export PDF terbuka dan iklan dihilangkan'
              || coalesce(' hingga ' || to_char(p_expires_at at time zone 'Asia/Jakarta', 'DD-MM-YYYY'), '') || '.'
         else 'Export PDF terkunci dan iklan ditampilkan kembali.' end,
    '/premium');
end;
$$;

-- Daftar komunitas untuk panel admin (ditambah info paket)
drop function public.admin_list_communities();
create or replace function public.admin_list_communities()
returns table (
  id uuid, name text, type public.community_type, rw_number text, rt_number text,
  kota text, is_active boolean, created_at timestamptz,
  member_count bigint, ketua_name text, ketua_phone text, balance numeric,
  plan public.community_plan, plan_expires_at timestamptz, is_premium boolean
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
         k.full_name, k.phone,
         (select coalesce(sum(case when t.type = 'masuk' then t.amount else -t.amount end), 0)
           from public.cash_transactions t where t.community_id = c.id),
         c.plan, c.plan_expires_at, public.is_premium(c.id)
  from public.communities c
  left join lateral (
    select p.full_name, p.phone from public.memberships m
    join public.profiles p on p.id = m.user_id
    where m.community_id = c.id and m.role = 'ketua' and m.status = 'active'
    limit 1
  ) k on true
  order by c.created_at desc;
end;
$$;

-- Hak akses: kolom plan tidak termasuk kolom yang boleh diubah ketua
-- (grant update kolom pada communities sudah dibatasi di migrasi awal).
revoke all on public.plan_changes from anon;
revoke insert, update, delete on public.plan_changes from authenticated;
grant select on public.plan_changes to authenticated;

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
