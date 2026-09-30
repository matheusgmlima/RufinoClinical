-- Security smoke test. Runs inside a transaction and ROLLS BACK, so it leaves no data behind.
-- Run in the Supabase SQL editor (or MCP execute_sql) after any schema or policy change.
-- Every row in the result has an `expect` column; `ok` must be true for all rows.
begin;

-- Fixtures -------------------------------------------------------------------
insert into auth.users (id, instance_id, aud, role, email, raw_app_meta_data, raw_user_meta_data, created_at, updated_at) values
  ('11111111-1111-1111-1111-111111111111', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'cliente@teste.local', '{}', '{"full_name":"Cliente Teste"}', now(), now()),
  ('33333333-3333-3333-3333-333333333333', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'outro@teste.local', '{}', '{}', now(), now()),
  ('22222222-2222-2222-2222-222222222222', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'admin@teste.local', '{}', '{}', now(), now()),
  ('44444444-4444-4444-4444-444444444444', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'sair@teste.local', '{}', '{}', now(), now());
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
select pg_temp.val('anon: visible products', 'ativo', $q$select string_agg(slug, ',') from public.products where slug in ('ativo', 'rascunho')$q$);
select pg_temp.val('anon: visible variants', '1', $q$select count(*)::text from public.product_variants where sku like 'TST-%'$q$);
select pg_temp.try('anon: read coupons', 'blocked', 'select * from public.coupons');
select pg_temp.try('anon: read orders', 'blocked', 'select * from public.orders');
select pg_temp.try('anon: read profiles', 'blocked', 'select * from public.profiles');
select pg_temp.try('anon: read webhooks', 'blocked', 'select * from public.webhook_events');
select pg_temp.try('anon: insert product', 'blocked', $q$insert into public.products (slug, name) values ('hack', 'Hack')$q$);
select pg_temp.try('anon: update settings', 'blocked', 'update public.store_settings set pix_discount_percent = 30');
select pg_temp.try('anon: call is_admin', 'allowed rows=1', 'select private.is_admin()');
select pg_temp.try('anon: read shipping rates', 'allowed rows=5', 'select * from public.shipping_rates');
select pg_temp.try('anon: quote order', 'blocked', $q$select public.quote_order('[]', null, 'pix')$q$);
select pg_temp.try('anon: create order', 'blocked', $q$select public.create_order('[]', null, 'pix')$q$);
select pg_temp.try('anon: admin status', 'blocked', 'select public.admin_status()');
select pg_temp.try('anon: delete account', 'blocked', 'select public.delete_my_account()');
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
select pg_temp.try('customer: update shipping rate', 'allowed rows=0', $q$update public.shipping_rates set price_cents = 0$q$);
select pg_temp.try('customer: insert category', 'blocked', $q$insert into public.categories (slug, name) values ('x', 'Xx')$q$);
select pg_temp.try('customer: read coupons', 'allowed rows=0', 'select * from public.coupons');
select pg_temp.try('customer: read audit log', 'allowed rows=0', 'select * from public.audit_log');
select pg_temp.try('customer: update settings', 'allowed rows=0', 'update public.store_settings set pix_discount_percent = 30');
select pg_temp.val('customer: admin status', 'none', 'select public.admin_status()');
select pg_temp.try('customer: adjust stock', 'blocked', $q$select public.adjust_stock('00000000-0000-0000-0000-00000000b001', 5)$q$);
select pg_temp.try('customer: delete account with open orders', 'blocked', 'select public.delete_my_account()');
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
select pg_temp.val('admin aal1: status asks for MFA', 'mfa_required', 'select public.admin_status()');
select pg_temp.try('admin aal1: adjust stock', 'blocked', $q$select public.adjust_stock('00000000-0000-0000-0000-00000000b001', 1)$q$);
reset role;

