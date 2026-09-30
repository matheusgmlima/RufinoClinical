-- Storage deletes need SELECT on the object as well; without it remove() silently skips the file.
-- Public URLs keep working for everyone (public bucket); listing through the API stays admin-only.
create policy "product-images: admin reads" on storage.objects
  for select to authenticated
  using (bucket_id = 'product-images' and (select private.is_admin()));
