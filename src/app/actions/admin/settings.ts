"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";

import { adminClient } from "@/lib/auth/admin";
import { fieldErrors, type FormState } from "@/lib/forms";
import { parseBRL } from "@/lib/money";
import { REGIONS, type Region } from "@/lib/shipping/regions";

const DENIED: FormState = { status: "error", message: "Acesso negado. Entre de novo no painel." };

const int = (min: number, max: number, message: string) =>
  z.coerce.number({ error: message }).int(message).min(min, message).max(max, message);

const cents = (message: string) =>
  z.string().transform((value, ctx) => {
    const parsed = parseBRL(value);
    if (parsed === null) {
      ctx.issues.push({ code: "custom", message, input: value });
      return z.NEVER;
    }
    return parsed;
  });

const settingsSchema = z
  .object({
    pix_discount_percent: z
      .string()
      .trim()
      .transform((value) => Number(value.replace(",", ".")))
      .refine((value) => Number.isFinite(value) && value >= 0 && value <= 30, "Use de 0 a 30 (%)."),
    max_installments: int(1, 12, "Use de 1 a 12 parcelas."),
    interest_free_installments: int(1, 12, "Use de 1 a 12 parcelas."),
    min_installment_cents: cents("Valor inválido. Exemplo: 30,00."),
    // Blank: no free shipping.
    free_shipping_threshold_cents: z.union([z.literal(""), cents("Valor inválido. Exemplo: 299,00.")]).transform(
      (value) => (value === "" ? null : value),
    ),
  })
  .refine((v) => v.interest_free_installments <= v.max_installments, {
    path: ["interest_free_installments"],
    message: "Não pode passar do máximo de parcelas.",
  })
  .refine((v) => v.min_installment_cents >= 500, {
    path: ["min_installment_cents"],
    message: "A parcela mínima precisa ser de pelo menos R$ 5,00.",
  })
  .transform((v) => ({ ...v, pix_discount_percent: Math.round(v.pix_discount_percent * 100) / 100 }));

/** Checkout rules used by the database when it prices an order (Pix discount, installments, free shipping). */
export async function saveSettings(_prev: FormState, formData: FormData): Promise<FormState> {
  const supabase = await adminClient();
  if (!supabase) return DENIED;
  const text = (name: string) => String(formData.get(name) ?? "");
  const parsed = settingsSchema.safeParse({
    pix_discount_percent: text("pix_discount_percent"),
    max_installments: text("max_installments"),
    interest_free_installments: text("interest_free_installments"),
    min_installment_cents: text("min_installment"),
    free_shipping_threshold_cents: text("free_shipping_threshold").trim(),
  });
  if (!parsed.success) {
    const errors = fieldErrors(parsed.error);
    errors.min_installment ??= errors.min_installment_cents;
    errors.free_shipping_threshold ??= errors.free_shipping_threshold_cents;
    return { status: "error", fieldErrors: errors };
  }

  const { data, error } = await supabase.from("store_settings").update(parsed.data).eq("id", true).select("id");
  if (error || !data?.length) return { status: "error", message: "Não foi possível salvar as configurações." };
  revalidatePath("/admin/configuracoes");
  return { status: "ok", message: "Configurações salvas. Já valem para os próximos pedidos." };
}

const rateSchema = z
  .object({
    price_cents: z.string().transform((value, ctx) => {
      // Zero is a valid price here: free shipping to the region.
      const parsed = value.trim() === "0" || value.trim() === "0,00" ? 0 : parseBRL(value);
      if (parsed === null || parsed > 100000) {
        ctx.issues.push({ code: "custom", message: "Valor inválido.", input: value });
        return z.NEVER;
      }
      return parsed;
    }),
    min_days: int(1, 60, "De 1 a 60 dias."),
    max_days: int(1, 90, "De 1 a 90 dias."),
  })
  .refine((v) => v.max_days >= v.min_days, { path: ["max_days"], message: "Maior que o prazo mínimo." });

type RateValues = z.infer<typeof rateSchema>;
const sameRate = (a: RateValues, b?: RateValues) =>
  !!b && a.price_cents === b.price_cents && a.min_days === b.min_days && a.max_days === b.max_days;

/** Flat shipping price and delivery window per region of Brazil. */
export async function saveShippingRates(_prev: FormState, formData: FormData): Promise<FormState> {
  const supabase = await adminClient();
  if (!supabase) return DENIED;

  const rates: ({ region: Region } & RateValues)[] = [];
  const errors: Record<string, string> = {};
  for (const region of REGIONS) {
    const parsed = rateSchema.safeParse({
      price_cents: String(formData.get(`${region}-price`) ?? ""),
      min_days: String(formData.get(`${region}-min`) ?? ""),
      max_days: String(formData.get(`${region}-max`) ?? ""),
    });
    if (parsed.success) rates.push({ region, ...parsed.data });
    else {
      const names = { price_cents: "price", min_days: "min", max_days: "max" } as const;
      for (const [key, message] of Object.entries(fieldErrors(parsed.error))) {
        errors[`${region}-${names[key as keyof typeof names]}`] = message;
      }
    }
  }
  if (Object.keys(errors).length) return { status: "error", fieldErrors: errors };

  // Only regions that changed, so the audit log shows real edits.
  const { data: current } = await supabase.from("shipping_rates").select("region, price_cents, min_days, max_days");
  const changed = rates.filter((rate) => !sameRate(rate, current?.find((c) => c.region === rate.region)));
  for (const { region, ...values } of changed) {
    const { data, error } = await supabase.from("shipping_rates").update(values).eq("region", region).select("region");
    if (error || !data?.length) return { status: "error", message: "Não foi possível salvar o frete." };
  }
  revalidatePath("/admin/configuracoes");
  return { status: "ok", message: "Frete salvo. Já vale para os próximos pedidos." };
}