-- Real admin with MFA ---------------------------------------------------------------------
set local role authenticated;
set local request.jwt.claims = '{"sub":"22222222-2222-2222-2222-222222222222","role":"authenticated","aal":"aal2","app_metadata":{}}';
select pg_temp.try('admin: insert category', 'allowed rows=1', $q$insert into public.categories (slug, name) values ('com-mfa', 'Com MFA')$q$);
select pg_temp.val('admin: visible products', '2', $q$select count(*)::text from public.products where slug in ('ativo', 'rascunho')$q$);
select pg_temp.try('admin: read coupons', 'allowed rows=1', 'select * from public.coupons');
select pg_temp.try('admin: update shipping rate', 'allowed rows=1', $q$update public.shipping_rates set min_days = 3 where region = 'SE'$q$);
select pg_temp.try('admin: change order total', 'blocked', $q$update public.orders set total_cents = 1$q$);
select pg_temp.try('admin: mark order paid', 'blocked', $q$update public.orders set status = 'paid' where id = '00000000-0000-0000-0000-0000000000d1'$q$);
select pg_temp.try('admin: cancel pending order', 'allowed rows=1', $q$update public.orders set status = 'canceled' where id = '00000000-0000-0000-0000-0000000000d2'$q$);
select pg_temp.val('admin: cancel sets canceled_at', 'true', $q$select (canceled_at is not null)::text from public.orders where id = '00000000-0000-0000-0000-0000000000d2'$q$);
select pg_temp.try('admin: reopen canceled order', 'blocked', $q$update public.orders set status = 'pending_payment' where id = '00000000-0000-0000-0000-0000000000d2'$q$);
select pg_temp.try('admin: delete audit log', 'blocked', 'delete from public.audit_log');
select pg_temp.val('admin: status ok', 'ok', 'select public.admin_status()');
select pg_temp.try('admin: set stock directly', 'blocked', $q$update public.product_variants set stock_quantity = 99 where sku = 'TST-1'$q$);
select pg_temp.try('admin: edit variant price', 'allowed rows=1', $q$update public.product_variants set price_cents = 1000 where sku = 'TST-1'$q$);
select pg_temp.val('admin: stock in', '8', $q$select public.adjust_stock('00000000-0000-0000-0000-00000000b001', 3)::text$q$);
select pg_temp.val('admin: stock out', '5', $q$select public.adjust_stock('00000000-0000-0000-0000-00000000b001', -3)::text$q$);
select pg_temp.try('admin: stock below zero', 'blocked', $q$select public.adjust_stock('00000000-0000-0000-0000-00000000b001', -6)$q$);
select pg_temp.val('admin: adjustments reach the ledger', '2', $q$select count(*)::text from public.stock_movements where actor_id = auth.uid()$q$);
select pg_temp.try('admin: edit coupon usage count', 'blocked', 'update public.coupons set redemptions_count = 0');
select pg_temp.try('admin: edit product', 'allowed rows=1', $q$update public.products set name = 'Produto editado' where slug = 'rascunho'$q$);
select pg_temp.try('admin: change product id', 'blocked', $q$update public.products set id = gen_random_uuid() where slug = 'rascunho'$q$);
select pg_temp.try('admin: backdate product', 'blocked', $q$update public.products set created_at = now() - interval '1 year'$q$);
select pg_temp.try('admin: add image', 'allowed rows=1', $q$insert into public.product_images (product_id, variant_id, storage_path, alt) values ('00000000-0000-0000-0000-00000000a001', '00000000-0000-0000-0000-00000000b001', 'products/a001/foto.jpg', 'Foto')$q$);
select pg_temp.try('admin: image with variant of another product', 'blocked', $q$insert into public.product_images (product_id, variant_id, storage_path, alt) values ('00000000-0000-0000-0000-00000000a001', '00000000-0000-0000-0000-00000000b002', 'products/a001/outra.jpg', 'Outra')$q$);
select pg_temp.try('admin: repoint image file', 'blocked', $q$update public.product_images set storage_path = 'products/x.jpg'$q$);
select pg_temp.try('admin: edit image alt', 'allowed rows=1', $q$update public.product_images set alt = 'Foto nova', position = 1$q$);
select pg_temp.try('admin: edit settings', 'allowed rows=1', 'update public.store_settings set pix_discount_percent = 7');
select pg_temp.try('admin: change settings row key', 'blocked', 'update public.store_settings set id = false');
select pg_temp.try('admin: backdate settings', 'blocked', $q$update public.store_settings set updated_at = now() - interval '1 year'$q$);
select pg_temp.try('admin: create coupon', 'allowed rows=1', $q$insert into public.coupons (code, discount_type, discount_value, ends_at) values ('PAINEL5', 'fixed', 500, now() + interval '1 day')$q$);
select pg_temp.try('admin: coupon with preset usage', 'blocked', $q$insert into public.coupons (code, discount_type, discount_value, redemptions_count) values ('PAINEL6', 'fixed', 500, 3)$q$);
select pg_temp.try('admin: delete own account', 'blocked', 'select public.delete_my_account()');
select pg_temp.try('admin: add internal note', 'allowed rows=1', $q$insert into public.order_notes (order_id, notes) values ('00000000-0000-0000-0000-0000000000d1', 'Nota interna')$q$);
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

