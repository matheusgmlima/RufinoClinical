-- Shipping options: standard (regional table), same-day local delivery within a radius of the stock
-- (motorcycle courier) and free pickup. The database still prices everything; the only outside input
-- is the CEP location cache, written by the server (service role) from a public CEP API.

create type public.shipping_method as enum ('standard', 'local', 'pickup');

-- CEP -> coordinates cache. No policies: only the service role writes it and the pricing functions
-- (security definer) read it. Coordinates may be missing (the API does not know every CEP).
create table public.cep_locations (
  cep text primary key check (cep ~ '^\d{8}$'),
  city text check (char_length(city) <= 80),
  state text check (state ~ '^[A-Z]{2}$'),
  latitude numeric(9, 6) check (latitude between -34 and 6),
  longitude numeric(9, 6) check (longitude between -75 and -28),
  fetched_at timestamptz not null default now(),
  check ((latitude is null) = (longitude is null))
);
alter table public.cep_locations enable row level security;
grant select, insert, update on public.cep_locations to service_role;

alter table public.store_settings
  add column origin_zip text check (origin_zip ~ '^\d{8}$'),
  add column local_delivery_enabled boolean not null default false,
  add column local_delivery_radius_km numeric(4, 1) not null default 25 check (local_delivery_radius_km between 1 and 60),
  add column local_delivery_price_cents integer not null default 1500 check (local_delivery_price_cents between 0 and 100000),
  add column local_delivery_cutoff time not null default '16:00',
  add column pickup_enabled boolean not null default false,
  add column pickup_address text check (char_length(pickup_address) <= 300),
  add column pickup_hours text check (char_length(pickup_hours) <= 200),
  add constraint store_settings_local_needs_origin check (not local_delivery_enabled or origin_zip is not null),
  add constraint store_settings_pickup_needs_address check (not pickup_enabled or pickup_address is not null);
grant update (origin_zip, local_delivery_enabled, local_delivery_radius_km, local_delivery_price_cents,
  local_delivery_cutoff, pickup_enabled, pickup_address, pickup_hours) on public.store_settings to authenticated;

alter table public.orders add column shipping_method public.shipping_method not null default 'standard';
grant select (shipping_method) on public.orders to authenticated;

-- Straight-line distance in km between two CEPs, null when either location is unknown.
create or replace function private.cep_distance_km(p_from text, p_to text)
returns numeric
language sql
stable
security definer
set search_path = ''
as $$
  select round((6371 * 2 * asin(sqrt(
    power(sin(radians(b.latitude - a.latitude) / 2), 2)
    + cos(radians(a.latitude)) * cos(radians(b.latitude)) * power(sin(radians(b.longitude - a.longitude) / 2), 2)
  )))::numeric, 1)
  from public.cep_locations a, public.cep_locations b
  where a.cep = p_from and b.cep = p_to and a.latitude is not null and b.latitude is not null;
$$;
revoke all on function private.cep_distance_km(text, text) from public;

-- Every shipping option for a destination, with its price after the free-shipping rule.
create or replace function private.shipping_options(p_zip text, p_state text, p_goods_cents integer)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  settings public.store_settings;
  rate public.shipping_rates;
  free boolean;
  distance numeric;
  options jsonb := '[]'::jsonb;
begin
  select * into settings from public.store_settings;
  free := settings.free_shipping_threshold_cents is not null and p_goods_cents >= settings.free_shipping_threshold_cents;

  select * into rate from public.shipping_rates where region = private.uf_region(p_state);
  if found then
    options := options || jsonb_build_object('method', 'standard', 'price_cents', case when free then 0 else rate.price_cents end,
                                             'min_days', rate.min_days, 'max_days', rate.max_days);
  end if;

  if settings.local_delivery_enabled then
    distance := private.cep_distance_km(settings.origin_zip, p_zip);
    if distance is not null and distance <= settings.local_delivery_radius_km then
      options := options || jsonb_build_object('method', 'local',
        'price_cents', case when free then 0 else settings.local_delivery_price_cents end,
        'distance_km', distance, 'cutoff', to_char(settings.local_delivery_cutoff, 'HH24:MI'));
    end if;
  end if;

  if settings.pickup_enabled then
    options := options || jsonb_build_object('method', 'pickup', 'price_cents', 0);
  end if;
  return options;
end;
$$;
revoke all on function private.shipping_options(text, text, integer) from public;

-- Product page estimate by CEP (no address, no cart). The server looks the CEP up first so its city,
-- state and location are cached; an unknown CEP returns no options.
create or replace function public.estimate_shipping(p_zip text, p_goods_cents integer default 0)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  place public.cep_locations;
begin
  if p_zip !~ '^\d{8}$' or p_goods_cents not between 0 and 100000000 then
    raise exception 'invalid_input' using errcode = '22023';
  end if;
  select * into place from public.cep_locations where cep = p_zip;
  if not found or place.state is null then
    return jsonb_build_object('city', null, 'state', null, 'options', '[]'::jsonb);
  end if;
  return jsonb_build_object('city', place.city, 'state', place.state,
                            'options', private.shipping_options(p_zip, place.state, p_goods_cents));
