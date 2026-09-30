-- Checkout: every amount is computed here, from database rows. The browser only chooses items,
-- address, payment method and coupon; it can call these functions directly and still cannot
-- change a price, a discount, the shipping fee or stock.

create extension if not exists pg_cron with schema pg_catalog;

-- ---------------------------------------------------------------------------
-- Shipping rates by region (interim flat table until a carrier API is connected)
-- ---------------------------------------------------------------------------
create table public.shipping_rates (
  region text primary key check (region in ('N', 'NE', 'CO', 'SE', 'S')),
  price_cents integer not null check (price_cents between 0 and 100000),
  min_days integer not null check (min_days between 1 and 60),
  max_days integer not null check (max_days between 1 and 90 and max_days >= min_days),
  updated_at timestamptz not null default now()
);
insert into public.shipping_rates (region, price_cents, min_days, max_days) values
  ('SE', 1990, 3, 7), ('S', 2190, 4, 8), ('CO', 2490, 5, 10), ('NE', 2490, 5, 10), ('N', 2990, 7, 14);

alter table public.shipping_rates enable row level security;
grant select on public.shipping_rates to anon, authenticated;
grant update (price_cents, min_days, max_days) on public.shipping_rates to authenticated;
create policy "shipping_rates: public reads" on public.shipping_rates
  for select to anon, authenticated using (true);
create policy "shipping_rates: admin updates" on public.shipping_rates
  for update to authenticated using ((select private.is_admin())) with check ((select private.is_admin()));
create trigger set_updated_at before update on public.shipping_rates for each row execute function private.set_updated_at();
create trigger audit after update on public.shipping_rates for each row execute function private.audit_row();

create or replace function private.uf_region(uf text)
returns text
language sql
immutable
set search_path = ''
as $$
  select case
    when uf in ('AC', 'AP', 'AM', 'PA', 'RO', 'RR', 'TO') then 'N'
    when uf in ('AL', 'BA', 'CE', 'MA', 'PB', 'PE', 'PI', 'RN', 'SE') then 'NE'
    when uf in ('DF', 'GO', 'MT', 'MS') then 'CO'
    when uf in ('ES', 'MG', 'RJ', 'SP') then 'SE'
    when uf in ('PR', 'RS', 'SC') then 'S'
  end;
$$;
revoke all on function private.uf_region(text) from public;

-- ---------------------------------------------------------------------------
-- Pricing: one implementation for the checkout preview and for order creation
-- ---------------------------------------------------------------------------
create or replace function private.price_order(
  p_user_id uuid,
  p_items jsonb,
  p_address_id uuid,
  p_payment_method public.payment_method,
  p_coupon_code text
)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  settings public.store_settings;
  addr public.addresses;
  cpn public.coupons;
  rate public.shipping_rates;
  item record;
  lines jsonb := '[]'::jsonb;
  problems jsonb := '[]'::jsonb;
  subtotal integer := 0;
  discount integer := 0;
  payment_discount integer := 0;
  shipping integer;
  total integer;
