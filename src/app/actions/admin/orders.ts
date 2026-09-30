"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";

import { adminClient } from "@/lib/auth/admin";
import { notifyOrder } from "@/lib/email/notify";
import { getSessionUser } from "@/lib/auth/session";
import {
  getMpOrder,
  MpError,
  paymentsEnabled,
  recordPayment,
  refundMpOrder,
  voidOpenCharges,
} from "@/lib/payments/mercadopago";
import type { Enums } from "@/lib/supabase/database.types";

export type ActionResult = { error?: string; notice?: string };

const orderId = z.uuid();
// Carrier tracking codes (Correios: AA123456789BR; others vary), normalized to upper case.
const tracking = z
  .string()
  .trim()
  .toUpperCase()
  .regex(/^[A-Z0-9-]{5,40}$/, "Código de rastreio inválido.");
const step = z.discriminatedUnion("to", [
  z.object({ to: z.literal("preparing") }),
  z.object({ to: z.literal("shipped"), tracking }),
  z.object({ to: z.literal("delivered") }),
  z.object({ to: z.literal("canceled") }),
]);
const REFUNDABLE: Enums<"order_status">[] = ["paid", "preparing", "shipped", "delivered"];

function refresh(id: string) {
  revalidatePath(`/admin/pedidos/${id}`);
  revalidatePath("/admin/pedidos");
  revalidatePath("/admin");
}

/**
 * Moves an order along its fulfilment steps. The SQL state machine is the authority: it rejects
 * skipped steps, shipping without tracking and canceling anything already paid (that is a refund).
 */
export async function advanceOrder(id: string, input: unknown): Promise<ActionResult> {
  const supabase = await adminClient();
  const parsed = step.safeParse(input);
  if (!supabase || !orderId.safeParse(id).success) return { error: "Acesso negado. Entre de novo no painel." };
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? "Dados inválidos." };

  const change = parsed.data;
  const values =
    change.to === "shipped" ? { status: change.to, shipping_tracking_code: change.tracking } : { status: change.to };
  const { data, error } = await supabase.from("orders").update(values).eq("id", id).select("id");
  if (error || !data?.length)
    return { error: "Não foi possível mudar o status. Atualize a página e confira o pedido." };
  if (change.to === "canceled") await voidOpenCharges(supabase, id);
  if (change.to === "shipped") notifyOrder("shipped", id);
  refresh(id);
  return {};
}

export async function saveOrderNotes(id: string, notes: unknown): Promise<ActionResult> {
  const supabase = await adminClient();
  const parsed = z.string().trim().max(500).safeParse(notes);
  if (!supabase || !orderId.safeParse(id).success) return { error: "Acesso negado. Entre de novo no painel." };
  if (!parsed.success) return { error: "Use no máximo 500 caracteres." };
  const { error } = await supabase
    .from("orders")
    .update({ notes: parsed.data || null })
    .eq("id", id);
  if (error) return { error: "Não foi possível salvar as observações." };
  refresh(id);
  return { notice: "Observações salvas." };
}

/**
 * Full refund at Mercado Pago. The order turns "refunded" through record_payment once the gateway
 * confirms (now, or later by webhook); stock returns automatically if it had not shipped.
 */
export async function refundOrder(id: string): Promise<ActionResult> {
  const supabase = await adminClient();
  if (!supabase || !orderId.safeParse(id).success) return { error: "Acesso negado. Entre de novo no painel." };
  if (!paymentsEnabled()) return { error: "Os pagamentos não estão configurados." };

  const { data: order } = await supabase.from("orders").select("status, gateway_payment_id").eq("id", id).maybeSingle();
  if (!order?.gateway_payment_id || !REFUNDABLE.includes(order.status)) {
    return { error: "Este pedido não tem pagamento aprovado para estornar." };
  }

  try {
    console.info("admin refund requested", { orderId: id, adminId: (await getSessionUser())?.id });
    await refundMpOrder(order.gateway_payment_id);
    const outcome = await recordPayment(await getMpOrder(order.gateway_payment_id));
    refresh(id);
    return {
      notice:
        outcome === "refunded"
          ? "Reembolso feito. O valor volta ao cliente pelo mesmo meio de pagamento."
          : "Reembolso pedido ao Mercado Pago. O status muda aqui quando ele confirmar.",
    };
  } catch (err) {
    console.error("admin refund failed", err);
    return {
      error:
        err instanceof MpError && err.status < 500
          ? "O Mercado Pago recusou o reembolso. Confira o pagamento no painel do Mercado Pago."
          : "O Mercado Pago não respondeu. Tente de novo em instantes.",
    };
  }
}
