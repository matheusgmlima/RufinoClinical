import { createHmac, timingSafeEqual } from "node:crypto";
import { z } from "zod";

import type { Enums } from "@/lib/supabase/database.types";

// Pure Mercado Pago helpers (no network), shared by the payment flows and the webhook.

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const httpsUrl = z
  .string()
  .max(500)
  .nullish()
  .transform((url) => (url?.startsWith("https://") ? url : null));

/** The fields of a Mercado Pago payment the store uses. Everything else (payer, card) is dropped. */
export const mpPaymentSchema = z.object({
  id: z.number().int().positive(),
  status: z.string().max(40),
  status_detail: z.string().max(80).nullish(),
  payment_type_id: z.string().max(40),
  transaction_amount: z.number().positive(),
  currency_id: z.string(),
  installments: z.number().int().min(1).max(12).nullish().catch(null),
  external_reference: z.string().nullish(),
  date_of_expiration: z.string().max(40).nullish(),
  point_of_interaction: z
    .object({
      transaction_data: z
        .object({
          qr_code: z.string().max(2000).nullish(),
          qr_code_base64: z
            .string()
            .max(60000)
            .regex(/^[A-Za-z0-9+/=]+$/)
            .nullish(),
        })
        .nullish(),
    })
    .nullish(),
  transaction_details: z
    .object({ external_resource_url: httpsUrl, digitable_line: z.string().max(100).nullish() })
    .nullish(),
  barcode: z.object({ content: z.string().max(100).nullish() }).nullish(),
});
export type MpPayment = z.infer<typeof mpPaymentSchema>;

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

/** Maps a gateway payment to the arguments of record_payment, or null if it is not one of ours. */
export function toPaymentRecord(payment: MpPayment) {
  const orderId = payment.external_reference;
  if (payment.currency_id !== "BRL" || !orderId || !UUID.test(orderId)) return null;
  const pix = payment.point_of_interaction?.transaction_data;
  const display: PaymentDisplay = {
    qrCode: pix?.qr_code ?? null,
    qrCodeBase64: pix?.qr_code_base64 ?? null,
    boletoUrl: payment.transaction_details?.external_resource_url ?? null,
    barcode: payment.transaction_details?.digitable_line ?? payment.barcode?.content ?? null,
    expiresAt: payment.date_of_expiration ?? null,
  };
  return {
    p_order_id: orderId,
    p_provider_payment_id: String(payment.id),
    p_status: payment.status,
    p_status_detail: payment.status_detail ?? null,
    p_method: METHODS[payment.payment_type_id] ?? null,
    p_installments: payment.installments ?? null,
    p_amount_cents: Math.round(payment.transaction_amount * 100),
    p_raw: display,
    p_expires_at: payment.date_of_expiration ?? undefined,
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

/** Date in the format Mercado Pago expects, in Brasília time (UTC-3, no daylight saving since 2019). */
export function mpDate(date: Date): string {
  return new Date(date.getTime() - 3 * 3_600_000).toISOString().replace("Z", "-03:00");
}

export function splitName(fullName: string) {
  const [first = "", ...rest] = fullName.trim().split(/\s+/);
  return { first_name: first, last_name: rest.join(" ") || first };
}

const REJECTIONS: Record<string, string> = {
  cc_rejected_bad_filled_card_number: "Confira o número do cartão.",
  cc_rejected_bad_filled_date: "Confira a validade do cartão.",
  cc_rejected_bad_filled_security_code: "Confira o código de segurança (CVV).",
  cc_rejected_bad_filled_other: "Confira os dados do cartão.",
  cc_rejected_insufficient_amount: "O cartão não tem limite suficiente.",
  cc_rejected_call_for_authorize: "O banco pediu para autorizar este pagamento. Fale com o banco e tente de novo.",
  cc_rejected_card_disabled: "O cartão está bloqueado ou inativo. Fale com o banco.",
  cc_rejected_duplicated_payment:
    "Um pagamento igual acabou de ser feito. Use outro cartão ou outro meio de pagamento.",
  cc_rejected_invalid_installments: "O cartão não aceita esse número de parcelas.",
  cc_rejected_max_attempts: "Limite de tentativas atingido neste cartão. Use outro cartão.",
};

export function cardRejectionMessage(statusDetail: string | null | undefined): string {
  return (
    (statusDetail && REJECTIONS[statusDetail]) || "O pagamento não foi aprovado. Tente outro cartão ou pague com Pix."
  );
}