begin
  if jsonb_typeof(p_items) is distinct from 'array' then
    raise exception 'invalid_items' using errcode = '22023';
  end if;
  if jsonb_array_length(p_items) not between 1 and 20
     or (select count(distinct (e ->> 'variant_id')::uuid) from jsonb_array_elements(p_items) e) <> jsonb_array_length(p_items) then
    raise exception 'invalid_items' using errcode = '22023';
  end if;

  select * into settings from public.store_settings;

  for item in
    select i.variant_id, i.quantity, v.name as variant_name, v.sku, v.price_cents, v.stock_quantity,
           coalesce(v.is_active and p.is_active, false) as available, p.name as product_name
    from jsonb_to_recordset(p_items) as i(variant_id uuid, quantity integer)
    left join public.product_variants v on v.id = i.variant_id
    left join public.products p on p.id = v.product_id
  loop
    if item.quantity is null or item.quantity not between 1 and 99 then
      raise exception 'invalid_items' using errcode = '22023';
    elsif not item.available then
      problems := problems || jsonb_build_object('variant_id', item.variant_id, 'problem', 'unavailable');
    elsif item.stock_quantity < item.quantity then
      problems := problems || jsonb_build_object('variant_id', item.variant_id, 'problem', 'insufficient_stock',
                                                 'available', item.stock_quantity);
    else
      subtotal := subtotal + item.price_cents * item.quantity;
      lines := lines || jsonb_build_object(
        'variant_id', item.variant_id, 'product_name', item.product_name, 'variant_name', item.variant_name,
        'sku', item.sku, 'unit_price_cents', item.price_cents, 'quantity', item.quantity,
        'total_cents', item.price_cents * item.quantity);
    end if;
  end loop;

  if nullif(trim(p_coupon_code), '') is not null then
    select * into cpn from public.coupons c
    where lower(c.code::text) = lower(trim(p_coupon_code)) and c.is_active
      and (c.starts_at is null or c.starts_at <= now()) and (c.ends_at is null or c.ends_at > now())
      and (c.max_redemptions is null or c.redemptions_count < c.max_redemptions);
    if not found then
      problems := problems || jsonb_build_object('problem', 'coupon_invalid');
    elsif subtotal < cpn.min_subtotal_cents then
      problems := problems || jsonb_build_object('problem', 'coupon_min_subtotal', 'min_subtotal_cents', cpn.min_subtotal_cents);
      cpn := null;
    else
      discount := case when cpn.discount_type = 'percent' then round(subtotal * cpn.discount_value / 100.0)::integer
                       else least(cpn.discount_value, subtotal) end;
    end if;
  end if;

  if p_payment_method = 'pix' then
    payment_discount := round((subtotal - discount) * settings.pix_discount_percent / 100.0)::integer;
  end if;

  if p_address_id is not null then
    select * into addr from public.addresses where id = p_address_id and user_id = p_user_id;
    if not found then
      problems := problems || jsonb_build_object('problem', 'address_not_found');
    else
      select * into rate from public.shipping_rates where region = private.uf_region(addr.state);
      if not found then
        problems := problems || jsonb_build_object('problem', 'shipping_unavailable');
      end if;
      shipping := case when settings.free_shipping_threshold_cents is not null
                        and subtotal - discount >= settings.free_shipping_threshold_cents then 0
                       else rate.price_cents end;
    end if;
  end if;

  total := subtotal - discount - payment_discount + coalesce(shipping, 0);
  return jsonb_build_object(
    'lines', lines,
    'problems', problems,
    'subtotal_cents', subtotal,
    'discount_cents', discount,
    'payment_discount_cents', payment_discount,
    'shipping_cents', shipping,
    'shipping_min_days', rate.min_days,
    'shipping_max_days', rate.max_days,
    'total_cents', total,
    'max_installments', greatest(1, least(settings.max_installments, total / settings.min_installment_cents)),
    'coupon_id', cpn.id,
    'coupon_code', cpn.code::text
  );
end;
$$;
revoke all on function private.price_order(uuid, jsonb, uuid, public.payment_method, text) from public;

-- Checkout preview for the signed-in customer.
create or replace function public.quote_order(
  p_items jsonb,
  p_address_id uuid,
  p_payment_method public.payment_method,
  p_coupon_code text default null
)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  if auth.uid() is null then
    raise exception 'not_authenticated' using errcode = '42501';
  end if;
  return private.price_order(auth.uid(), p_items, p_address_id, p_payment_method, p_coupon_code);
end;
$$;
revoke all on function public.quote_order(jsonb, uuid, public.payment_method, text) from public, anon;
grant execute on function public.quote_order(jsonb, uuid, public.payment_method, text) to authenticated;

