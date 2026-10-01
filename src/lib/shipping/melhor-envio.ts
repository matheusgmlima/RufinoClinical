import "server-only";

import { publicEnv } from "@/lib/env/public";
import { serverEnv } from "@/lib/env/server";
import { COMPANY } from "@/lib/legal/company";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";

import { cartKey, parseCarrierQuote, type CartItem } from "./carrier";

// Melhor Envio quotes every carrier it works with for the cart's real packages. The answer goes to
// public.shipping_quotes and the database prices the order from it, so a quote is only a cache:
// without one (no token, API down) checkout falls back to the regional flat rates.

const BASE_URL = {
  sandbox: "https://sandbox.melhorenvio.com.br",
  production: "https://melhorenvio.com.br",
};
const QUOTE_TTL_MS = 6 * 60 * 60 * 1000;
// No carrier or a failed call: flat rates for a while instead of calling the API on every quote.
const RETRY_AFTER_MS = 15 * 60 * 1000;

export function carrierQuotesEnabled(): boolean {
  return !!serverEnv.MELHOR_ENVIO_TOKEN;
}

// Melhor Envio requires the app name and a contact in the User-Agent.
function userAgent() {
  const contact = serverEnv.EMAIL_REPLY_TO || COMPANY.email || publicEnv.NEXT_PUBLIC_SITE_URL;
  return `Rufino Clinical (${contact})`;
}

async function requestQuote(origin: string, zip: string, products: unknown[]) {
  const env = serverEnv.MELHOR_ENVIO_ENV === "production" ? "production" : "sandbox";
  try {
    const res = await fetch(`${BASE_URL[env]}/api/v2/me/shipment/calculate`, {
      method: "POST",
      headers: {
        Accept: "application/json",
        "Content-Type": "application/json",
        Authorization: `Bearer ${serverEnv.MELHOR_ENVIO_TOKEN}`,
        "User-Agent": userAgent(),
      },
      body: JSON.stringify({
        from: { postal_code: origin },
        to: { postal_code: zip },
        products,
        options: { receipt: false, own_hand: false },
      }),
      signal: AbortSignal.timeout(8000),
      cache: "no-store",
    });
    if (!res.ok) {
      console.error("melhor envio quote failed", res.status, (await res.text()).slice(0, 300));
      return null;
    }
    return parseCarrierQuote(await res.json());
  } catch (err) {
    console.error("melhor envio quote failed", err);
    return null;
  }
}

/**
 * Asks Melhor Envio for this cart and destination and caches the answer. The packages are built
 * here from the catalog (dimensions, weight, price as declared value), never from the browser.
 * Returns whether a quote (possibly empty) was stored; never throws.
 */
export async function ensureCarrierQuote(zip: string, items: CartItem[]): Promise<boolean> {
  if (!carrierQuotesEnabled() || !/^\d{8}$/.test(zip) || items.length === 0) return false;
  try {
    const supabase = await createClient();
    const [{ data: settings }, { data: variants }] = await Promise.all([
      supabase.from("store_settings").select("origin_zip").single(),
      // RLS: only variants on sale come back.
      supabase
        .from("product_variants")
        .select("id, price_cents, weight_grams, length_cm, width_cm, height_cm")
        .in(
          "id",
          items.map((item) => item.variantId),
        ),
    ]);
    const origin = settings?.origin_zip;
    if (!origin || !variants) return false;

    const products = items.map((item) => {
      const variant = variants.find((v) => v.id === item.variantId);
      return variant
        ? {
            id: variant.id,
            width: Math.ceil(Number(variant.width_cm)),
            height: Math.ceil(Number(variant.height_cm)),
            length: Math.ceil(Number(variant.length_cm)),
            weight: variant.weight_grams / 1000,
            insurance_value: variant.price_cents / 100,
            quantity: item.quantity,
          }
        : null;
    });
    // Something left the store: the database reports it, no point quoting.
    if (products.some((product) => product === null)) return false;

    const services = await requestQuote(origin, zip, products);
    const ttl = services?.length ? QUOTE_TTL_MS : RETRY_AFTER_MS;
    const { error } = await createAdminClient()
      .from("shipping_quotes")
      .insert({
        zip,
        origin_zip: origin,
        items: cartKey(items),
        services: services ?? [],
        expires_at: new Date(Date.now() + ttl).toISOString(),
      });
    if (error) console.error("carrier quote cache write failed", error.message);
    return !error;
  } catch (err) {
    console.error("carrier quote failed", err);
    return false;
  }
}
