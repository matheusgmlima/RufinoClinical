-- Pickup is offered only to buyers in the stock's state, so nobody far away picks it by mistake.
alter table public.store_settings
  drop constraint store_settings_pickup_needs_address,
  add constraint store_settings_pickup_needs_address
    check (not pickup_enabled or (pickup_address is not null and origin_zip is not null));

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

  if settings.pickup_enabled
     and p_state = (select c.state from public.cep_locations c where c.cep = settings.origin_zip) then
    options := options || jsonb_build_object('method', 'pickup', 'price_cents', 0);
  end if;
  return options;
end;
$$;
revoke all on function private.shipping_options(text, text, integer) from public;
