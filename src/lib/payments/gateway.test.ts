import { createHmac } from "node:crypto";
import { describe, expect, it } from "vitest";

import {
  cardRejectionMessage,
  mpDate,
  mpPaymentSchema,
  splitName,
  toPaymentRecord,
  verifyWebhookSignature,
} from "./gateway";

const ORDER = "7e57c0de-0000-4000-8000-0000000000aa";

function sign(manifest: string, secret = "segredo-do-webhook") {
  return createHmac("sha256", secret).update(manifest).digest("hex");
}

describe("verifyWebhookSignature", () => {
  const secret = "segredo-do-webhook";
  const v1 = sign("id:123456;request-id:req-1;ts:1704908010;");

  it("accepts the signature Mercado Pago computes", () => {
    expect(
      verifyWebhookSignature({ signature: `ts=1704908010,v1=${v1}`, requestId: "req-1", dataId: "123456", secret }),
    ).toBe(true);
  });

  it("rejects a wrong secret, a tampered id or a replayed timestamp", () => {
    const base = { signature: `ts=1704908010,v1=${v1}`, requestId: "req-1", dataId: "123456", secret };
    expect(verifyWebhookSignature({ ...base, secret: "outro-segredo-qualquer" })).toBe(false);
    expect(verifyWebhookSignature({ ...base, dataId: "999999" })).toBe(false);
    expect(verifyWebhookSignature({ ...base, signature: `ts=1704908011,v1=${v1}` })).toBe(false);
  });

  it("rejects missing or malformed headers", () => {
    const base = { requestId: "req-1", dataId: "123456", secret };
    expect(verifyWebhookSignature({ ...base, signature: null })).toBe(false);
    expect(verifyWebhookSignature({ ...base, signature: "ts=1704908010" })).toBe(false);
    expect(verifyWebhookSignature({ ...base, signature: "ts=abc,v1=zz" })).toBe(false);
  });

  it("lowercases alphanumeric ids and leaves absent parts out of the manifest", () => {
    const signature = `ts=1,v1=${sign("id:ord01abc;ts:1;")}`;
    expect(verifyWebhookSignature({ signature, requestId: null, dataId: "ORD01ABC", secret })).toBe(true);
  });
});

describe("toPaymentRecord", () => {
  const pix = mpPaymentSchema.parse({
    id: 5466310457,
    status: "pending",
    status_detail: "pending_waiting_transfer",
    payment_type_id: "bank_transfer",
    payment_method_id: "pix",
    transaction_amount: 37.9,
    currency_id: "BRL",
    installments: 1,
    external_reference: ORDER,
    date_of_expiration: "2026-09-30T15:00:00.000-03:00",
    point_of_interaction: { transaction_data: { qr_code: "000201...", qr_code_base64: "iVBORw0KGgo=" } },
    payer: { email: "cliente@example.com", identification: { number: "52998224725" } },
  });

  it("maps a pending Pix to record_payment arguments, in cents", () => {
    expect(toPaymentRecord(pix)).toMatchObject({
      p_order_id: ORDER,
      p_provider_payment_id: "5466310457",
      p_status: "pending",
      p_method: "pix",
      p_amount_cents: 3790,
      p_expires_at: "2026-09-30T15:00:00.000-03:00",
      p_raw: { qrCode: "000201...", qrCodeBase64: "iVBORw0KGgo=", boletoUrl: null },
    });
  });

  it("never keeps payer data", () => {
    expect(JSON.stringify(toPaymentRecord(pix))).not.toContain("52998224725");
  });

  it("ignores payments that are not ours", () => {
    expect(toPaymentRecord({ ...pix, external_reference: "pedido-123" })).toBeNull();
    expect(toPaymentRecord({ ...pix, currency_id: "USD" })).toBeNull();
  });

  it("maps boleto and card types and drops non-https links", () => {
    const boleto = mpPaymentSchema.parse({
      ...pix,
      payment_type_id: "ticket",
      transaction_details: { external_resource_url: "javascript:alert(1)", digitable_line: "23790.00000" },
    });
    expect(toPaymentRecord(boleto)).toMatchObject({
      p_method: "boleto",
      p_raw: { boletoUrl: null, barcode: "23790.00000" },
    });
    expect(toPaymentRecord({ ...pix, payment_type_id: "credit_card" })?.p_method).toBe("credit_card");
    expect(toPaymentRecord({ ...pix, payment_type_id: "debit_card" })?.p_method).toBeNull();
  });
});

describe("helpers", () => {
  it("formats dates in Brasília time", () => {
    expect(mpDate(new Date("2026-09-30T18:00:00Z"))).toBe("2026-09-30T15:00:00.000-03:00");
  });

  it("splits names for the payer", () => {
    expect(splitName("  Maria da Silva ")).toEqual({ first_name: "Maria", last_name: "da Silva" });
    expect(splitName("Maria")).toEqual({ first_name: "Maria", last_name: "Maria" });
  });

  it("explains card rejections without leaking codes", () => {
    expect(cardRejectionMessage("cc_rejected_insufficient_amount")).toBe("O cartão não tem limite suficiente.");
    expect(cardRejectionMessage("cc_rejected_high_risk")).toContain("não foi aprovado");
    expect(cardRejectionMessage(null)).toContain("não foi aprovado");
  });
});
