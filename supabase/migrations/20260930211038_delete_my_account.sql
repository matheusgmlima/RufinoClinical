-- LGPD (art. 18): customers delete their own account. Profile, addresses, sessions and MFA go with
-- the auth user (cascade). Orders stay for legal retention (tax and consumer law) as snapshots, with
-- user_id set null. Blocked while an order is open, and for admins (their access is revoked by SQL).
create or replace function public.delete_my_account()
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  uid uuid := auth.uid();
begin
  if uid is null then
    raise exception 'not_authenticated' using errcode = '42501';
  end if;
  if exists (select 1 from private.admin_users where user_id = uid) then
    raise exception 'admin_account' using errcode = '42501';
  end if;
  if exists (
    select 1 from public.orders
    where user_id = uid and status in ('pending_payment', 'paid', 'preparing', 'shipped')
  ) then
    raise exception 'orders_in_progress' using errcode = 'P0001';
  end if;
  delete from auth.users where id = uid;
end;
$$;

revoke all on function public.delete_my_account() from public, anon;
grant execute on function public.delete_my_account() to authenticated;
