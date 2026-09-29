-- Security smoke test. Runs inside a transaction and ROLLS BACK, so it leaves no data behind.
-- Run in the Supabase SQL editor (or MCP execute_sql) after any schema or policy change.
-- Every row in the result has an `expect` column; `ok` must be true for all rows.
begin;

-- Fixtures -------------------------------------------------------------------
insert into auth.users (id, instance_id, aud, role, email, raw_app_meta_data, raw_user_meta_data, created_at, updated_at) values
  ('11111111-1111-1111-1111-111111111111', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'cliente@teste.local', '{}', '{"full_name":"Cliente Teste"}', now(), now()),
  ('33333333-3333-3333-3333-333333333333', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'outro@teste.local', '{}', '{}', now(), now()),
  ('22222222-2222-2222-2222-222222222222', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'admin@teste.local', '{}', '{}', now(), now());
insert into private.admin_users (user_id, note) values ('22222222-2222-2222-2222-222222222222', 'smoke test');

insert into public.categories (id, slug, name) values ('00000000-0000-0000-0000-00000000c001', 'teste', 'Teste');
insert into public.products (id, slug, name, is_active, category_id) values
  ('00000000-0000-0000-0000-00000000a001', 'ativo', 'Produto ativo', true, '00000000-0000-0000-0000-00000000c001'),
  ('00000000-0000-0000-0000-00000000a002', 'rascunho', 'Produto rascunho', false, null);
insert into public.product_variants (id, product_id, sku, name, price_cents, stock_quantity, weight_grams, length_cm, width_cm, height_cm) values
  ('00000000-0000-0000-0000-00000000b001', '00000000-0000-0000-0000-00000000a001', 'TST-1', 'Único', 1000, 5, 100, 10, 10, 5),
  ('00000000-0000-0000-0000-00000000b002', '00000000-0000-0000-0000-00000000a002', 'TST-2', 'Único', 1000, 5, 100, 10, 10, 5);
insert into public.coupons (code, discount_type, discount_value) values ('SEGREDO10', 'percent', 10);
insert into public.orders (id, user_id, customer_name, customer_email, shipping_address, subtotal_cents, total_cents) values
  ('00000000-0000-0000-0000-0000000000d1', '11111111-1111-1111-1111-111111111111', 'Cliente Teste', 'cliente@teste.local', '{}', 1000, 1000),
  ('00000000-0000-0000-0000-0000000000d2', '11111111-1111-1111-1111-111111111111', 'Cliente Teste', 'cliente@teste.local', '{}', 1000, 1000);
insert into public.stock_movements (variant_id, delta, reason) values ('00000000-0000-0000-0000-00000000b001', -1, 'admin_adjustment');

create temp table results (n serial, test text, expect text, outcome text);
grant all on results to anon, authenticated, service_role;
grant all on sequence results_n_seq to anon, authenticated, service_role;

-- try(label, expected 'allowed'|'blocked'|'rows=N', statement)
create or replace function pg_temp.try(label text, expect text, stmt text) returns void language plpgsql as $$
declare c bigint;
begin
  execute stmt;
  get diagnostics c = row_count;
  insert into results(test, expect, outcome) values (label, expect, 'allowed rows=' || c);
exception when others then
  insert into results(test, expect, outcome) values (label, expect, 'blocked: ' || sqlerrm);
end $$;
grant execute on function pg_temp.try(text, text, text) to anon, authenticated, service_role;

create or replace function pg_temp.val(label text, expect text, q text) returns void language plpgsql as $$
declare v text;
begin
  execute q into v;
  insert into results(test, expect, outcome) values (label, expect, coalesce(v, 'null'));
end $$;
grant execute on function pg_temp.val(text, text, text) to anon, authenticated, service_role;

-- Signup trigger ----------------------------------------------------------------
select pg_temp.val('signup creates profile with name', 'Cliente Teste',
  $q$select full_name from public.profiles where id = '11111111-1111-1111-1111-111111111111'$q$);

-- Anonymous visitor ---------------------------------------------------------------
set local role anon;
set local request.jwt.claims = '{"role":"anon"}';
select pg_temp.val('anon: visible products', 'ativo', 'select string_agg(slug, '','') from public.products');
select pg_temp.val('anon: visible variants', '1', 'select count(*)::text from public.product_variants');
select pg_temp.try('anon: read coupons', 'blocked', 'select * from public.coupons');
select pg_temp.try('anon: read orders', 'blocked', 'select * from public.orders');
select pg_temp.try('anon: read profiles', 'blocked', 'select * from public.profiles');
select pg_temp.try('anon: read webhooks', 'blocked', 'select * from public.webhook_events');
select pg_temp.try('anon: insert product', 'blocked', $q$insert into public.products (slug, name) values ('hack', 'Hack')$q$);
select pg_temp.try('anon: update settings', 'blocked', 'update public.store_settings set pix_discount_percent = 30');
select pg_temp.try('anon: call is_admin', 'allowed rows=1', 'select private.is_admin()');
reset role;

