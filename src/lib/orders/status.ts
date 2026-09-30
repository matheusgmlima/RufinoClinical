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

export const PAYMENT_METHOD_LABEL: Record<Enums<"payment_method">, string> = {
  pix: "Pix",
  credit_card: "Cartão de crédito",
  boleto: "Boleto",
};

// Statuses written by record_payment (see gateway.ts), as the admin sees them.
export const PAYMENT_STATUS_LABEL: Record<string, string> = {
  pending: "Pendente",
  approved: "Aprovado",
  rejected: "Recusado",
  cancelled: "Cancelado",
  refunded: "Estornado",
  charged_back: "Chargeback",
  in_mediation: "Em disputa",
};

/** Waiting for payment and still within the payment deadline. */
export function isPayable(order: { status: Enums<"order_status">; expires_at: string | null }): boolean {
  return order.status === "pending_payment" && !!order.expires_at && Date.parse(order.expires_at) > Date.now();
}
