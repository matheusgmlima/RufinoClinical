"use server";

import { z } from "zod";

import { ensureCepLocation } from "@/lib/shipping/cep-location";
import { shippingOptionSchema, type ShippingOption } from "@/lib/shipping/options";
import { createClient } from "@/lib/supabase/server";
import { onlyDigits } from "@/lib/validation/br";

export type ShippingEstimate = { city: string; state: string; options: ShippingOption[] } | { error: string };

const inputSchema = z.object({
  cep: z
    .string()
    .transform(onlyDigits)
    .refine((value) => value.length === 8),
  variantId: z.uuid(),
  quantity: z.number().int().min(1).max(99),
});

const estimateSchema = z.object({
  city: z.string().nullable(),
  state: z.string().nullable(),
  options: z.array(shippingOptionSchema),
});

/**
 * Product page estimate. Only the CEP and the item come from the browser: the price is read here
 * (for the free-shipping rule) and every shipping price comes from the database.
 */
export async function estimateShipping(input: unknown): Promise<ShippingEstimate> {
  const parsed = inputSchema.safeParse(input);
  if (!parsed.success) return { error: "Digite um CEP com 8 números." };
  const { cep, variantId, quantity } = parsed.data;

  const supabase = await createClient();
  // RLS: only variants on sale come back.
  const { data: variant } = await supabase.from("product_variants").select("price_cents").eq("id", variantId).maybeSingle();
  if (!variant) return { error: "Não foi possível calcular o frete agora." };

  const estimate = async () => {
    const args = { p_zip: cep, p_goods_cents: variant.price_cents * quantity };
    const { data, error } = await supabase.rpc("estimate_shipping", args);
    return error ? null : (estimateSchema.safeParse(data).data ?? null);
  };
  let result = await estimate();
  // A CEP seen for the first time is looked up and cached, then priced.
  if (result && !result.city) {
    if (!(await ensureCepLocation(cep))) return { error: "Não encontramos esse CEP. Confira os números." };
    result = await estimate();
  }
  if (!result?.city || !result.state) return { error: "Não foi possível calcular o frete agora." };
  return { city: result.city, state: result.state, options: result.options };
}
