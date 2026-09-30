-- Internal notes now live in public.order_notes (admin-only); the old column was readable by the
-- order's customer. Its grants go with it.
alter table public.orders drop column notes;
