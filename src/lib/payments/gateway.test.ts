import { createHmac } from "node:crypto";
import { describe, expect, it } from "vitest";

import {
  cardRejectionMessage,
  isoDuration,
  mpOrderSchema,
  splitName,
  toPaymentRecord,
  verifyWebhookSignature,
} from "./gateway";

const ORDER = "7e57c0de-0000-4000-8000-0000000000aa";

function sign(manifest: string, secret = "segredo-do-webhook") {
  return createHmac("sha256", secret).update(manifest).digest("hex");
}

function mpOrder(status: string, statusDetail: string, method: Record<string, unknown>, extra = {}) {
  return mpOrderSchema.parse({
    id: "ORD01JP84C939T20S0P1DN382FQ6K",
    external_reference: ORDER,
    total_amount: "37.90",
    payer: { email: "cliente@example.com", identification: { number: "52998224725" } },
    transactions: {
      payments: [
        { id: "PAY01", status, status_detail: statusDetail, amount: "37.90", payment_method: method, ...extra },
      ],
    },
  });
}

describe("verifyWebhookSignature", () => {
  const secret = "segredo-do-webhook";
  const v1 = sign("id:ord01abc;request-id:req-1;ts:1742505638683;");
  const base = { signature: `ts=1742505638683,v1=${v1}`, requestId: "req-1", dataId: "ORD01ABC", secret };

  it("accepts the signature Mercado Pago computes (order ids are lowercased)", () => {
    expect(verifyWebhookSignature(base)).toBe(true);
  });

  it("rejects a wrong secret, a tampered id or a replayed timestamp", () => {
    expect(verifyWebhookSignature({ ...base, secret: "outro-segredo-qualquer" })).toBe(false);
    expect(verifyWebhookSignature({ ...base, dataId: "ORD01XYZ" })).toBe(false);
    expect(verifyWebhookSignature({ ...base, signature: `ts=1742505638684,v1=${v1}` })).toBe(false);
  });

  it("rejects missing or malformed headers", () => {
    expect(verifyWebhookSignature({ ...base, signature: null })).toBe(false);
    expect(verifyWebhookSignature({ ...base, signature: "ts=1742505638683" })).toBe(false);
    expect(verifyWebhookSignature({ ...base, signature: "ts=abc,v1=zz" })).toBe(false);
  });

  it("leaves absent parts out of the manifest", () => {
    const signature = `ts=1,v1=${sign("id:ord01abc;ts:1;")}`;
    expect(verifyWebhookSignature({ ...base, signature, requestId: null })).toBe(true);
  });
});

describe("toPaymentRecord", () => {
  const pix = mpOrder(
    "action_required",
    "waiting_transfer",
    { id: "pix", type: "bank_transfer", qr_code: "000201...", qr_code_base64: "iVBORw0KGgo=" },
    { date_of_expiration: "2026-09-30T15:00:00.000-03:00" },
  );

  it("maps a waiting Pix to record_payment arguments, in cents", () => {
    expect(toPaymentRecord(pix)).toMatchObject({
      p_order_id: ORDER,
      p_provider_payment_id: "ORD01JP84C939T20S0P1DN382FQ6K",
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

  it("ignores orders that are not ours", () => {
    expect(toPaymentRecord({ ...pix, external_reference: "pedido-123" })).toBeNull();
  });

  it("translates Orders statuses", () => {
    const card = { id: "master", type: "credit_card", installments: 3 };
    expect(toPaymentRecord(mpOrder("processed", "accredited", card))).toMatchObject({
      p_status: "approved",
      p_method: "credit_card",
      p_installments: 3,
    });
    expect(toPaymentRecord(mpOrder("failed", "insufficient_amount", card))?.p_status).toBe("rejected");
    expect(toPaymentRecord(mpOrder("expired", "expired", card))?.p_status).toBe("cancelled");
    expect(toPaymentRecord(mpOrder("charged_back", "settled", card))?.p_status).toBe("charged_back");
    expect(toPaymentRecord(mpOrder("charged_back", "in_process", card))?.p_status).toBe("in_mediation");
    expect(toPaymentRecord(mpOrder("processed", "accredited", { ...card, type: "debit_card" }))?.p_method).toBeNull();
  });

  it("keeps the stock reserved while a card is under review", () => {
    const record = toPaymentRecord(mpOrder("processing", "in_review", { id: "visa", type: "credit_card" }));
    expect(record?.p_status).toBe("pending");
    expect(Date.parse(record!.p_expires_at!)).toBeGreaterThan(Date.now() + 86_400_000);
  });

  it("keeps the boleto link and line, and drops non-https links", () => {
    const boleto = { id: "boleto", type: "ticket", ticket_url: "https://mp.com/b/1", digitable_line: "23790.00000" };
    expect(toPaymentRecord(mpOrder("action_required", "waiting_payment", boleto))).toMatchObject({
      p_method: "boleto",
      p_raw: { boletoUrl: "https://mp.com/b/1", barcode: "23790.00000" },
    });
    const unsafe = mpOrder("action_required", "waiting_payment", { ...boleto, ticket_url: "javascript:alert(1)" });
    expect(toPaymentRecord(unsafe)?.p_raw.boletoUrl).toBeNull();
  });
});

describe("helpers", () => {
  it("writes the time left as an ISO 8601 duration", () => {
    expect(isoDuration(59 * 60_000 + 30_000)).toBe("PT0H59M");
    expect(isoDuration(3 * 86_400_000 - 60_000)).toBe("P2DT23H59M");
  });

  it("splits names for the payer", () => {
    expect(splitName("  Maria da Silva ")).toEqual({ first_name: "Maria", last_name: "da Silva" });
    expect(splitName("Maria")).toEqual({ first_name: "Maria", last_name: "Maria" });
  });

  it("explains card rejections without leaking codes", () => {
    expect(cardRejectionMessage("insufficient_amount")).toBe("O cartão não tem limite suficiente.");
    expect(cardRejectionMessage("high_risk")).toContain("não foi aprovado");
    expect(cardRejectionMessage(null)).toContain("não foi aprovado");
  });
});
