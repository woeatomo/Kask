-- =============================================================================
-- Login dengan nomor WhatsApp (OTP via WhatsApp)
--
-- Nomor HP di auth.users (identitas login) menjadi sumber kebenaran untuk
-- profiles.phone, sehingga pengurus selalu melihat nomor WA yang terverifikasi.
-- auth.users.phone disimpan tanpa "+", mis. 6281234567890.
-- =============================================================================

create or replace function public.auth_phone_to_e164(p text)
returns text
language sql
immutable
set search_path = ''
as $$
  select case when nullif(p, '') is null then null else '+' || ltrim(p, '+') end;
$$;

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
    coalesce(public.auth_phone_to_e164(new.phone), new.raw_user_meta_data ->> 'phone')
  )
  on conflict (id) do nothing;
  return new;
end;
$$;

-- Nomor login berubah -> profil ikut berubah
create or replace function public.handle_user_phone_change()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if new.phone is distinct from old.phone and nullif(new.phone, '') is not null then
    update public.profiles set phone = public.auth_phone_to_e164(new.phone) where id = new.id;
  end if;
  return new;
end;
$$;

create trigger on_auth_user_phone_changed
  after update of phone on auth.users
  for each row execute function public.handle_user_phone_change();

-- Sinkronkan data lama
update public.profiles p
set phone = public.auth_phone_to_e164(u.phone)
from auth.users u
where u.id = p.id and nullif(u.phone, '') is not null;

-- Nomor HP di profil tidak lagi bisa diubah manual (mengikuti nomor login)
revoke update on public.profiles from authenticated;
grant update (full_name, avatar_url) on public.profiles to authenticated;

revoke all on all functions in schema public from public, anon;
grant execute on all functions in schema public to authenticated;
revoke execute on function
  public.handle_new_user(),
  public.handle_user_phone_change(),
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
