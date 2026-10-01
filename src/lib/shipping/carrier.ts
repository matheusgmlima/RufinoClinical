import { z } from "zod";

// Pure helpers for carrier quotes (Melhor Envio), shared by the server code and its tests.

export type CartItem = { variantId: string; quantity: number };

export type CarrierService = { id: number; service: string; price_cents: number; min_days: number; max_days: number };

/** Up to this many carrier services are offered, cheapest first. */
export const MAX_CARRIER_SERVICES = 4;

/** Same canonical cart as private.cart_key: lower-case ids in byte order. */
export function cartKey(items: CartItem[]) {
  return items
    .map((item) => ({ variant_id: item.variantId.toLowerCase(), quantity: item.quantity }))
    .toSorted((a, b) => (a.variant_id < b.variant_id ? -1 : a.variant_id > b.variant_id ? 1 : 0));
}

// Prices come as strings ("24.90"); days as integers.
const reais = z.union([z.string(), z.number()]).transform(Number).pipe(z.number().positive().max(10000));
const days = z.number().int().min(0).max(90);
const range = z.object({ min: days, max: days }).refine((r) => r.min <= r.max);

const serviceSchema = z.object({
  id: z.number().int().positive(),
  name: z.string().trim().min(1),
  error: z.unknown().optional(),
  price: reais.optional(),
  custom_price: reais.optional(),
  delivery_range: range.optional(),
  custom_delivery_range: range.optional(),
  company: z.object({ name: z.string().trim().min(1) }),
});

/**
 * Services from a Melhor Envio quote. Unavailable ones (with `error`) and malformed entries are
 * dropped; the custom price and range are used, as they carry the account's own rules.
 */
export function parseCarrierQuote(body: unknown): CarrierService[] {
  if (!Array.isArray(body)) return [];
  const services: CarrierService[] = [];
  for (const entry of body) {
    const parsed = serviceSchema.safeParse(entry);
    if (!parsed.success || parsed.data.error) continue;
    const { id, name, company } = parsed.data;
    const price = parsed.data.custom_price ?? parsed.data.price;
    const window = parsed.data.custom_delivery_range ?? parsed.data.delivery_range;
    if (price === undefined || !window) continue;
    services.push({
      id,
      service: `${company.name} ${name}`.slice(0, 80),
      price_cents: Math.round(price * 100),
      min_days: window.min,
      max_days: window.max,
    });
  }
  return services.toSorted((a, b) => a.price_cents - b.price_cents).slice(0, MAX_CARRIER_SERVICES);
}
