-- Catalog editing from the admin panel: writable columns only (ids, timestamps, stock and
-- image paths stay out of reach), and an image can only point at a variant of its own product.

revoke insert, update on public.products from authenticated;
grant insert (category_id, slug, name, brand, short_description, description, usage_instructions, indications,
  anvisa_registration, is_active, is_featured, position, seo_title, seo_description) on public.products to authenticated;
grant update (category_id, slug, name, brand, short_description, description, usage_instructions, indications,
  anvisa_registration, is_active, is_featured, position, seo_title, seo_description) on public.products to authenticated;

revoke insert, update on public.categories from authenticated;
grant insert (slug, name, description, position, is_active) on public.categories to authenticated;
grant update (slug, name, description, position, is_active) on public.categories to authenticated;

revoke insert, update on public.product_images from authenticated;
grant insert (product_id, variant_id, storage_path, alt, position) on public.product_images to authenticated;
grant update (variant_id, alt, position) on public.product_images to authenticated;

create or replace function private.check_image_variant()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if new.variant_id is not null and not exists (
    select 1 from public.product_variants v where v.id = new.variant_id and v.product_id = new.product_id
  ) then
    raise exception 'image variant belongs to another product' using errcode = 'check_violation';
  end if;
  return new;
end;
$$;
revoke all on function private.check_image_variant() from public;

create trigger check_variant before insert or update of variant_id on public.product_images
  for each row execute function private.check_image_variant();
