-- Carrier quotes (Melhor Envio). The server asks the carrier API for the cart's packages and stores
-- the answer here (service role only); the pricing functions read it. Without a fresh quote, the
-- regional flat rate still applies, so checkout never depends on the carrier API being up.

create table public.shipping_quotes (
  id uuid primary key default gen_random_uuid(),
  zip text not null check (zip ~ '^\d{8}$'),
  origin_zip text not null check (origin_zip ~ '^\d{8}$'),
  -- Canonical cart: [{variant_id, quantity}] sorted by variant_id (private.cart_key).
  items jsonb not null check (jsonb_typeof(items) = 'array'),
  -- [{id, service, price_cents, min_days, max_days}], cheapest first. Empty: no carrier serves it.
  services jsonb not null check (jsonb_typeof(services) = 'array'),
  created_at timestamptz not null default now(),
  expires_at timestamptz not null
);
create index shipping_quotes_lookup on public.shipping_quotes (zip, expires_at);
alter table public.shipping_quotes enable row level security;
grant select, insert, delete on public.shipping_quotes to service_role;

select cron.schedule('purge-shipping-quotes', '17 4 * * *', 'delete from public.shipping_quotes where expires_at < now()');

-- The carrier service picked at checkout, for buying the label later.
alter table public.orders add column carrier_service_id integer check (carrier_service_id > 0);
grant select (carrier_service_id) on public.orders to authenticated;

-- Same cart, same key, whatever the order of the items (byte order, as the server sorts them).
create or replace function private.cart_key(p_items jsonb)
returns jsonb
language sql
immutable
set search_path = ''
as $$
  select coalesce(jsonb_agg(jsonb_build_object('variant_id', lower(e ->> 'variant_id'), 'quantity', (e ->> 'quantity')::integer)
                            order by lower(e ->> 'variant_id') collate "C"), '[]'::jsonb)
  from jsonb_array_elements(p_items) e;
$$;
revoke all on function private.cart_key(jsonb) from public;

-- Services of the freshest quote for this destination, cart and stock CEP; null when there is none.
create or replace function private.carrier_quote(p_zip text, p_items jsonb)
returns jsonb
language sql
stable
security definer
set search_path = ''
as $$
  select q.services
  from public.shipping_quotes q, public.store_settings s
  where p_items is not null and q.zip = p_zip and q.origin_zip = s.origin_zip
    and q.items = private.cart_key(p_items) and q.expires_at > now()
  order by q.created_at desc
  limit 1;
$$;
revoke all on function private.carrier_quote(text, jsonb) from public;

-- Every shipping option for a destination. Carrier services come from the quote when there is one
-- (the cheapest is free above the free-shipping threshold); otherwise the regional flat rate.
drop function private.shipping_options(text, text, integer);
create function private.shipping_options(p_zip text, p_state text, p_goods_cents integer, p_services jsonb)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  settings public.store_settings;
  rate public.shipping_rates;
  svc jsonb;
  free boolean;
  cheapest boolean := true;
  distance numeric;
  options jsonb := '[]'::jsonb;
begin
  select * into settings from public.store_settings;
  free := settings.free_shipping_threshold_cents is not null and p_goods_cents >= settings.free_shipping_threshold_cents;

  if jsonb_array_length(coalesce(p_services, '[]'::jsonb)) > 0 then
    for svc in select value from jsonb_array_elements(p_services) order by (value ->> 'price_cents')::integer loop
      options := options || jsonb_build_object('method', 'standard', 'service_id', (svc ->> 'id')::integer,
        'service', svc ->> 'service', 'price_cents', case when free and cheapest then 0 else (svc ->> 'price_cents')::integer end,
        'min_days', (svc ->> 'min_days')::integer, 'max_days', (svc ->> 'max_days')::integer);
      cheapest := false;
    end loop;
  else
    select * into rate from public.shipping_rates where region = private.uf_region(p_state);
    if found then
      options := options || jsonb_build_object('method', 'standard', 'price_cents', case when free then 0 else rate.price_cents end,
                                               'min_days', rate.min_days, 'max_days', rate.max_days);
    end if;
  end if;

  if settings.local_delivery_enabled then
    distance := private.cep_distance_km(settings.origin_zip, p_zip);
    if distance is not null and distance <= settings.local_delivery_radius_km then
      options := options || jsonb_build_object('method', 'local',
        'price_cents', case when free then 0 else settings.local_delivery_price_cents end,
        'distance_km', distance, 'cutoff', to_char(settings.local_delivery_cutoff, 'HH24:MI'));
    end if;
  end if;

  if settings.pickup_enabled
     and p_state = (select c.state from public.cep_locations c where c.cep = settings.origin_zip) then
    options := options || jsonb_build_object('method', 'pickup', 'price_cents', 0);
  end if;
  return options;
end;
$$;
revoke all on function private.shipping_options(text, text, integer, jsonb) from public;

-- Product page estimate. With the items, the carrier quote for them is used (if cached).
drop function public.estimate_shipping(text, integer);
create function public.estimate_shipping(p_zip text, p_goods_cents integer default 0, p_items jsonb default null)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  place public.cep_locations;
  services jsonb;