-- Account deletion (LGPD): the user and personal data go, nothing else ---------------------
set local role authenticated;
set local request.jwt.claims = '{"sub":"44444444-4444-4444-4444-444444444444","role":"authenticated"}';
select pg_temp.try('customer without orders: delete account', 'allowed rows=1', 'select public.delete_my_account()');
reset role;
select pg_temp.val('deleted account leaves no user or profile', '0', $q$select (select count(*) from auth.users where id = '44444444-4444-4444-4444-444444444444') + (select count(*) from public.profiles where id = '44444444-4444-4444-4444-444444444444') || ''$q$);

-- Access revoked immediately when removed from the allow-list -------------------------------
delete from private.admin_users where user_id = '22222222-2222-2222-2222-222222222222';
set local role authenticated;
set local request.jwt.claims = '{"sub":"22222222-2222-2222-2222-222222222222","role":"authenticated","aal":"aal2","app_metadata":{}}';
select pg_temp.try('revoked admin: insert category', 'blocked', $q$insert into public.categories (slug, name) values ('revogado', 'Revogado')$q$);
reset role;

-- Ledger integrity -------------------------------------------------------------------------
select pg_temp.try('delete variant with stock history', 'blocked', $q$delete from public.product_variants where id = '00000000-0000-0000-0000-00000000b001'$q$);
select pg_temp.val('audit rows for admin category insert', '1', $q$select count(*)::text from public.audit_log where table_name = 'categories' and actor_id = '22222222-2222-2222-2222-222222222222'$q$);

-- Checkout: prices, stock and payments come only from the database -------------------------
update public.store_settings set pix_discount_percent = 5, free_shipping_threshold_cents = null, max_installments = 6, min_installment_cents = 3000;
select pg_temp.try('settings: more interest-free installments than the maximum', 'blocked', 'update public.store_settings set interest_free_installments = 7');
update public.shipping_rates set price_cents = 1990 where region = 'SE';
insert into public.addresses (id, user_id, recipient_name, zip_code, street, number, district, city, state) values
  ('00000000-0000-0000-0000-0000000000e3', '33333333-3333-3333-3333-333333333333', 'Outro', '01001000', 'Rua B', '2', 'Centro', 'São Paulo', 'SP');
create function pg_temp.cart(qty int, variant text default 'b001') returns jsonb language sql as
  $$ select jsonb_build_array(jsonb_build_object('variant_id', '00000000-0000-0000-0000-00000000' || variant, 'quantity', qty)) $$;
grant execute on function pg_temp.cart(int, text) to authenticated;

