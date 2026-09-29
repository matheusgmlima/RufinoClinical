-- RLS smoke test. Runs inside a transaction and rolls back, so it leaves no data behind.
-- Run with the Supabase SQL editor (or MCP execute_sql) after any policy change.
-- Expected: anon/customers are blocked or see 0 rows; admin without MFA is blocked; admin with MFA is allowed.
begin;
insert into public.categories (id, slug, name) values ('00000000-0000-0000-0000-00000000c001', 'teste', 'Teste');
insert into public.products (id, slug, name, is_active, category_id) values
  ('00000000-0000-0000-0000-00000000a001', 'ativo', 'Produto ativo', true, '00000000-0000-0000-0000-00000000c001'),
  ('00000000-0000-0000-0000-00000000a002', 'rascunho', 'Produto rascunho', false, null);
insert into public.product_variants (product_id, sku, name, price_cents, stock_quantity, weight_grams, length_cm, width_cm, height_cm) values
  ('00000000-0000-0000-0000-00000000a001', 'TST-1', 'Único', 1000, 5, 100, 10, 10, 5),
  ('00000000-0000-0000-0000-00000000a002', 'TST-2', 'Único', 1000, 5, 100, 10, 10, 5);
insert into public.coupons (code, discount_type, discount_value) values ('SEGREDO10', 'percent', 10);

create temp table results (n serial, test text, outcome text);
grant all on results to anon, authenticated;
grant all on sequence results_n_seq to anon, authenticated;

create or replace function pg_temp.try(label text, stmt text) returns void language plpgsql as $$
declare c bigint;
begin
  execute stmt;
  get diagnostics c = row_count;
  insert into results(test, outcome) values (label, 'ALLOWED rows=' || c);
exception when others then
  insert into results(test, outcome) values (label, 'blocked: ' || sqlerrm);
end $$;

set local role anon;
set local request.jwt.claims = '{"role":"anon"}';
insert into results(test, outcome) select 'anon: visible products (expect ativo)', string_agg(slug, ',') from public.products;
insert into results(test, outcome) select 'anon: visible variants (expect 1)', count(*)::text from public.product_variants;
select pg_temp.try('anon: read coupons', 'select * from public.coupons');
select pg_temp.try('anon: read orders', 'select * from public.orders');
select pg_temp.try('anon: read webhooks', 'select * from public.webhook_events');
select pg_temp.try('anon: insert product', $q$insert into public.products (slug, name) values ('hack', 'Hack')$q$);
select pg_temp.try('anon: update settings', 'update public.store_settings set pix_discount_percent = 30');
reset role;

set local role authenticated;
set local request.jwt.claims = '{"sub":"11111111-1111-1111-1111-111111111111","role":"authenticated","aal":"aal2","app_metadata":{}}';
select pg_temp.try('user: update product (expect rows=0)', $q$update public.products set name = 'Hack'$q$);
select pg_temp.try('user: insert category', $q$insert into public.categories (slug, name) values ('x', 'Xx')$q$);
select pg_temp.try('user: read coupons (expect rows=0)', 'select * from public.coupons');
select pg_temp.try('user: update settings (expect rows=0)', 'update public.store_settings set pix_discount_percent = 30');
select pg_temp.try('user: read audit log (expect rows=0)', 'select * from public.audit_log');
select pg_temp.try('user: insert order', $q$insert into public.orders (customer_name, customer_email, shipping_address, subtotal_cents, total_cents) values ('Ab', 'a@b.c', '{}', 1, 1)$q$);
select pg_temp.try('user: address for other user', $q$insert into public.addresses (user_id, recipient_name, zip_code, street, number, district, city, state) values ('22222222-2222-2222-2222-222222222222', 'Fulano', '01001000', 'Rua A', '1', 'Centro', 'São Paulo', 'SP')$q$);
reset role;

set local role authenticated;
set local request.jwt.claims = '{"sub":"22222222-2222-2222-2222-222222222222","role":"authenticated","aal":"aal1","app_metadata":{"role":"admin"}}';
select pg_temp.try('admin without MFA: insert category', $q$insert into public.categories (slug, name) values ('sem-mfa', 'Sem MFA')$q$);
reset role;

set local role authenticated;
set local request.jwt.claims = '{"sub":"22222222-2222-2222-2222-222222222222","role":"authenticated","aal":"aal2","app_metadata":{"role":"admin"}}';
select pg_temp.try('admin with MFA: insert category (expect ALLOWED)', $q$insert into public.categories (slug, name) values ('com-mfa', 'Com MFA')$q$);
insert into results(test, outcome) select 'admin with MFA: visible products (expect 2)', count(*)::text from public.products;
select pg_temp.try('admin with MFA: read coupons (expect rows=1)', 'select * from public.coupons');
reset role;

insert into results(test, outcome) select 'audit rows for categories (expect 2)', count(*)::text from public.audit_log where table_name = 'categories';
select test, outcome from results order by n;
rollback;
