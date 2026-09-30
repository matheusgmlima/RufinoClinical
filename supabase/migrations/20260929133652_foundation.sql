-- Rufino Clinical — foundation schema
-- Principles:
--   * RLS on every table; deny by default.
--   * Catalog is publicly readable only when active.
--   * Admin = app_metadata.role 'admin' (set only with the service role) AND an MFA (aal2) session.
--   * Orders, payments, stock and webhooks are never written by the browser: only by server code
--     (service role) or security-definer functions added in the checkout phase.

create extension if not exists citext with schema extensions;

-- ---------------------------------------------------------------------------
-- Private helpers (schema is not exposed by the Data API)
-- ---------------------------------------------------------------------------
create schema if not exists private;
revoke all on schema private from public;
grant usage on schema private to anon, authenticated, service_role, supabase_auth_admin;

create or replace function private.is_admin()
returns boolean
language sql
stable
set search_path = ''
as $$
  select coalesce((auth.jwt() -> 'app_metadata' ->> 'role') = 'admin', false)
     and coalesce(auth.jwt() ->> 'aal', 'aal1') = 'aal2';
$$;
revoke all on function private.is_admin() from public;
grant execute on function private.is_admin() to anon, authenticated, service_role;

create or replace function private.set_updated_at()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;
revoke all on function private.set_updated_at() from public;

-- ---------------------------------------------------------------------------
-- Types
-- ---------------------------------------------------------------------------
create type public.order_status as enum (
  'pending_payment', 'paid', 'preparing', 'shipped', 'delivered', 'canceled', 'refunded'
);
create type public.payment_method as enum ('pix', 'credit_card', 'boleto');
create type public.discount_type as enum ('percent', 'fixed');

