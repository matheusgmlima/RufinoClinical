"use server";

import { z } from "zod";

import { getSessionUser } from "@/lib/auth/session";
import { cartSchema } from "@/lib/cart/schema";
import { createPixOrBoleto, loadPayableOrder, paymentsEnabled } from "@/lib/payments/mercadopago";
import { createClient } from "@/lib/supabase/server";
import { isValidDocument, onlyDigits } from "@/lib/validation/br";

// The browser sends only choices (items, address, method, coupon). Every amount comes from
// quote_order/create_order in the database.
const checkoutSchema = z.object({
  items: cartSchema.min(1),
  addressId: z.uuid(),
  method: z.enum(["pix", "credit_card", "boleto"]),
  coupon: z
    .string()
    .trim()
    .toUpperCase()
    .max(30)
    .regex(/^[A-Z0-9_-]*$/),
});

const int = z.number().int();
const quoteSchema = z.object({
  lines: z.array(z.object({ product_name: z.string(), variant_name: z.string(), quantity: int, total_cents: int })),
  problems: z.array(z.object({ problem: z.string(), available: int.optional(), min_subtotal_cents: int.optional() })),
  subtotal_cents: int,
  discount_cents: int,
  payment_discount_cents: int,
  shipping_cents: int.nullable(),
  shipping_min_days: int.nullable(),
  shipping_max_days: int.nullable(),
  total_cents: int,
  coupon_code: z.string().nullable(),
});
export type CheckoutQuote = z.infer<typeof quoteSchema>;

function rpcArgs({ items, addressId, method, coupon }: z.infer<typeof checkoutSchema>) {
  return {
    p_items: items.map((item) => ({ variant_id: item.variantId, quantity: item.quantity })),
    p_address_id: addressId,
    p_payment_method: method,
    p_coupon_code: coupon || undefined,
  };
}

export async function quoteCheckout(input: unknown): Promise<CheckoutQuote | null> {
  const parsed = checkoutSchema.safeParse(input);
  if (!parsed.success || !(await getSessionUser())) return null;
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("quote_order", rpcArgs(parsed.data));
  return error ? null : (quoteSchema.safeParse(data).data ?? null);
}

const ORDER_ERRORS: Record<string, string> = {
  too_many_pending_orders: "Você já tem 3 pedidos aguardando pagamento. Pague ou cancele um deles em Meus pedidos.",
  document_required: "Informe seu CPF ou CNPJ.",
  address_not_found: "Escolha um endereço de entrega.",
  order_has_problems: "Algum item mudou de preço ou de estoque. Confira o resumo e tente de novo.",
};

const placeSchema = checkoutSchema.extend({
  document: z
    .string()
    .transform(onlyDigits)
    .refine((v) => v === "" || isValidDocument(v)),
});

export async function placeOrder(input: unknown): Promise<{ orderId: string } | { error: string }> {
  const user = await getSessionUser();
  if (!user) return { error: "Sua sessão expirou. Entre novamente." };
  if (!paymentsEnabled()) return { error: "Os pagamentos ainda estão sendo configurados. Tente mais tarde." };
  const parsed = placeSchema.safeParse(input);
  if (!parsed.success) return { error: "Confira os dados do pedido." };

  const supabase = await createClient();
  if (parsed.data.document) {
    // RLS limits the update to the buyer's own profile; column grants to these fields.
    const { error } = await supabase.from("profiles").update({ document: parsed.data.document }).eq("id", user.id);
    if (error) return { error: "Não foi possível salvar o CPF ou CNPJ." };
  }

  const { data, error } = await supabase.rpc("create_order", rpcArgs(parsed.data));
  if (error) return { error: ORDER_ERRORS[error.message] ?? "Não foi possível criar o pedido. Tente de novo." };
  const orderId = z.object({ order_id: z.uuid() }).safeParse(data).data?.order_id;
  if (!orderId) return { error: "Não foi possível criar o pedido. Tente de novo." };

  // Pix and boleto are generated right away; if the gateway is slow, the order page offers a retry.
  if (parsed.data.method !== "credit_card") {
    const order = await loadPayableOrder(supabase, orderId);
    if (order) await createPixOrBoleto(order).catch((err) => console.error("payment start failed", err));
  }
  return { orderId };
}
