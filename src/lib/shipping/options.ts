import { z } from "zod";

import { formatBRL } from "@/lib/money";
import type { Enums } from "@/lib/supabase/database.types";

export type ShippingMethod = Enums<"shipping_method">;
export const SHIPPING_METHODS = ["standard", "local", "pickup"] as const satisfies readonly ShippingMethod[];

// One entry of private.shipping_options (quote_order and estimate_shipping).
const int = z.number().int();
export const shippingOptionSchema = z.object({
  method: z.enum(SHIPPING_METHODS),
  price_cents: int,
  min_days: int.optional(),
  max_days: int.optional(),
  cutoff: z
    .string()
    .regex(/^\d{2}:\d{2}$/)
    .optional(),
});
export type ShippingOption = z.infer<typeof shippingOptionSchema>;

export const SHIPPING_METHOD_LABEL: Record<ShippingMethod, string> = {
  standard: "Entrega pelos Correios ou transportadora",
  local: "Entrega no mesmo dia (motoboy)",
  pickup: "Retirar na loja",
};

// Nearby buyers see the courier first: it is what the store offers them over the carrier.
const ORDER: Record<ShippingMethod, number> = { local: 0, pickup: 1, standard: 2 };

export function sortShippingOptions(options: ShippingOption[]): ShippingOption[] {
  return options.toSorted((a, b) => ORDER[a.method] - ORDER[b.method]);
}

/** Short tag for order lists. */
export const SHIPPING_METHOD_SHORT: Record<ShippingMethod, string> = {
  standard: "Correios/transportadora",
  local: "Motoboy",
  pickup: "Retirada",
};

/** "16:00" -> "16h", "16:30" -> "16h30". */
export function formatCutoff(cutoff: string): string {
  const [hours, minutes] = cutoff.split(":");
  return `${Number(hours)}h${minutes === "00" ? "" : minutes}`;
}

export function shippingPrice(option: ShippingOption): string {
  return option.price_cents === 0 ? "Grátis" : formatBRL(option.price_cents);
}

/** When it arrives, in one line. */
export function shippingDetail(option: ShippingOption): string {
  switch (option.method) {
    case "local":
      return `Chega hoje com pagamento confirmado até ${formatCutoff(option.cutoff ?? "16:00")} em dia útil. Depois disso, no dia útil seguinte.`;
    case "pickup":
      return "Avisamos quando estiver pronto para retirar.";
    default:
      return option.min_days && option.max_days
        ? `${option.min_days} a ${option.max_days} dias úteis após a postagem.`
        : "Prazo informado na postagem.";
  }
}
