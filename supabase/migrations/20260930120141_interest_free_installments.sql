-- Card installments whose interest the store pays: Mercado Pago "parcelamento sem juros", set in the
-- Mercado Pago account (Seu negócio > Custos). Above it, up to max_installments, the buyer pays interest.
-- The site advertises "sem juros" only up to this number, so it must mirror the Mercado Pago setting
-- (1 = the buyer always pays interest).
alter table public.store_settings
  add column interest_free_installments integer not null default 1
    check (interest_free_installments between 1 and 12),
  add constraint store_settings_interest_free_within_max check (interest_free_installments <= max_installments);

update public.store_settings set interest_free_installments = 3;
