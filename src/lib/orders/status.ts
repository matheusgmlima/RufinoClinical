import type { Enums } from "@/lib/supabase/database.types";

export const ORDER_STATUS_LABEL: Record<Enums<"order_status">, string> = {
  pending_payment: "Aguardando pagamento",
  paid: "Pago",
  preparing: "Em separação",
  shipped: "Enviado",
  delivered: "Entregue",
  canceled: "Cancelado",
  refunded: "Reembolsado",
};

/** Waiting for payment and still within the payment deadline. */
export function isPayable(order: { status: Enums<"order_status">; expires_at: string | null }): boolean {
  return order.status === "pending_payment" && !!order.expires_at && Date.parse(order.expires_at) > Date.now();
}
