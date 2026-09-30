-- Store settings edited from the admin panel: only the business values, never the row key or
-- timestamps.
revoke update on public.store_settings from authenticated;
grant update (pix_discount_percent, max_installments, interest_free_installments, min_installment_cents,
  free_shipping_threshold_cents) on public.store_settings to authenticated;
