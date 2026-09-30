"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";

import { getSessionUser } from "@/lib/auth/session";
import { cardRejectionMessage } from "@/lib/payments/gateway";
import {
  cancelMpOrder,
  createCardPayment,
  createPixOrBoleto,
  loadPayableOrder,
  MpError,
  paymentsEnabled,
} from "@/lib/payments/mercadopago";
import { createClient } from "@/lib/supabase/server";
import { isValidDocument, onlyDigits } from "@/lib/validation/br";

const MAX_DECLINES_PER_DAY = 5; // per customer: stops card-testing with stolen cards
const REVIEWING = "O Mercado Pago está analisando o pagamento. Esta página atualiza sozinha com a resposta.";

async function payableOrder(orderId: string) {
  if (!z.uuid().safeParse(orderId).success || !paymentsEnabled() || !(await getSessionUser())) return null;
  const supabase = await createClient();
  const order = await loadPayableOrder(supabase, orderId);
  return order ? { supabase, order } : null;
}

/** Generates (again) the Pix code or boleto of an unpaid order. */
export async function generatePayment(orderId: string): Promise<{ error?: string }> {
  const found = await payableOrder(orderId);
  if (!found || found.order.payment_method === "credit_card") return { error: "Este pedido não pode mais ser pago." };
  // A code already waiting for payment is reused, never duplicated (RLS: own payments only).
  const { count } = await found.supabase
    .from("payments")
    .select("id", { count: "exact", head: true })
    .eq("order_id", orderId)
    .eq("status", "pending");
  if (count) return {};
  try {
    if (!(await createPixOrBoleto(found.order))) {
      return { error: "O prazo deste pedido está acabando. Cancele e faça um novo pedido." };
    }
  } catch (err) {
    console.error("payment start failed", err);
    return { error: "O Mercado Pago não respondeu. Tente de novo em instantes." };
  }
  revalidatePath(`/pedido/${orderId}`);
  return {};
}

// What the card form (Card Payment Brick) sends. The amount it holds is ignored.
const cardSchema = z.object({
  token: z.string().min(8).max(200),
  payment_method_id: z.string().regex(/^[a-z_]{2,30}$/),
  installments: z.number().int().min(1).max(12),
  payer: z.object({
    email: z.email().max(254),
    identification: z.object({
      type: z.enum(["CPF", "CNPJ"]),
      number: z.string().transform(onlyDigits).refine(isValidDocument),
    }),
  }),
});

export async function payWithCard(orderId: string, input: unknown): Promise<{ approved: boolean; message?: string }> {
  const card = cardSchema.safeParse(input);
  const found = card.success ? await payableOrder(orderId) : null;
  if (!card.success || !found || found.order.payment_method !== "credit_card") {
    return { approved: false, message: "Não foi possível pagar este pedido. Atualize a página." };
  }

  // RLS limits the count to the buyer's own payments.
  const { count } = await found.supabase
    .from("payments")
    .select("id", { count: "exact", head: true })
    .eq("method", "credit_card")
    .eq("status", "rejected")
    .gte("created_at", new Date(Date.now() - 86_400_000).toISOString());
  if ((count ?? 0) >= MAX_DECLINES_PER_DAY) {
    return { approved: false, message: "Muitos cartões recusados hoje. Pague com Pix ou boleto, ou tente amanhã." };
  }

  try {
    const { outcome, status, statusDetail } = await createCardPayment(found.order, card.data);
    revalidatePath(`/pedido/${orderId}`);
    if (outcome === "paid" || outcome === "already_paid") return { approved: true };
    if (status === "processing" || status === "in_review") return { approved: false, message: REVIEWING };
    if (status !== "processed") return { approved: false, message: cardRejectionMessage(statusDetail) };
    // Approved, but the order could not take it (e.g. canceled meanwhile): see recordPayment.
    return { approved: false, message: "Não foi possível confirmar este pedido. O valor cobrado será estornado." };
  } catch (err) {
    console.error("card payment failed", err);
    if (err instanceof MpError && err.status < 500) {
      return { approved: false, message: "Não foi possível usar este cartão. Confira os dados e tente de novo." };
    }
    // Timeout or gateway error: the charge may still go through and would arrive by webhook.
    return {
      approved: false,
      message: "Não conseguimos confirmar o pagamento. Aguarde alguns minutos antes de tentar de novo.",
    };
  }
}

/**
 * The buyer gives up on an unpaid order; its items go back to stock (cancel_order in SQL) and a
 * Pix code or boleto still open is voided. One paid anyway arrives by webhook and is refunded.
 */
export async function cancelOrder(orderId: string): Promise<void> {
  if (!z.uuid().safeParse(orderId).success || !(await getSessionUser())) return;
  const supabase = await createClient();
  const { data: canceled } = await supabase.rpc("cancel_order", { p_order_id: orderId });
  if (canceled && paymentsEnabled()) {
    const { data: open } = await supabase
      .from("payments")
      .select("provider_payment_id")
      .eq("order_id", orderId)
      .eq("status", "pending");
    await Promise.all(
      (open ?? []).map(({ provider_payment_id }) =>
        cancelMpOrder(provider_payment_id).catch((err) => console.error("gateway cancel failed", err)),
      ),
    );
  }
  revalidatePath(`/pedido/${orderId}`);
}