-- ---------------------------------------------------------------------------
-- Customers
-- ---------------------------------------------------------------------------
create table public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  full_name text check (char_length(full_name) <= 120),
  phone text check (phone ~ '^[0-9]{10,13}$'),
  -- CPF (11) or CNPJ (14), digits only
  document text check (document ~ '^([0-9]{11}|[0-9]{14})$'),
  marketing_opt_in boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.addresses (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  label text check (char_length(label) <= 40),
  recipient_name text not null check (char_length(recipient_name) between 2 and 120),
  zip_code text not null check (zip_code ~ '^[0-9]{8}$'),
  street text not null check (char_length(street) between 2 and 160),
  number text not null check (char_length(number) between 1 and 20),
  complement text check (char_length(complement) <= 80),
  district text not null check (char_length(district) between 2 and 80),
  city text not null check (char_length(city) between 2 and 80),
  state text not null check (state ~ '^[A-Z]{2}$'),
  is_default boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index addresses_user_id_idx on public.addresses (user_id);
create unique index addresses_one_default_per_user on public.addresses (user_id) where is_default;

-- Caps addresses per user so the table cannot be abused as free storage.
create or replace function private.limit_addresses()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if (select count(*) from public.addresses where user_id = new.user_id) >= 10 then
    raise exception 'address limit reached' using errcode = 'check_violation';
  end if;
  return new;
end;
$$;
revoke all on function private.limit_addresses() from public;

-- Creates the profile row when a user signs up.
create or replace function private.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.profiles (id, full_name)
  values (new.id, left(nullif(trim(new.raw_user_meta_data ->> 'full_name'), ''), 120));
  return new;
end;
$$;
revoke all on function private.handle_new_user() from public;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function private.handle_new_user();

-- ---------------------------------------------------------------------------
-- Catalog
-- ---------------------------------------------------------------------------
create table public.categories (
  id uuid primary key default gen_random_uuid(),
  slug text not null unique check (slug ~ '^[a-z0-9]+(-[a-z0-9]+)*$' and char_length(slug) <= 80),
  name text not null check (char_length(name) between 2 and 80),
  description text check (char_length(description) <= 500),
  position integer not null default 0,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.products (
  id uuid primary key default gen_random_uuid(),
  category_id uuid references public.categories (id) on delete set null,
  slug text not null unique check (slug ~ '^[a-z0-9]+(-[a-z0-9]+)*$' and char_length(slug) <= 120),
  name text not null check (char_length(name) between 2 and 120),
  brand text check (char_length(brand) <= 80),
  short_description text check (char_length(short_description) <= 300),
  description text check (char_length(description) <= 10000),
  usage_instructions text check (char_length(usage_instructions) <= 5000),
  indications text check (char_length(indications) <= 5000),
  anvisa_registration text check (char_length(anvisa_registration) <= 40),
  is_active boolean not null default false,
  is_featured boolean not null default false,
  position integer not null default 0,
  seo_title text check (char_length(seo_title) <= 70),
  seo_description text check (char_length(seo_description) <= 160),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index products_category_id_idx on public.products (category_id);

create table public.product_variants (
  id uuid primary key default gen_random_uuid(),
  product_id uuid not null references public.products (id) on delete cascade,
  sku text not null unique check (sku ~ '^[A-Z0-9-]{3,40}$'),
  name text not null check (char_length(name) between 1 and 80),
  options jsonb not null default '{}'::jsonb check (jsonb_typeof(options) = 'object'),
  price_cents integer not null check (price_cents > 0),
  compare_at_price_cents integer check (compare_at_price_cents is null or compare_at_price_cents > price_cents),
  stock_quantity integer not null default 0 check (stock_quantity >= 0),
  -- Shipping dimensions (required by carriers)
  weight_grams integer not null check (weight_grams between 1 and 30000),
  length_cm numeric(5, 1) not null check (length_cm > 0 and length_cm <= 100),
  width_cm numeric(5, 1) not null check (width_cm > 0 and width_cm <= 100),
  height_cm numeric(5, 1) not null check (height_cm > 0 and height_cm <= 100),
  is_active boolean not null default true,
  position integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index product_variants_product_id_idx on public.product_variants (product_id);

create table public.product_images (
  id uuid primary key default gen_random_uuid(),
  product_id uuid not null references public.products (id) on delete cascade,
  variant_id uuid references public.product_variants (id) on delete set null,
  storage_path text not null check (storage_path ~ '^products/[A-Za-z0-9/_.-]{1,200}$'),
  alt text not null check (char_length(alt) between 1 and 200),
  position integer not null default 0,
  created_at timestamptz not null default now()
);
create index product_images_product_id_idx on public.product_images (product_id);
create index product_images_variant_id_idx on public.product_images (variant_id);

-- Single-row store configuration.
create table public.store_settings (
  id boolean primary key default true check (id),
  pix_discount_percent numeric(4, 2) not null default 5 check (pix_discount_percent between 0 and 30),
  max_installments integer not null default 6 check (max_installments between 1 and 12),
  min_installment_cents integer not null default 3000 check (min_installment_cents >= 500),
  free_shipping_threshold_cents integer check (free_shipping_threshold_cents > 0),
  updated_at timestamptz not null default now()
);
insert into public.store_settings default values;

create table public.coupons (
  id uuid primary key default gen_random_uuid(),
  code extensions.citext not null unique check (code ~* '^[A-Z0-9_-]{3,30}$'),
  discount_type public.discount_type not null,
  -- percent: 1-100; fixed: cents
  discount_value integer not null check (discount_value > 0),
  min_subtotal_cents integer not null default 0 check (min_subtotal_cents >= 0),
  starts_at timestamptz,
  ends_at timestamptz,
  max_redemptions integer check (max_redemptions > 0),
  redemptions_count integer not null default 0 check (redemptions_count >= 0),
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (discount_type <> 'percent' or discount_value <= 100),
  check (ends_at is null or starts_at is null or ends_at > starts_at)
);

-- ---------------------------------------------------------------------------
-- Orders & payments
-- ---------------------------------------------------------------------------
create table public.orders (
  id uuid primary key default gen_random_uuid(),
  number bigint generated always as identity (start with 1001) unique,
  -- set null keeps the fiscal record if the customer deletes the account (LGPD)
  user_id uuid references auth.users (id) on delete set null,
  status public.order_status not null default 'pending_payment',
  -- Snapshots at purchase time
  customer_name text not null check (char_length(customer_name) between 2 and 120),
  customer_email text not null check (char_length(customer_email) between 3 and 254),
  customer_phone text check (customer_phone ~ '^[0-9]{10,13}$'),
  customer_document text check (customer_document ~ '^([0-9]{11}|[0-9]{14})$'),
  shipping_address jsonb not null check (jsonb_typeof(shipping_address) = 'object'),
  shipping_service text check (char_length(shipping_service) <= 80),
  shipping_days integer check (shipping_days between 0 and 90),
  shipping_tracking_code text check (char_length(shipping_tracking_code) <= 60),
  subtotal_cents integer not null check (subtotal_cents > 0),
  discount_cents integer not null default 0 check (discount_cents >= 0),
  payment_discount_cents integer not null default 0 check (payment_discount_cents >= 0),
  shipping_cents integer not null default 0 check (shipping_cents >= 0),
  total_cents integer not null check (total_cents > 0),
  payment_method public.payment_method,
  installments integer check (installments between 1 and 12),
  coupon_id uuid references public.coupons (id) on delete set null,
  coupon_code text,
  notes text check (char_length(notes) <= 500),
  expires_at timestamptz,
  paid_at timestamptz,
  shipped_at timestamptz,
  delivered_at timestamptz,
  canceled_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (total_cents = subtotal_cents - discount_cents - payment_discount_cents + shipping_cents)
);
create index orders_user_id_idx on public.orders (user_id);
create index orders_status_idx on public.orders (status);
create index orders_coupon_id_idx on public.orders (coupon_id);

create table public.order_items (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null references public.orders (id) on delete cascade,
  variant_id uuid references public.product_variants (id) on delete set null,
  product_name text not null,
  variant_name text not null,
  sku text not null,
  unit_price_cents integer not null check (unit_price_cents > 0),
  quantity integer not null check (quantity between 1 and 99),
  total_cents integer not null check (total_cents = unit_price_cents * quantity)
);
create index order_items_order_id_idx on public.order_items (order_id);
create index order_items_variant_id_idx on public.order_items (variant_id);

create table public.payments (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null references public.orders (id) on delete restrict,
  provider text not null default 'mercadopago',
  provider_payment_id text not null,
  status text not null,
  status_detail text,
  method public.payment_method,
  installments integer check (installments between 1 and 12),
  amount_cents integer not null check (amount_cents > 0),
  raw jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (provider, provider_payment_id)
);
create index payments_order_id_idx on public.payments (order_id);

-- Every inbound webhook is stored once (idempotency) before being processed.
create table public.webhook_events (
  id bigint generated always as identity primary key,
  provider text not null,
  event_key text not null,
  type text,
  payload jsonb not null,
  received_at timestamptz not null default now(),
  processed_at timestamptz,
  error text,
  unique (provider, event_key)
);

create table public.stock_movements (
  id bigint generated always as identity primary key,
  variant_id uuid not null references public.product_variants (id) on delete cascade,
  delta integer not null check (delta <> 0),
  reason text not null check (reason in ('order_reserved', 'order_released', 'admin_adjustment', 'return')),
  order_id uuid references public.orders (id) on delete set null,
  actor_id uuid,
  created_at timestamptz not null default now()
);
create index stock_movements_variant_id_idx on public.stock_movements (variant_id);
create index stock_movements_order_id_idx on public.stock_movements (order_id);

-- Append-only audit trail (no FK on actor so logs survive account deletion).
create table public.audit_log (
  id bigint generated always as identity primary key,
  actor_id uuid,
  action text not null,
  table_name text not null,
  row_id text,
  old_data jsonb,
  new_data jsonb,
  created_at timestamptz not null default now()
);
create index audit_log_table_row_idx on public.audit_log (table_name, row_id);

create or replace function private.audit_row()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  rec jsonb := to_jsonb(coalesce(new, old));
begin
  insert into public.audit_log (actor_id, action, table_name, row_id, old_data, new_data)
  values (
    auth.uid(),
    tg_op,
    tg_table_name,
    rec ->> 'id',
    case when tg_op in ('UPDATE', 'DELETE') then to_jsonb(old) end,
    case when tg_op in ('INSERT', 'UPDATE') then to_jsonb(new) end
  );
  return coalesce(new, old);
end;
$$;
revoke all on function private.audit_row() from public;

-- ---------------------------------------------------------------------------
-- Triggers
-- ---------------------------------------------------------------------------
create trigger set_updated_at before update on public.profiles for each row execute function private.set_updated_at();
create trigger set_updated_at before update on public.addresses for each row execute function private.set_updated_at();
create trigger set_updated_at before update on public.categories for each row execute function private.set_updated_at();
create trigger set_updated_at before update on public.products for each row execute function private.set_updated_at();
create trigger set_updated_at before update on public.product_variants for each row execute function private.set_updated_at();
create trigger set_updated_at before update on public.store_settings for each row execute function private.set_updated_at();
create trigger set_updated_at before update on public.coupons for each row execute function private.set_updated_at();
create trigger set_updated_at before update on public.orders for each row execute function private.set_updated_at();
create trigger set_updated_at before update on public.payments for each row execute function private.set_updated_at();

create trigger limit_addresses before insert on public.addresses for each row execute function private.limit_addresses();

create trigger audit after insert or update or delete on public.categories for each row execute function private.audit_row();
create trigger audit after insert or update or delete on public.products for each row execute function private.audit_row();
create trigger audit after insert or update or delete on public.product_variants for each row execute function private.audit_row();
create trigger audit after insert or update or delete on public.product_images for each row execute function private.audit_row();
create trigger audit after insert or update or delete on public.store_settings for each row execute function private.audit_row();
create trigger audit after insert or update or delete on public.coupons for each row execute function private.audit_row();
create trigger audit after update or delete on public.orders for each row execute function private.audit_row();

-- ---------------------------------------------------------------------------
-- Privileges: explicit allow-list on top of RLS (defense in depth)
-- ---------------------------------------------------------------------------
revoke all on all tables in schema public from anon, authenticated;
revoke all on all sequences in schema public from anon, authenticated;

grant select on public.categories, public.products, public.product_variants, public.product_images, public.store_settings
  to anon, authenticated;

grant select, update on public.profiles to authenticated;
grant select, insert, update, delete on public.addresses to authenticated;
grant select on public.orders, public.order_items to authenticated;

-- Admin-only operations (RLS restricts them to MFA-verified admins)
grant insert, update, delete on public.categories, public.products, public.product_variants, public.product_images
  to authenticated;
grant update on public.store_settings to authenticated;
grant select, insert, update, delete on public.coupons to authenticated;
grant update on public.orders to authenticated;
grant select on public.payments, public.stock_movements, public.audit_log to authenticated;

-- ---------------------------------------------------------------------------
-- Row Level Security
-- ---------------------------------------------------------------------------
alter table public.profiles enable row level security;
alter table public.addresses enable row level security;
alter table public.categories enable row level security;
alter table public.products enable row level security;
alter table public.product_variants enable row level security;
alter table public.product_images enable row level security;
alter table public.store_settings enable row level security;
alter table public.coupons enable row level security;
alter table public.orders enable row level security;
alter table public.order_items enable row level security;
alter table public.payments enable row level security;
alter table public.webhook_events enable row level security;
alter table public.stock_movements enable row level security;
alter table public.audit_log enable row level security;

-- profiles
create policy "profiles: owner reads" on public.profiles
  for select to authenticated using ((select auth.uid()) = id or (select private.is_admin()));
create policy "profiles: owner updates" on public.profiles
  for update to authenticated using ((select auth.uid()) = id) with check ((select auth.uid()) = id);

-- addresses
create policy "addresses: owner reads" on public.addresses
  for select to authenticated using ((select auth.uid()) = user_id);
create policy "addresses: owner inserts" on public.addresses
  for insert to authenticated with check ((select auth.uid()) = user_id);
create policy "addresses: owner updates" on public.addresses
  for update to authenticated using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);
create policy "addresses: owner deletes" on public.addresses
  for delete to authenticated using ((select auth.uid()) = user_id);

-- categories
create policy "categories: public reads active" on public.categories
  for select to anon, authenticated using (is_active or (select private.is_admin()));
create policy "categories: admin inserts" on public.categories
  for insert to authenticated with check ((select private.is_admin()));
create policy "categories: admin updates" on public.categories
  for update to authenticated using ((select private.is_admin())) with check ((select private.is_admin()));
create policy "categories: admin deletes" on public.categories
  for delete to authenticated using ((select private.is_admin()));

-- products
create policy "products: public reads active" on public.products
  for select to anon, authenticated using (is_active or (select private.is_admin()));
create policy "products: admin inserts" on public.products
  for insert to authenticated with check ((select private.is_admin()));
create policy "products: admin updates" on public.products
  for update to authenticated using ((select private.is_admin())) with check ((select private.is_admin()));
create policy "products: admin deletes" on public.products
  for delete to authenticated using ((select private.is_admin()));

-- product_variants
create policy "variants: public reads active" on public.product_variants
  for select to anon, authenticated using (
    (is_active and exists (select 1 from public.products p where p.id = product_id and p.is_active))
    or (select private.is_admin())
  );
create policy "variants: admin inserts" on public.product_variants
  for insert to authenticated with check ((select private.is_admin()));
create policy "variants: admin updates" on public.product_variants
  for update to authenticated using ((select private.is_admin())) with check ((select private.is_admin()));
create policy "variants: admin deletes" on public.product_variants
  for delete to authenticated using ((select private.is_admin()));

-- product_images
create policy "images: public reads active" on public.product_images
  for select to anon, authenticated using (
    exists (select 1 from public.products p where p.id = product_id and p.is_active)
    or (select private.is_admin())
  );
create policy "images: admin inserts" on public.product_images
  for insert to authenticated with check ((select private.is_admin()));
create policy "images: admin updates" on public.product_images
  for update to authenticated using ((select private.is_admin())) with check ((select private.is_admin()));
create policy "images: admin deletes" on public.product_images
  for delete to authenticated using ((select private.is_admin()));

-- store_settings
create policy "settings: public reads" on public.store_settings
  for select to anon, authenticated using (true);
create policy "settings: admin updates" on public.store_settings
  for update to authenticated using ((select private.is_admin())) with check ((select private.is_admin()));

-- coupons (validated server-side; never listed publicly)
create policy "coupons: admin reads" on public.coupons
  for select to authenticated using ((select private.is_admin()));
create policy "coupons: admin inserts" on public.coupons
  for insert to authenticated with check ((select private.is_admin()));
create policy "coupons: admin updates" on public.coupons
  for update to authenticated using ((select private.is_admin())) with check ((select private.is_admin()));
create policy "coupons: admin deletes" on public.coupons
  for delete to authenticated using ((select private.is_admin()));

-- orders
create policy "orders: owner or admin reads" on public.orders
  for select to authenticated using ((select auth.uid()) = user_id or (select private.is_admin()));
create policy "orders: admin updates" on public.orders
  for update to authenticated using ((select private.is_admin())) with check ((select private.is_admin()));

-- order_items
create policy "order_items: owner or admin reads" on public.order_items
  for select to authenticated using (
    exists (select 1 from public.orders o where o.id = order_id and o.user_id = (select auth.uid()))
    or (select private.is_admin())
  );

-- payments, stock_movements, audit_log: admin read-only
create policy "payments: admin reads" on public.payments
  for select to authenticated using ((select private.is_admin()));
create policy "stock_movements: admin reads" on public.stock_movements
  for select to authenticated using ((select private.is_admin()));
create policy "audit_log: admin reads" on public.audit_log
  for select to authenticated using ((select private.is_admin()));

-- webhook_events: no policies => only the service role can touch it.