-- Customer ------------------------------------------------------------------------
set local role authenticated;
set local request.jwt.claims = '{"sub":"11111111-1111-1111-1111-111111111111","role":"authenticated","aal":"aal2","app_metadata":{}}';
select pg_temp.try('customer: update own profile name', 'allowed rows=1', $q$update public.profiles set full_name = 'Novo Nome' where id = auth.uid()$q$);
select pg_temp.try('customer: update own profile created_at', 'blocked', $q$update public.profiles set created_at = now() - interval '1 year'$q$);
select pg_temp.try('customer: update other profile', 'allowed rows=0', $q$update public.profiles set full_name = 'Hack' where id = '33333333-3333-3333-3333-333333333333'$q$);
select pg_temp.try('customer: add own address', 'allowed rows=1', $q$insert into public.addresses (recipient_name, zip_code, street, number, district, city, state) values ('Cliente', '01001000', 'Rua A', '1', 'Centro', 'São Paulo', 'SP')$q$);
select pg_temp.try('customer: address with foreign user_id', 'blocked', $q$insert into public.addresses (user_id, recipient_name, zip_code, street, number, district, city, state) values ('33333333-3333-3333-3333-333333333333', 'Fulano', '01001000', 'Rua A', '1', 'Centro', 'São Paulo', 'SP')$q$);
select pg_temp.try('customer: move address to other user', 'blocked', $q$update public.addresses set user_id = '33333333-3333-3333-3333-333333333333'$q$);
select pg_temp.val('customer: sees own orders', '2', 'select count(*)::text from public.orders');
select pg_temp.try('customer: update own order (RLS filters all rows)', 'allowed rows=0', $q$update public.orders set status = 'paid'$q$);
select pg_temp.try('customer: insert order', 'blocked', $q$insert into public.orders (customer_name, customer_email, shipping_address, subtotal_cents, total_cents) values ('Ab', 'a@b.c', '{}', 1, 1)$q$);
select pg_temp.try('customer: update product', 'allowed rows=0', $q$update public.products set name = 'Hack'$q$);
select pg_temp.try('customer: insert category', 'blocked', $q$insert into public.categories (slug, name) values ('x', 'Xx')$q$);
select pg_temp.try('customer: read coupons', 'allowed rows=0', 'select * from public.coupons');
select pg_temp.try('customer: read audit log', 'allowed rows=0', 'select * from public.audit_log');
select pg_temp.try('customer: update settings', 'allowed rows=0', 'update public.store_settings set pix_discount_percent = 30');
reset role;

set local role authenticated;
set local request.jwt.claims = '{"sub":"33333333-3333-3333-3333-333333333333","role":"authenticated","aal":"aal1","app_metadata":{}}';
select pg_temp.val('other customer: sees orders of customer 1', '0', 'select count(*)::text from public.orders');
select pg_temp.val('other customer: sees addresses of customer 1', '0', 'select count(*)::text from public.addresses');
reset role;

-- Forged admin claim (not in allow-list) -------------------------------------------
set local role authenticated;
set local request.jwt.claims = '{"sub":"33333333-3333-3333-3333-333333333333","role":"authenticated","aal":"aal2","app_metadata":{"role":"admin"}}';
select pg_temp.try('forged admin claim: insert category', 'blocked', $q$insert into public.categories (slug, name) values ('forjado', 'Forjado')$q$);
reset role;

-- Real admin without MFA --------------------------------------------------------------
set local role authenticated;
set local request.jwt.claims = '{"sub":"22222222-2222-2222-2222-222222222222","role":"authenticated","aal":"aal1","app_metadata":{}}';
select pg_temp.try('admin aal1: insert category', 'blocked', $q$insert into public.categories (slug, name) values ('sem-mfa', 'Sem MFA')$q$);
select pg_temp.val('admin aal1: sees customer orders', '0', 'select count(*)::text from public.orders');
reset role;