begin
  if p_zip !~ '^\d{8}$' or p_goods_cents not between 0 and 100000000
     or (p_items is not null and (jsonb_typeof(p_items) <> 'array' or jsonb_array_length(p_items) not between 1 and 20)) then
    raise exception 'invalid_input' using errcode = '22023';
  end if;
  select * into place from public.cep_locations where cep = p_zip;
  if not found or place.state is null then
    return jsonb_build_object('city', null, 'state', null, 'options', '[]'::jsonb, 'carrier_quoted', false);
  end if;
  services := private.carrier_quote(p_zip, p_items);
  return jsonb_build_object('city', place.city, 'state', place.state, 'carrier_quoted', services is not null,
                            'options', private.shipping_options(p_zip, place.state, p_goods_cents, services));
end;
$$;
revoke all on function public.estimate_shipping(text, integer, jsonb) from public;
grant execute on function public.estimate_shipping(text, integer, jsonb) to anon, authenticated;

-- Pricing takes the carrier service too (null: the cheapest one).
drop function public.quote_order(jsonb, uuid, public.payment_method, text, public.shipping_method);
drop function public.create_order(jsonb, uuid, public.payment_method, text, public.shipping_method);
drop function private.price_order(uuid, jsonb, uuid, public.payment_method, text, public.shipping_method);

create function private.price_order(
  p_user_id uuid,
  p_items jsonb,
  p_address_id uuid,
  p_payment_method public.payment_method,
  p_coupon_code text,
  p_shipping public.shipping_method,
  p_carrier_service integer
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
  services jsonb;
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
      services := private.carrier_quote(addr.zip_code, p_items);
      options := private.shipping_options(addr.zip_code, addr.state, subtotal - discount, services);
      -- Options come cheapest first, so a missing carrier service means the cheapest one.
      select t.o into chosen from jsonb_array_elements(options) with ordinality as t(o, n)
      where t.o ->> 'method' = p_shipping::text
        and (p_carrier_service is null or (t.o ->> 'service_id')::integer = p_carrier_service)
      order by t.n
      limit 1;
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
    'shipping_choice', chosen,
    'shipping_options', coalesce(options, '[]'::jsonb),
    'carrier_quoted', services is not null,
    'total_cents', total,
    'max_installments', greatest(1, least(settings.max_installments, total / settings.min_installment_cents)),
    'coupon_id', cpn.id,
    'coupon_code', cpn.code::text
  );
end;
$$;
revoke all on function private.price_order(uuid, jsonb, uuid, public.payment_method, text, public.shipping_method, integer) from public;

create function public.quote_order(
  p_items jsonb,
  p_address_id uuid,
  p_payment_method public.payment_method,
  p_coupon_code text default null,
  p_shipping public.shipping_method default 'standard',
  p_carrier_service integer default null
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
  return private.price_order(auth.uid(), p_items, p_address_id, p_payment_method, p_coupon_code, p_shipping, p_carrier_service);
end;
$$;
revoke all on function public.quote_order(jsonb, uuid, public.payment_method, text, public.shipping_method, integer) from public, anon;
grant execute on function public.quote_order(jsonb, uuid, public.payment_method, text, public.shipping_method, integer) to authenticated;

create function public.create_order(
  p_items jsonb,
  p_address_id uuid,
  p_payment_method public.payment_method,
  p_coupon_code text default null,
  p_shipping public.shipping_method default 'standard',
  p_carrier_service integer default null
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  uid uuid := auth.uid();
  quote jsonb;
  chosen jsonb;
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

  quote := private.price_order(uid, p_items, p_address_id, p_payment_method, p_coupon_code, p_shipping, p_carrier_service);
  if jsonb_array_length(quote -> 'problems') > 0 then
    raise exception 'order_has_problems' using detail = (quote -> 'problems')::text;
  end if;
  if (quote ->> 'total_cents')::integer <= 0 then
    raise exception 'invalid_total';
  end if;
  chosen := quote -> 'shipping_choice';

  select u.email into buyer_email from auth.users u where u.id = uid;

  insert into public.orders (
    user_id, customer_name, customer_email, customer_phone, customer_document, shipping_address,
    shipping_method, shipping_service, carrier_service_id, shipping_days, subtotal_cents, discount_cents,
    payment_discount_cents, shipping_cents, total_cents, payment_method, coupon_id, coupon_code, expires_at
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
    left(case p_shipping when 'local' then 'Entrega local (moto)' when 'pickup' then 'Retirada na loja'
              else coalesce(chosen ->> 'service', 'Entrega padrão') end, 80),
    (chosen ->> 'service_id')::integer,
    (chosen ->> 'max_days')::integer,
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
revoke all on function public.create_order(jsonb, uuid, public.payment_method, text, public.shipping_method, integer) from public, anon;
grant execute on function public.create_order(jsonb, uuid, public.payment_method, text, public.shipping_method, integer) to authenticated;
