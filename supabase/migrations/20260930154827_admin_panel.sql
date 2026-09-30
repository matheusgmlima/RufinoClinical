-- Admin panel support (Phase 4).

-- 1. Lets the admin area choose between "not found" and the MFA screen before the session reaches
--    aal2. It only answers about the caller; is_admin() still demands aal2 for every read and write.
create or replace function public.admin_status()
returns text
language sql
stable
security definer
set search_path = ''
as $$
  select case
    when not exists (select 1 from private.admin_users a where a.user_id = auth.uid()) then 'none'
    when coalesce(auth.jwt() ->> 'aal', 'aal1') <> 'aal2' then 'mfa_required'
    else 'ok'
  end;
$$;
revoke all on function public.admin_status() from public;
grant execute on function public.admin_status() to authenticated;

-- 2. Stock only changes through adjust_stock(), which writes the ledger in the same transaction.
--    Orders keep using their own definer functions (create_order, restock_order).
revoke insert, update on public.product_variants from authenticated;
grant insert (product_id, sku, name, options, price_cents, compare_at_price_cents, weight_grams, length_cm,
  width_cm, height_cm, is_active, position) on public.product_variants to authenticated;
grant update (sku, name, options, price_cents, compare_at_price_cents, weight_grams, length_cm, width_cm,
  height_cm, is_active, position) on public.product_variants to authenticated;

create or replace function public.adjust_stock(p_variant_id uuid, p_delta integer, p_reason text default 'admin_adjustment')
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
  new_stock integer;
begin
  if not private.is_admin() then
    raise exception 'not allowed' using errcode = 'insufficient_privilege';
  end if;
  if p_delta is null or p_delta = 0 or p_delta not between -100000 and 100000
     or p_reason not in ('admin_adjustment', 'return') then
    raise exception 'invalid_adjustment' using errcode = 'check_violation';
  end if;

  -- The row lock serializes with checkout; the check constraint rejects stock below zero.
  update public.product_variants set stock_quantity = stock_quantity + p_delta
  where id = p_variant_id
  returning stock_quantity into new_stock;
  if not found then
    raise exception 'variant_not_found' using errcode = 'no_data_found';
  end if;

  insert into public.stock_movements (variant_id, delta, reason, actor_id)
  values (p_variant_id, p_delta, p_reason, auth.uid());
  return new_stock;
end;
$$;
revoke all on function public.adjust_stock(uuid, integer, text) from public;
grant execute on function public.adjust_stock(uuid, integer, text) to authenticated;

-- 3. Coupon usage is counted by create_order only.
revoke insert, update on public.coupons from authenticated;
grant insert (code, discount_type, discount_value, min_subtotal_cents, starts_at, ends_at, max_redemptions, is_active)
  on public.coupons to authenticated;
grant update (code, discount_type, discount_value, min_subtotal_cents, starts_at, ends_at, max_redemptions, is_active)
  on public.coupons to authenticated;
