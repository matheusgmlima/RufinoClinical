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
