"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";

import { adminClient } from "@/lib/auth/admin";
import { saoPauloDay } from "@/lib/dates";
import { fieldErrors, type FormState } from "@/lib/forms";
import { parseBRL } from "@/lib/money";

// The redemption counter is not writable (column grants); create_order increments it.

const DENIED: FormState = { status: "error", message: "Acesso negado. Entre de novo no painel." };
const uuid = z.uuid();

const day = (message: string, dayAfter = false) =>
  z.string().transform((value, ctx) => {
    if (!value) return null;
    const iso = saoPauloDay(value, { dayAfter });
    if (!iso) {
      ctx.issues.push({ code: "custom", message, input: value });
      return z.NEVER;
    }
    return iso;
  });

const couponSchema = z.object({
  code: z
    .string()
    .trim()
    .toUpperCase()
    .regex(/^[A-Z0-9_-]{3,30}$/, "Use de 3 a 30 letras sem acento, números, - ou _."),
  discount_type: z.enum(["percent", "fixed"], { error: "Escolha o tipo de desconto." }),
  starts_at: day("Data de início inválida."),
  // Valid through the whole last day: stored as the start of the next one (exclusive).
  ends_at: day("Data final inválida.", true),
  max_redemptions: z
    .string()
    .trim()
    .transform((value) => (value ? Number(value) : null))
    .refine((value) => value === null || (Number.isInteger(value) && value > 0 && value <= 1000000), {
      message: "Use um número inteiro maior que zero, ou deixe em branco.",
    }),
  is_active: z.boolean(),
});

/** Percent (1–100) or an amount in reais, depending on the type. */
function discountValue(type: string, input: string): number | null {
  if (type !== "fixed") {
    const percent = Number(input.trim());
    return Number.isInteger(percent) && percent >= 1 && percent <= 100 ? percent : null;
  }
  return parseBRL(input);
}

function refresh() {
  revalidatePath("/admin/cupons");
}

/** Creates a coupon (couponId null) or edits one. */
export async function saveCoupon(couponId: string | null, _prev: FormState, formData: FormData): Promise<FormState> {
  const supabase = await adminClient();
  if (!supabase || (couponId && !uuid.safeParse(couponId).success)) return DENIED;
  const text = (name: string) => String(formData.get(name) ?? "");
  const parsed = couponSchema.safeParse({
    code: text("code"),
    discount_type: text("discount_type"),
    starts_at: text("starts_at"),
    ends_at: text("ends_at"),
    max_redemptions: text("max_redemptions"),
    is_active: formData.get("is_active") === "on",
  });
  // Amounts and the date order are checked here too, so every problem shows at once.
  const errors = parsed.success ? {} : fieldErrors(parsed.error);
  const value = discountValue(text("discount_type"), text("discount_value"));
  if (value === null) {
    errors.discount_value = text("discount_type") === "fixed" ? "Valor inválido. Exemplo: 20,00." : "Use de 1 a 100 (%).";
  }
  const minimum = text("min_subtotal").trim() ? parseBRL(text("min_subtotal")) : 0;
  if (minimum === null) errors.min_subtotal = "Valor inválido. Exemplo: 150,00.";
  const start = saoPauloDay(text("starts_at"));
  const end = saoPauloDay(text("ends_at"), { dayAfter: true });
  if (start && end && end <= start) errors.ends_at = "A data final precisa ser depois do início.";
  if (!parsed.success || value === null || minimum === null || Object.keys(errors).length) {
    return { status: "error", fieldErrors: errors };
  }
  const values = { ...parsed.data, discount_value: value, min_subtotal_cents: minimum };

  const { data, error } = couponId
    ? await supabase.from("coupons").update(values).eq("id", couponId).select("id")
    : await supabase.from("coupons").insert(values).select("id");
  if (error?.code === "23505") return { status: "error", fieldErrors: { code: "Já existe um cupom com este código." } };
  if (error || !data?.length) return { status: "error", message: "Não foi possível salvar o cupom." };

  refresh();
  return { status: "ok", message: couponId ? "Cupom salvo." : "Cupom criado." };
}

/** Only unused coupons can be deleted; used ones stay for the order history and are deactivated. */
export async function deleteCoupon(couponId: string): Promise<FormState> {
  const supabase = await adminClient();
  if (!supabase || !uuid.safeParse(couponId).success) return DENIED;
  const { data, error } = await supabase
    .from("coupons")
    .delete()
    .eq("id", couponId)
    .eq("redemptions_count", 0)
    .select("id");
  if (error) return { status: "error", message: "Não foi possível excluir o cupom." };
  if (!data?.length) {
    return { status: "error", message: "Este cupom já foi usado em pedidos. Desmarque “Ativo” para encerrá-lo." };
  }
  refresh();
  return { status: "ok", message: "Cupom excluído." };
}
