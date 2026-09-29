-- Removes the development catalog (SKUs starting with DEV-) before launch.
-- Products with stock history or orders cannot be deleted (by design); deactivate those instead.
begin;
delete from public.products p
where exists (select 1 from public.product_variants v where v.product_id = p.id and v.sku like 'DEV-%')
  and not exists (select 1 from public.product_variants v where v.product_id = p.id and v.sku not like 'DEV-%');
delete from public.categories c
where c.slug in ('bandagem-elastica', 'compressao', 'pos-operatorio', 'enfaixamento')
  and not exists (select 1 from public.products p where p.category_id = c.id);
commit;
