-- Internal order notes move to their own admin-only table. Column grants cannot tell an admin from
-- a customer (both are `authenticated`), so orders.notes was readable by the order's own customer.
create table public.order_notes (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null unique references public.orders(id) on delete cascade,
  notes text not null check (char_length(notes) between 1 and 500),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.order_notes enable row level security;
create policy "order_notes: admin reads" on public.order_notes
  for select to authenticated using ((select private.is_admin()));
create policy "order_notes: admin inserts" on public.order_notes
  for insert to authenticated with check ((select private.is_admin()));
create policy "order_notes: admin updates" on public.order_notes
  for update to authenticated using ((select private.is_admin())) with check ((select private.is_admin()));
create policy "order_notes: admin deletes" on public.order_notes
  for delete to authenticated using ((select private.is_admin()));

grant select, delete on public.order_notes to authenticated;
grant insert (order_id, notes) on public.order_notes to authenticated;
grant update (notes) on public.order_notes to authenticated;

create trigger set_updated_at before update on public.order_notes
  for each row execute function private.set_updated_at();
create trigger audit after insert or update or delete on public.order_notes
  for each row execute function private.audit_row();

insert into public.order_notes (order_id, notes)
select id, notes from public.orders where notes is not null and btrim(notes) <> '';