-- ---------------------------------------------------------------------------
-- Order creation: locks stock, re-prices, reserves, snapshots
-- ---------------------------------------------------------------------------
create or replace function public.create_order(
  p_items jsonb,
  p_address_id uuid,
  p_payment_method public.payment_method,
  p_coupon_code text default null
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  uid uuid := auth.uid();
  quote jsonb;
  prof public.profiles;
  addr public.addresses;
  buyer_email text;
  created public.orders;
  line jsonb;
begin
  if uid is null then
    raise exception 'not_authenticated' using errcode = '42501';
  end if;
  if p_payment_method is null then
    raise exception 'payment_method_required';
  end if;

  -- Locking the profile serializes checkouts of the same customer, so the limit below is exact.
  select * into prof from public.profiles where id = uid for update;
  -- Abuse guard: unpaid orders reserve stock, so each customer may hold only a few at a time.
  if (select count(*) from public.orders where user_id = uid and status = 'pending_payment') >= 3 then
    raise exception 'too_many_pending_orders';
  end if;
  if prof.document is null then
    raise exception 'document_required';
  end if;
  select * into addr from public.addresses where id = p_address_id and user_id = uid;
  if not found then
    raise exception 'address_not_found';
  end if;

  -- Serialize concurrent checkouts of the same variants and coupon (no overselling, no extra redemptions).
  perform 1 from public.product_variants
  where id in (select (e ->> 'variant_id')::uuid from jsonb_array_elements(p_items) e)
  order by id
  for update;
  perform 1 from public.coupons where lower(code::text) = lower(trim(p_coupon_code)) for update;

  quote := private.price_order(uid, p_items, p_address_id, p_payment_method, p_coupon_code);
  if jsonb_array_length(quote -> 'problems') > 0 then
    raise exception 'order_has_problems' using detail = (quote -> 'problems')::text;
  end if;
  if (quote ->> 'total_cents')::integer <= 0 then
    raise exception 'invalid_total';
  end if;

  select u.email into buyer_email from auth.users u where u.id = uid;

  insert into public.orders (
    user_id, customer_name, customer_email, customer_phone, customer_document, shipping_address,
    shipping_service, shipping_days, subtotal_cents, discount_cents, payment_discount_cents, shipping_cents,
    total_cents, payment_method, coupon_id, coupon_code, expires_at
  ) values (
    uid,
    left(coalesce(nullif(trim(prof.full_name), ''), addr.recipient_name), 120),
    buyer_email,
    prof.phone,
    prof.document,
    jsonb_build_object('recipient_name', addr.recipient_name, 'zip_code', addr.zip_code, 'street', addr.street,
                       'number', addr.number, 'complement', addr.complement, 'district', addr.district,
                       'city', addr.city, 'state', addr.state),
    'Entrega padrão',
    (quote ->> 'shipping_max_days')::integer,
    (quote ->> 'subtotal_cents')::integer,
    (quote ->> 'discount_cents')::integer,
    (quote ->> 'payment_discount_cents')::integer,
    (quote ->> 'shipping_cents')::integer,
    (quote ->> 'total_cents')::integer,
    p_payment_method,
    (quote ->> 'coupon_id')::uuid,
    quote ->> 'coupon_code',
    -- Payment deadline shown to the customer (Mercado Pago recommends at least 3 days for boleto).
    now() + case when p_payment_method = 'boleto' then interval '3 days' else interval '60 minutes' end
  )
  returning * into created;

  for line in select * from jsonb_array_elements(quote -> 'lines') loop
    insert into public.order_items (order_id, variant_id, product_name, variant_name, sku, unit_price_cents, quantity, total_cents)
    values (created.id, (line ->> 'variant_id')::uuid, line ->> 'product_name', line ->> 'variant_name', line ->> 'sku',
            (line ->> 'unit_price_cents')::integer, (line ->> 'quantity')::integer, (line ->> 'total_cents')::integer);
    update public.product_variants
    set stock_quantity = stock_quantity - (line ->> 'quantity')::integer
    where id = (line ->> 'variant_id')::uuid;
    insert into public.stock_movements (variant_id, delta, reason, order_id, actor_id)
    values ((line ->> 'variant_id')::uuid, -(line ->> 'quantity')::integer, 'order_reserved', created.id, uid);
  end loop;

  if created.coupon_id is not null then
    update public.coupons set redemptions_count = redemptions_count + 1 where id = created.coupon_id;
  end if;

  return jsonb_build_object('order_id', created.id, 'number', created.number, 'total_cents', created.total_cents);
end;
$$;
revoke all on function public.create_order(jsonb, uuid, public.payment_method, text) from public, anon;
grant execute on function public.create_order(jsonb, uuid, public.payment_method, text) to authenticated;

-- ---------------------------------------------------------------------------
-- Stock comes back when an order that never shipped is canceled or refunded
-- ---------------------------------------------------------------------------
create or replace function private.restock_order()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if new.status in ('canceled', 'refunded') and old.status in ('pending_payment', 'paid', 'preparing') then
    -- Same lock order as create_order (by variant id) to avoid deadlocks.
    perform 1 from public.product_variants
    where id in (select variant_id from public.order_items where order_id = new.id)
    order by id
    for update;
    update public.product_variants v
    set stock_quantity = v.stock_quantity + i.quantity
    from public.order_items i
    where i.order_id = new.id and v.id = i.variant_id;

    insert into public.stock_movements (variant_id, delta, reason, order_id, actor_id)
    select i.variant_id, i.quantity, 'order_released', new.id, auth.uid()
    from public.order_items i
    where i.order_id = new.id and i.variant_id is not null;

    if old.status = 'pending_payment' and new.coupon_id is not null then
      update public.coupons set redemptions_count = greatest(redemptions_count - 1, 0) where id = new.coupon_id;
    end if;
  end if;
  return null;
end;
$$;
revoke all on function private.restock_order() from public;

create trigger restock_order
  after update of status on public.orders
  for each row when (old.status is distinct from new.status)
  execute function private.restock_order();

-- Unpaid orders expire after the deadline plus a grace period for late confirmations
-- (a boleto paid on its due date can take a few business days to clear).
create or replace function private.release_expired_orders()
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
  released integer;
begin
  update public.orders set status = 'canceled'
  where status = 'pending_payment'
    and expires_at < now() - case when payment_method = 'boleto' then interval '5 days' else interval '10 minutes' end;
  get diagnostics released = row_count;
  return released;
end;
$$;
revoke all on function private.release_expired_orders() from public;

select cron.schedule('release-expired-orders', '*/5 * * * *', 'select private.release_expired_orders()');

-- The customer can give up on an unpaid order, which returns its stock right away.
create or replace function public.cancel_order(p_order_id uuid)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
begin
  update public.orders set status = 'canceled'
  where id = p_order_id and user_id = auth.uid() and status = 'pending_payment';
  return found;
end;
$$;
revoke all on function public.cancel_order(uuid) from public, anon;
grant execute on function public.cancel_order(uuid) to authenticated;

-- ---------------------------------------------------------------------------
-- Payments: only the server (service role) records gateway results
-- ---------------------------------------------------------------------------
-- The gateway payment that settled the order: repeated or late notifications of any other
-- payment can never mark the order paid or refunded twice.
alter table public.orders add column gateway_payment_id text check (char_length(gateway_payment_id) <= 40);

-- Customers read their own payments (Pix code, boleto link); `raw` only holds a whitelisted subset.
drop policy "payments: admin reads" on public.payments;
create policy "payments: owner or admin reads" on public.payments
  for select to authenticated using (
    exists (select 1 from public.orders o where o.id = order_id and o.user_id = (select auth.uid()))
    or (select private.is_admin())
  );

create or replace function public.record_payment(
  p_order_id uuid,
  p_provider_payment_id text,
  p_status text,
  p_status_detail text,
  p_method public.payment_method,
  p_installments integer,
  p_amount_cents integer,
  p_raw jsonb,
  p_expires_at timestamptz default null
)
returns text
language plpgsql
security definer
set search_path = ''
as $$
declare
  o public.orders;
begin
  select * into o from public.orders where id = p_order_id for update;
  if not found then
    raise exception 'order_not_found';
  end if;

  -- Notifications can arrive out of order: a settled payment never goes back to an open state.
  insert into public.payments (order_id, provider, provider_payment_id, status, status_detail, method, installments, amount_cents, raw)
  values (o.id, 'mercadopago', p_provider_payment_id, p_status, p_status_detail, p_method, p_installments, p_amount_cents, p_raw)
  on conflict (provider, provider_payment_id) do update
    set status = excluded.status, status_detail = excluded.status_detail, raw = excluded.raw
    where public.payments.status in ('pending', 'in_process', 'authorized')
       or excluded.status not in ('pending', 'in_process', 'authorized');

  if p_status = 'approved' then
    if o.gateway_payment_id = p_provider_payment_id then
      return 'already_paid';
    elsif p_amount_cents <> o.total_cents or p_method is distinct from o.payment_method then
      return 'mismatch';          -- never mark paid; flagged for manual review
    elsif o.status = 'pending_payment' then
      update public.orders set status = 'paid', installments = p_installments, gateway_payment_id = p_provider_payment_id
      where id = o.id;
      return 'paid';
    end if;
    return 'needs_refund';        -- the order expired, was canceled or was already paid by another payment
  elsif p_status in ('refunded', 'charged_back') and o.gateway_payment_id = p_provider_payment_id
        and o.status in ('paid', 'preparing', 'shipped', 'delivered') then
    update public.orders set status = 'refunded' where id = o.id;
    return 'refunded';
  elsif p_status = 'pending' and p_expires_at is not null and o.status = 'pending_payment' then
    -- Keep the stock reserved until the Pix/boleto deadline registered at the gateway.
    update public.orders set expires_at = greatest(expires_at, least(p_expires_at, now() + interval '30 days'))
    where id = o.id;
  end if;
  return 'recorded';
end;
$$;
revoke all on function public.record_payment(uuid, text, text, text, public.payment_method, integer, integer, jsonb, timestamptz)
  from public, anon, authenticated;
grant execute on function public.record_payment(uuid, text, text, text, public.payment_method, integer, integer, jsonb, timestamptz)
  to service_role;