end;
$$;
revoke all on function public.estimate_shipping(text, integer) from public;
grant execute on function public.estimate_shipping(text, integer) to anon, authenticated;

-- Pricing now takes the chosen shipping method.
drop function public.quote_order(jsonb, uuid, public.payment_method, text);
drop function public.create_order(jsonb, uuid, public.payment_method, text);
drop function private.price_order(uuid, jsonb, uuid, public.payment_method, text);

create function private.price_order(
  p_user_id uuid,
  p_items jsonb,
  p_address_id uuid,
  p_payment_method public.payment_method,
  p_coupon_code text,
  p_shipping public.shipping_method
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
  item record;
  lines jsonb := '[]'::jsonb;
  problems jsonb := '[]'::jsonb;
  options jsonb;
  chosen jsonb;
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
      options := private.shipping_options(addr.zip_code, addr.state, subtotal - discount);
      select o into chosen from jsonb_array_elements(options) o where o ->> 'method' = p_shipping::text;
      if chosen is null then
        problems := problems || jsonb_build_object('problem', 'shipping_unavailable', 'method', p_shipping);
      else
        shipping := (chosen ->> 'price_cents')::integer;
      end if;
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
    'shipping_method', p_shipping,
    'shipping_options', coalesce(options, '[]'::jsonb),
    'shipping_min_days', (chosen ->> 'min_days')::integer,
    'shipping_max_days', (chosen ->> 'max_days')::integer,
    'total_cents', total,
    'max_installments', greatest(1, least(settings.max_installments, total / settings.min_installment_cents)),
    'coupon_id', cpn.id,
    'coupon_code', cpn.code::text
  );
end;
$$;
revoke all on function private.price_order(uuid, jsonb, uuid, public.payment_method, text, public.shipping_method) from public;

-- Checkout preview for the signed-in customer.
create function public.quote_order(
  p_items jsonb,
  p_address_id uuid,
  p_payment_method public.payment_method,
  p_coupon_code text default null,
  p_shipping public.shipping_method default 'standard'
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
  return private.price_order(auth.uid(), p_items, p_address_id, p_payment_method, p_coupon_code, p_shipping);
end;
$$;
revoke all on function public.quote_order(jsonb, uuid, public.payment_method, text, public.shipping_method) from public, anon;
grant execute on function public.quote_order(jsonb, uuid, public.payment_method, text, public.shipping_method) to authenticated;

-- Order creation: locks stock, re-prices, reserves, snapshots.
create function public.create_order(
  p_items jsonb,
  p_address_id uuid,
  p_payment_method public.payment_method,
  p_coupon_code text default null,
  p_shipping public.shipping_method default 'standard'
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
  if p_payment_method is null or p_shipping is null then
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

  quote := private.price_order(uid, p_items, p_address_id, p_payment_method, p_coupon_code, p_shipping);
  if jsonb_array_length(quote -> 'problems') > 0 then
    raise exception 'order_has_problems' using detail = (quote -> 'problems')::text;
  end if;
  if (quote ->> 'total_cents')::integer <= 0 then
    raise exception 'invalid_total';
  end if;

  select u.email into buyer_email from auth.users u where u.id = uid;

  insert into public.orders (
    user_id, customer_name, customer_email, customer_phone, customer_document, shipping_address,
    shipping_method, shipping_service, shipping_days, subtotal_cents, discount_cents, payment_discount_cents,
    shipping_cents, total_cents, payment_method, coupon_id, coupon_code, expires_at
  ) values (
    uid,
    left(coalesce(nullif(trim(prof.full_name), ''), addr.recipient_name), 120),
    buyer_email,
    prof.phone,
    prof.document,
    jsonb_build_object('recipient_name', addr.recipient_name, 'zip_code', addr.zip_code, 'street', addr.street,
                       'number', addr.number, 'complement', addr.complement, 'district', addr.district,
                       'city', addr.city, 'state', addr.state),
    p_shipping,
    case p_shipping when 'local' then 'Entrega local (moto)' when 'pickup' then 'Retirada na loja' else 'Entrega padrão' end,
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
revoke all on function public.create_order(jsonb, uuid, public.payment_method, text, public.shipping_method) from public, anon;
grant execute on function public.create_order(jsonb, uuid, public.payment_method, text, public.shipping_method) to authenticated;

-- Local deliveries and pickups have no carrier tracking code.
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

  if new.status = 'shipped' and new.shipping_method = 'standard'
     and coalesce(trim(new.shipping_tracking_code), '') = '' then
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
