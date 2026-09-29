-- Security hardening after the Phase 1 review.

-- ---------------------------------------------------------------------------
-- 1. Deny by default for FUTURE objects.
--    Supabase's default ACL grants ALL on every new table/function/sequence to anon and
--    authenticated. A future migration that forgets RLS would expose data. From now on, new
--    objects start with no access and each migration must grant explicitly.
-- ---------------------------------------------------------------------------
alter default privileges for role postgres in schema public revoke all on tables from anon, authenticated;
alter default privileges for role postgres in schema public revoke all on sequences from anon, authenticated;
alter default privileges for role postgres in schema public revoke execute on functions from public, anon, authenticated;

-- ---------------------------------------------------------------------------
-- 2. Admins come from a server-side allow-list, not only from the JWT.
--    Removing a row revokes access immediately (a JWT claim would stay valid until it expires).
--    MFA (aal2) is still required.
-- ---------------------------------------------------------------------------
create table private.admin_users (
  user_id uuid primary key references auth.users (id) on delete cascade,
  note text,
  created_at timestamptz not null default now()
);
alter table private.admin_users enable row level security;
revoke all on private.admin_users from public, anon, authenticated;

create or replace function private.is_admin()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select coalesce(auth.jwt() ->> 'aal', 'aal1') = 'aal2'
     and exists (select 1 from private.admin_users a where a.user_id = auth.uid());
$$;

-- ---------------------------------------------------------------------------
-- 3. Column-level write grants: users and admins can only change the fields they own.
-- ---------------------------------------------------------------------------
revoke update on public.profiles from authenticated;
grant update (full_name, phone, document, marketing_opt_in) on public.profiles to authenticated;

revoke insert, update on public.addresses from authenticated;
grant insert (label, recipient_name, zip_code, street, number, complement, district, city, state, is_default)
  on public.addresses to authenticated;
grant update (label, recipient_name, zip_code, street, number, complement, district, city, state, is_default)
  on public.addresses to authenticated;

-- Admins manage fulfilment only. Amounts, customer data and payment fields are immutable from a session.
revoke update on public.orders from authenticated;
grant update (status, shipping_tracking_code, notes) on public.orders to authenticated;

-- ---------------------------------------------------------------------------
-- 4. Order status state machine (applies to everyone, including server code).
--    Payment outcomes (paid, refunded, canceling a paid order) can only be set by trusted
--    server code reacting to the payment gateway, never by a logged-in session.
-- ---------------------------------------------------------------------------
create or replace function private.enforce_order_transition()
returns trigger
language plpgsql
set search_path = ''
as $$
declare
  allowed boolean;
begin
  if new.status = old.status then
    return new;
  end if;

  allowed := case old.status
    when 'pending_payment' then new.status in ('paid', 'canceled')
    when 'paid' then new.status in ('preparing', 'canceled', 'refunded')
    when 'preparing' then new.status in ('shipped', 'canceled', 'refunded')
    when 'shipped' then new.status in ('delivered', 'refunded')
    when 'delivered' then new.status in ('refunded')
    else false
  end;
  if not allowed then
    raise exception 'invalid order status transition: % -> %', old.status, new.status
      using errcode = 'check_violation';
  end if;

  if current_user in ('anon', 'authenticated')
     and (new.status in ('paid', 'refunded') or (new.status = 'canceled' and old.status <> 'pending_payment')) then
    raise exception 'order status % must come from the payment integration', new.status
      using errcode = 'insufficient_privilege';
  end if;

  if new.status = 'shipped' and coalesce(trim(new.shipping_tracking_code), '') = '' then
    raise exception 'tracking code is required to mark an order as shipped'
      using errcode = 'check_violation';
  end if;

  case new.status
    when 'paid' then new.paid_at := coalesce(new.paid_at, now());
    when 'shipped' then new.shipped_at := coalesce(new.shipped_at, now());
    when 'delivered' then new.delivered_at := coalesce(new.delivered_at, now());
    when 'canceled' then new.canceled_at := coalesce(new.canceled_at, now());
    else null;
  end case;

  return new;
end;
$$;
revoke all on function private.enforce_order_transition() from public;

create trigger enforce_order_transition
  before update of status on public.orders
  for each row execute function private.enforce_order_transition();

-- ---------------------------------------------------------------------------
-- 5. Append-only ledgers: audit log and stock movements cannot be edited or erased,
--    not even with the service key.
-- ---------------------------------------------------------------------------
create or replace function private.deny_mutation()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  raise exception '% is append-only', tg_table_name using errcode = 'insufficient_privilege';
end;
$$;
revoke all on function private.deny_mutation() from public;

create trigger append_only before update or delete on public.audit_log
  for each row execute function private.deny_mutation();
create trigger append_only_truncate before truncate on public.audit_log
  for each statement execute function private.deny_mutation();
create trigger append_only before update or delete on public.stock_movements
  for each row execute function private.deny_mutation();
create trigger append_only_truncate before truncate on public.stock_movements
  for each statement execute function private.deny_mutation();

-- Stock history must survive: variants/orders with movements cannot be deleted (deactivate instead).
alter table public.stock_movements drop constraint stock_movements_variant_id_fkey;
alter table public.stock_movements add constraint stock_movements_variant_id_fkey
  foreign key (variant_id) references public.product_variants (id) on delete restrict;
alter table public.stock_movements drop constraint stock_movements_order_id_fkey;
alter table public.stock_movements add constraint stock_movements_order_id_fkey
  foreign key (order_id) references public.orders (id) on delete restrict;

-- ---------------------------------------------------------------------------
-- 6. Storage: uploads must use a safe object name under products/.
-- ---------------------------------------------------------------------------
drop policy "product-images: admin uploads" on storage.objects;
drop policy "product-images: admin updates" on storage.objects;

create policy "product-images: admin uploads" on storage.objects
  for insert to authenticated
  with check (
    bucket_id = 'product-images'
    and name ~ '^products/[A-Za-z0-9_-]+(/[A-Za-z0-9_-]+)*\.(jpg|jpeg|png|webp|avif)$'
    and (select private.is_admin())
  );

create policy "product-images: admin updates" on storage.objects
  for update to authenticated
  using (bucket_id = 'product-images' and (select private.is_admin()))
  with check (
    bucket_id = 'product-images'
    and name ~ '^products/[A-Za-z0-9_-]+(/[A-Za-z0-9_-]+)*\.(jpg|jpeg|png|webp|avif)$'
    and (select private.is_admin())
  );
