import { createHmac, timingSafeEqual } from "node:crypto";
import { z } from "zod";

import type { Enums } from "@/lib/supabase/database.types";

// Pure Mercado Pago helpers (no network) for the Orders API, shared by the payment flows and the webhook.

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const REVIEW_HOLD_MS = 2 * 86_400_000; // stock stays reserved while a card payment is under review
const amount = z.string().regex(/^\d{1,9}(\.\d{1,2})?$/);
const httpsUrl = z
  .string()
  .max(500)
  .nullish()
  .transform((url) => (url?.startsWith("https://") ? url : null));

/** The fields of a Mercado Pago order the store uses. Payer and card data are dropped. */
export const mpOrderSchema = z.object({
  id: z.string().regex(/^[A-Za-z0-9]{1,64}$/),
  external_reference: z.string().nullish(),
  transactions: z.object({
    payments: z
      .array(
        z.object({
          status: z.string().max(40),
          status_detail: z.string().max(80).nullish(),
          amount,
          date_of_expiration: z.string().max(40).nullish(),
          payment_method: z.object({
            type: z.string().max(40),
            installments: z.number().int().min(1).max(12).nullish().catch(null),
            qr_code: z.string().max(2000).nullish(),
            qr_code_base64: z
              .string()
              .max(60000)
              .regex(/^[A-Za-z0-9+/=]*$/)
              .nullish(),
            ticket_url: httpsUrl,
            digitable_line: z.string().max(100).nullish(),
          }),
        }),
      )
      .min(1),
  }),
});
export type MpOrder = z.infer<typeof mpOrderSchema>;
type Transaction = MpOrder["transactions"]["payments"][number];

/** What the order page shows for an open payment. Stored in payments.raw and readable by the buyer. */
export type PaymentDisplay = {
  qrCode: string | null;
  qrCodeBase64: string | null;
  boletoUrl: string | null;
  barcode: string | null;
  expiresAt: string | null;
};

const METHODS: Record<string, Enums<"payment_method">> = {
  credit_card: "credit_card",
  bank_transfer: "pix",
  ticket: "boleto",
};

/** Orders API transaction status in the vocabulary of record_payment (SQL). */
function paymentStatus({ status, status_detail }: Transaction): string {
  switch (status) {
    case "processed":
      return "approved";
    case "action_required":
    case "processing":
    case "in_review":
      return "pending";
    case "failed":
      return "rejected";
    case "canceled":
    case "expired":
      return "cancelled";
    case "charged_back":
      // Only a settled chargeback returns the money to the buyer; disputes are handled by hand.
      return status_detail === "settled" ? "charged_back" : "in_mediation";
    default:
      return status;
  }
}

/** Maps a gateway order to the arguments of record_payment, or null if it is not one of ours. */
export function toPaymentRecord(order: MpOrder) {
  const orderId = order.external_reference;
  if (!orderId || !UUID.test(orderId)) return null;
  const tx = order.transactions.payments[0];
  const method = tx.payment_method;
  const reviewing = tx.status === "processing" || tx.status === "in_review";
  const display: PaymentDisplay = {
    qrCode: method.qr_code || null,
    qrCodeBase64: method.qr_code_base64 || null,
    boletoUrl: method.type === "ticket" ? method.ticket_url : null,
    barcode: method.digitable_line || null,
    expiresAt: tx.date_of_expiration ?? null,
  };
  return {
    p_order_id: orderId,
    p_provider_payment_id: order.id,
    p_status: paymentStatus(tx),
    p_status_detail: tx.status_detail ?? null,
    p_method: METHODS[method.type] ?? null,
    p_installments: method.installments ?? null,
    p_amount_cents: Math.round(Number(tx.amount) * 100),
    p_raw: display,
    p_expires_at:
      tx.date_of_expiration ?? (reviewing ? new Date(Date.now() + REVIEW_HOLD_MS).toISOString() : undefined),
  };
}

/**
 * Checks the `x-signature` header of a webhook: HMAC-SHA256 of
 * `id:{data.id};request-id:{x-request-id};ts:{ts};` with the secret from "Suas integrações".
 */
export function verifyWebhookSignature(input: {
  signature: string | null;
  requestId: string | null;
  dataId: string | null;
  secret: string;
}): boolean {
  const parts = new Map(
    (input.signature ?? "").split(",").map((part) => {
      const [key, ...value] = part.split("=");
      return [key.trim(), value.join("=").trim()] as const;
    }),
  );
  const ts = parts.get("ts");
  const v1 = parts.get("v1");
  if (!ts || !/^\d+$/.test(ts) || !v1 || !/^[0-9a-f]{64}$/i.test(v1)) return false;

  const manifest =
    (input.dataId ? `id:${input.dataId.toLowerCase()};` : "") +
    (input.requestId ? `request-id:${input.requestId};` : "") +
    `ts:${ts};`;
  const expected = createHmac("sha256", input.secret).update(manifest).digest();
  return timingSafeEqual(expected, Buffer.from(v1, "hex"));
}

/** Time left as an ISO 8601 duration in whole minutes (the Orders API `expiration_time`). */
export function isoDuration(ms: number): string {
  const minutes = Math.max(0, Math.floor(ms / 60_000));
  const days = Math.floor(minutes / 1440);
  return `P${days ? `${days}D` : ""}T${Math.floor((minutes % 1440) / 60)}H${minutes % 60}M`;
}

/** Cents as the decimal string the Orders API expects. */
export const money = (cents: number) => (cents / 100).toFixed(2);

type ItemSource = {
  total_cents: number;
  shipping_cents: number;
  items: { sku: string; product_name: string; variant_name: string; quantity: number; unit_price_cents: number }[];
};

/**
 * The order's items for Mercado Pago, which refuses items that do not add up to total_amount and
 * negative prices. Products plus shipping add up only without discounts; otherwise none are sent.
 */
export function orderItems(order: ItemSource) {
  const sum = order.items.reduce((total, item) => total + item.unit_price_cents * item.quantity, order.shipping_cents);
  if (sum !== order.total_cents) return {};
  const lines = order.items.map((item) => ({
    title: `${item.product_name} - ${item.variant_name}`.slice(0, 150),
    unit_price: money(item.unit_price_cents),
    quantity: item.quantity,
    external_code: item.sku,
  }));
  if (order.shipping_cents > 0) {
    lines.push({ title: "Frete", unit_price: money(order.shipping_cents), quantity: 1, external_code: "FRETE" });
  }
  return { items: lines };
}

export function splitName(fullName: string) {
  const [first = "", ...rest] = fullName.trim().split(/\s+/);
  return { first_name: first, last_name: rest.join(" ") || first };
}

const REJECTIONS: Record<string, string> = {
  bad_filled_card_data: "Confira os dados do cartão.",
  invalid_card_token: "Confira os dados do cartão e tente de novo.",
  insufficient_amount: "O cartão não tem limite suficiente.",
  card_insufficient_amount: "O cartão não tem limite suficiente.",
  amount_limit_exceeded: "O valor passa do limite do cartão.",
  required_call_for_authorize: "O banco pediu para autorizar este pagamento. Fale com o banco e tente de novo.",
  card_disabled: "O cartão está bloqueado ou inativo. Fale com o banco.",
  invalid_installments: "O cartão não aceita esse número de parcelas.",
  max_attempts_exceeded: "Limite de tentativas atingido neste cartão. Use outro cartão.",
};

export function cardRejectionMessage(statusDetail: string | null | undefined): string {
  return (
    (statusDetail && REJECTIONS[statusDetail]) || "O pagamento não foi aprovado. Tente outro cartão ou pague com Pix."
  );
}