set local role authenticated;
set local request.jwt.claims = '{"sub":"11111111-1111-1111-1111-111111111111","role":"authenticated"}';
select pg_temp.val('quote: pix, no address', '1900', $q$select public.quote_order(pg_temp.cart(2), null, 'pix') ->> 'total_cents'$q$);
select pg_temp.val('quote: coupon + pix + SE shipping', '3700', $q$select public.quote_order(pg_temp.cart(2), (select id from public.addresses limit 1), 'pix', ' segredo10 ') ->> 'total_cents'$q$);
select pg_temp.val('quote: unknown coupon', 'coupon_invalid', $q$select public.quote_order(pg_temp.cart(1), null, 'credit_card', 'NAOEXISTE') #>> '{problems,0,problem}'$q$);
select pg_temp.val('quote: draft product', 'unavailable', $q$select public.quote_order(pg_temp.cart(1, 'b002'), null, 'pix') #>> '{problems,0,problem}'$q$);
select pg_temp.val('quote: more than stock', 'insufficient_stock', $q$select public.quote_order(pg_temp.cart(6), null, 'pix') #>> '{problems,0,problem}'$q$);
select pg_temp.val('quote: someone else''s address', 'address_not_found', $q$select public.quote_order(pg_temp.cart(1), '00000000-0000-0000-0000-0000000000e3', 'pix') #>> '{problems,0,problem}'$q$);
select pg_temp.try('quote: duplicated variant', 'blocked', $q$select public.quote_order(pg_temp.cart(1) || pg_temp.cart(1), null, 'pix')$q$);
select pg_temp.try('quote: zero quantity', 'blocked', $q$select public.quote_order(pg_temp.cart(0), null, 'pix')$q$);
select pg_temp.try('customer: call private.price_order', 'blocked', $q$select private.price_order(auth.uid(), pg_temp.cart(1), null, 'pix', null)$q$);
select pg_temp.try('order without CPF', 'blocked', $q$select public.create_order(pg_temp.cart(2), (select id from public.addresses limit 1), 'pix', 'SEGREDO10')$q$);
select pg_temp.try('customer: save CPF', 'allowed rows=1', $q$update public.profiles set document = '52998224725' where id = auth.uid()$q$);
select pg_temp.try('order over stock', 'blocked', $q$select public.create_order(pg_temp.cart(6), (select id from public.addresses limit 1), 'pix')$q$);
select pg_temp.try('order with someone else''s address', 'blocked', $q$select public.create_order(pg_temp.cart(1), '00000000-0000-0000-0000-0000000000e3', 'pix')$q$);
select pg_temp.try('create order (pix + coupon)', 'allowed rows=1', $q$select public.create_order(pg_temp.cart(2), (select id from public.addresses limit 1), 'pix', 'SEGREDO10')$q$);
select pg_temp.val('order amounts', '2000/200/90/1990/3700', $q$select concat_ws('/', subtotal_cents, discount_cents, payment_discount_cents, shipping_cents, total_cents) from public.orders where status = 'pending_payment'$q$);
select pg_temp.try('customer: record payment', 'blocked', $q$select public.record_payment(id, 'x', 'approved', null, 'pix', 1, total_cents, '{}') from public.orders$q$);
select pg_temp.try('customer: release orders', 'blocked', 'select private.release_expired_orders()');
select pg_temp.try('second pending order (card)', 'allowed rows=1', $q$select public.create_order(pg_temp.cart(1), (select id from public.addresses limit 1), 'credit_card')$q$);
select pg_temp.try('third pending order (card)', 'allowed rows=1', $q$select public.create_order(pg_temp.cart(1), (select id from public.addresses limit 1), 'credit_card')$q$);
select pg_temp.try('fourth pending order', 'blocked', $q$select public.create_order(pg_temp.cart(1), (select id from public.addresses limit 1), 'credit_card')$q$);
reset role;
select pg_temp.val('stock reserved', '1', $q$select stock_quantity::text from public.product_variants where sku = 'TST-1'$q$);
select pg_temp.val('coupon redeemed', '1', $q$select redemptions_count::text from public.coupons where code = 'SEGREDO10'$q$);
create temp table placed as select id, payment_method from public.orders where status = 'pending_payment' and user_id = '11111111-1111-1111-1111-111111111111';
grant select on placed to authenticated, service_role;

set local role authenticated;
set local request.jwt.claims = '{"sub":"33333333-3333-3333-3333-333333333333","role":"authenticated"}';
select pg_temp.val('other customer: cancel order of customer 1', 'false', $q$select public.cancel_order((select id from placed where payment_method = 'pix'))::text$q$);
set local request.jwt.claims = '{"sub":"11111111-1111-1111-1111-111111111111","role":"authenticated"}';
select pg_temp.val('customer: cancel own pending order', 'true', $q$select public.cancel_order((select id from placed where payment_method = 'credit_card' limit 1))::text$q$);
reset role;

set local role service_role;
select pg_temp.val('payment: pending Pix', 'recorded', $q$select public.record_payment(id, 'mp-0', 'pending', null, 'pix', 1, 3700, '{}', now() + interval '2 hours') from placed where payment_method = 'pix'$q$);
select pg_temp.val('pending Pix keeps stock until its deadline', 'true', $q$select (expires_at > now() + interval '90 minutes')::text from public.orders where id = (select id from placed where payment_method = 'pix')$q$);
select pg_temp.val('payment: wrong amount', 'mismatch', $q$select public.record_payment(id, 'mp-1', 'approved', null, 'pix', 1, 100, '{}') from placed where payment_method = 'pix'$q$);
select pg_temp.val('payment: approved', 'paid', $q$select public.record_payment(id, 'mp-2', 'approved', null, 'pix', 1, 3700, '{}') from placed where payment_method = 'pix'$q$);
select pg_temp.val('payment: repeated notification', 'already_paid', $q$select public.record_payment(id, 'mp-2', 'approved', null, 'pix', 1, 3700, '{}') from placed where payment_method = 'pix'$q$);
select pg_temp.try('payment: stale pending after approval', 'allowed rows=1', $q$select public.record_payment(id, 'mp-2', 'pending', null, 'pix', 1, 3700, '{}') from placed where payment_method = 'pix'$q$);
select pg_temp.val('settled payment never reopens', 'approved', $q$select status from public.payments where provider_payment_id = 'mp-2'$q$);
select pg_temp.val('payment: second approved payment', 'needs_refund', $q$select public.record_payment(id, 'mp-3', 'approved', null, 'pix', 1, 3700, '{}') from placed where payment_method = 'pix'$q$);
select pg_temp.val('payment: refund of the duplicate', 'recorded', $q$select public.record_payment(id, 'mp-3', 'refunded', null, 'pix', 1, 3700, '{}') from placed where payment_method = 'pix'$q$);
select pg_temp.val('payment: refund of the settling payment', 'refunded', $q$select public.record_payment(id, 'mp-2', 'refunded', null, 'pix', 1, 3700, '{}') from placed where payment_method = 'pix'$q$);
reset role;
set local role authenticated;
set local request.jwt.claims = '{"sub":"11111111-1111-1111-1111-111111111111","role":"authenticated"}';
select pg_temp.val('customer: reads own payments', '4', 'select count(*)::text from public.payments');
select pg_temp.try('customer: edit own payment', 'blocked', $q$update public.payments set status = 'approved'$q$);
select pg_temp.val('customer: reads internal notes of own order', '0', 'select count(*)::text from public.order_notes');
select pg_temp.try('customer: add note to own order', 'blocked', $q$insert into public.order_notes (order_id, notes) values ('00000000-0000-0000-0000-0000000000d1', 'x')$q$);
set local request.jwt.claims = '{"sub":"33333333-3333-3333-3333-333333333333","role":"authenticated"}';
select pg_temp.val('other customer: reads payments of customer 1', '0', 'select count(*)::text from public.payments');
reset role;
update public.orders set expires_at = now() - interval '1 hour' where id in (select id from placed) and status = 'pending_payment';
select pg_temp.val('expired orders released', '1', 'select private.release_expired_orders()::text');
select pg_temp.val('stock fully restored', '5', $q$select stock_quantity::text from public.product_variants where sku = 'TST-1'$q$);
select pg_temp.val('stock ledger balances', '0', $q$select sum(delta)::text from public.stock_movements where order_id in (select id from placed)$q$);

select n, test, expect, outcome,
  case
    when expect = 'blocked' then outcome like 'blocked%'
    when expect like 'allowed%' then outcome = expect
    else outcome = expect
  end as ok
from results order by n;
rollback;
