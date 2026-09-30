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

/** Status as the customer reads it: a courier ride or a pickup is not "sent". */
export function orderStatusLabel(status: Enums<"order_status">, method: Enums<"shipping_method"> = "standard"): string {
  if (method === "local" && status === "shipped") return "Saiu para entrega";
  if (method === "pickup" && status === "shipped") return "Pronto para retirada";
  if (method === "pickup" && status === "delivered") return "Retirado";
  return ORDER_STATUS_LABEL[status];
}

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

/**
 * Status pill colors (admin and customer pages). Each status has its own hue so lists scan at a
 * glance: honey waits for the customer, wine needs the team, nude is in progress, mist travels,
 * sage is done, lilac was refunded, grey ended.
 */
export const ORDER_STATUS_TONE: Record<Enums<"order_status">, string> = {
  pending_payment: "bg-honey text-honey-ink",
  paid: "bg-wine text-cream",
  preparing: "bg-nude text-ink",
  shipped: "bg-mist text-mist-ink",
  delivered: "bg-sage text-sage-ink",
  canceled: "bg-line text-ink",
  refunded: "bg-lilac text-lilac-ink",
};