-- Real admin with MFA ---------------------------------------------------------------------
set local role authenticated;
set local request.jwt.claims = '{"sub":"22222222-2222-2222-2222-222222222222","role":"authenticated","aal":"aal2","app_metadata":{}}';
select pg_temp.try('admin: insert category', 'allowed rows=1', $q$insert into public.categories (slug, name) values ('com-mfa', 'Com MFA')$q$);
select pg_temp.val('admin: visible products', '2', 'select count(*)::text from public.products');
select pg_temp.try('admin: read coupons', 'allowed rows=1', 'select * from public.coupons');
select pg_temp.try('admin: change order total', 'blocked', $q$update public.orders set total_cents = 1$q$);
select pg_temp.try('admin: mark order paid', 'blocked', $q$update public.orders set status = 'paid' where id = '00000000-0000-0000-0000-0000000000d1'$q$);
select pg_temp.try('admin: cancel pending order', 'allowed rows=1', $q$update public.orders set status = 'canceled' where id = '00000000-0000-0000-0000-0000000000d2'$q$);
select pg_temp.val('admin: cancel sets canceled_at', 'true', $q$select (canceled_at is not null)::text from public.orders where id = '00000000-0000-0000-0000-0000000000d2'$q$);
select pg_temp.try('admin: reopen canceled order', 'blocked', $q$update public.orders set status = 'pending_payment' where id = '00000000-0000-0000-0000-0000000000d2'$q$);
select pg_temp.try('admin: delete audit log', 'blocked', 'delete from public.audit_log');
reset role;

-- Payment integration (service role) ---------------------------------------------------
set local role service_role;
select pg_temp.try('server: mark order paid', 'allowed rows=1', $q$update public.orders set status = 'paid' where id = '00000000-0000-0000-0000-0000000000d1'$q$);
select pg_temp.try('server: skip to delivered', 'blocked', $q$update public.orders set status = 'delivered' where id = '00000000-0000-0000-0000-0000000000d1'$q$);
select pg_temp.try('server: edit audit log', 'blocked', $q$update public.audit_log set action = 'X'$q$);
select pg_temp.try('server: delete audit log', 'blocked', 'delete from public.audit_log');
select pg_temp.try('server: delete stock movement', 'blocked', 'delete from public.stock_movements');
reset role;

set local role authenticated;
set local request.jwt.claims = '{"sub":"22222222-2222-2222-2222-222222222222","role":"authenticated","aal":"aal2","app_metadata":{}}';
select pg_temp.try('admin: paid -> preparing', 'allowed rows=1', $q$update public.orders set status = 'preparing' where id = '00000000-0000-0000-0000-0000000000d1'$q$);
select pg_temp.try('admin: cancel paid order (needs refund via gateway)', 'blocked', $q$update public.orders set status = 'canceled' where id = '00000000-0000-0000-0000-0000000000d1'$q$);
select pg_temp.try('admin: ship without tracking', 'blocked', $q$update public.orders set status = 'shipped' where id = '00000000-0000-0000-0000-0000000000d1'$q$);
select pg_temp.try('admin: ship with tracking', 'allowed rows=1', $q$update public.orders set status = 'shipped', shipping_tracking_code = 'BR123456789BR' where id = '00000000-0000-0000-0000-0000000000d1'$q$);
select pg_temp.try('admin: cancel shipped order', 'blocked', $q$update public.orders set status = 'canceled' where id = '00000000-0000-0000-0000-0000000000d1'$q$);
reset role;

-- Access revoked immediately when removed from the allow-list -------------------------------
delete from private.admin_users where user_id = '22222222-2222-2222-2222-222222222222';
set local role authenticated;
set local request.jwt.claims = '{"sub":"22222222-2222-2222-2222-222222222222","role":"authenticated","aal":"aal2","app_metadata":{}}';
select pg_temp.try('revoked admin: insert category', 'blocked', $q$insert into public.categories (slug, name) values ('revogado', 'Revogado')$q$);
reset role;

-- Ledger integrity -------------------------------------------------------------------------
select pg_temp.try('delete variant with stock history', 'blocked', $q$delete from public.product_variants where id = '00000000-0000-0000-0000-00000000b001'$q$);
select pg_temp.val('audit rows for admin category insert', '1', $q$select count(*)::text from public.audit_log where table_name = 'categories' and actor_id = '22222222-2222-2222-2222-222222222222'$q$);

select n, test, expect, outcome,
  case
    when expect = 'blocked' then outcome like 'blocked%'
    when expect like 'allowed%' then outcome = expect
    else outcome = expect
  end as ok
from results order by n;
rollback;
