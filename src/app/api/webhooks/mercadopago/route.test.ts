import { createHmac } from "node:crypto";
import { beforeEach, describe, expect, it, vi } from "vitest";

const SECRET = "segredo-do-webhook-123";
const mp = vi.hoisted(() => ({
  getMpOrder: vi.fn(),
  recordPayment: vi.fn(),
  paymentsEnabled: vi.fn(() => true),
  MpError: class MpError extends Error {
    constructor(readonly status: number) {
      super(`Mercado Pago responded ${status}`);
    }
  },
}));
const db = vi.hoisted(() => ({ fresh: true, processedAt: null as string | null, updates: [] as object[] }));

vi.mock("server-only", () => ({}));
vi.mock("@/lib/payments/mercadopago", () => mp);
vi.mock("@/lib/supabase/admin", () => ({
  createAdminClient: () => ({
    from: () => ({
      upsert: () => ({ select: async () => ({ data: db.fresh ? [{ id: 1 }] : [] }) }),
      select: () => ({ match: () => ({ maybeSingle: async () => ({ data: { processed_at: db.processedAt } }) }) }),
      update: (values: object) => ({ match: async () => db.updates.push(values) }),
    }),
  }),
}));
vi.stubEnv("MP_WEBHOOK_SECRET", SECRET);
vi.stubEnv("NEXT_PUBLIC_SITE_URL", "http://localhost:3000");
vi.stubEnv("NEXT_PUBLIC_SUPABASE_URL", "https://proj.supabase.co");
vi.stubEnv("NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY", "sb_publishable_test");
const { POST } = await import("./route");

function notification({ id = "ORD01JP84C939T20S0P1DN382FQ6K", type = "order", signature = "" } = {}) {
  const ts = "1704908010";
  const v1 = createHmac("sha256", SECRET).update(`id:${id.toLowerCase()};request-id:req-1;ts:${ts};`).digest("hex");
  return new Request(`http://localhost/api/webhooks/mercadopago?data.id=${id}&type=${type}`, {
    method: "POST",
    headers: { "x-signature": signature || `ts=${ts},v1=${v1}`, "x-request-id": "req-1" },
    body: JSON.stringify({ action: "order.processed", data: { id } }),
  });
}

beforeEach(() => {
  vi.clearAllMocks();
  Object.assign(db, { fresh: true, processedAt: null, updates: [] });
  mp.paymentsEnabled.mockReturnValue(true);
  mp.getMpOrder.mockResolvedValue({ id: "ORD01JP84C939T20S0P1DN382FQ6K", status: "processed" });
  mp.recordPayment.mockResolvedValue("paid");
});

describe("POST /api/webhooks/mercadopago", () => {
  it("rejects forged notifications without touching orders", async () => {
    const res = await POST(notification({ signature: `ts=1704908010,v1=${"0".repeat(64)}` }));
    expect(res.status).toBe(401);
    expect(mp.getMpOrder).not.toHaveBeenCalled();
  });

  it("refuses to work until payments are configured", async () => {
    mp.paymentsEnabled.mockReturnValue(false);
    expect((await POST(notification())).status).toBe(503);
  });

  it("fetches the order from Mercado Pago and records it", async () => {
    const res = await POST(notification());
    expect(res.status).toBe(200);
    expect(mp.getMpOrder).toHaveBeenCalledWith("ORD01JP84C939T20S0P1DN382FQ6K");
    expect(mp.recordPayment).toHaveBeenCalledWith({ id: "ORD01JP84C939T20S0P1DN382FQ6K", status: "processed" });
    expect(db.updates.at(-1)).toMatchObject({ error: null, processed_at: expect.any(String) });
  });

  it("skips a delivery that was already handled", async () => {
    Object.assign(db, { fresh: false, processedAt: "2026-09-30T12:00:00Z" });
    expect((await POST(notification())).status).toBe(200);
    expect(mp.getMpOrder).not.toHaveBeenCalled();
  });

  it("ignores other topics", async () => {
    expect((await POST(notification({ type: "payment" }))).status).toBe(200);
    expect(mp.getMpOrder).not.toHaveBeenCalled();
  });

  it("flags anomalies for review", async () => {
    mp.recordPayment.mockResolvedValue("mismatch");
    await POST(notification());
    expect(db.updates.at(-1)).toMatchObject({ error: "mismatch" });
  });

  it("asks for a retry when the gateway is down, but not for an order it does not know", async () => {
    mp.getMpOrder.mockRejectedValueOnce(new Error("timeout"));
    expect((await POST(notification())).status).toBe(500);
    expect(db.updates.at(-1)).toMatchObject({ processed_at: null });

    mp.getMpOrder.mockRejectedValueOnce(new mp.MpError(404));
    expect((await POST(notification())).status).toBe(200);
    expect(db.updates.at(-1)).toMatchObject({ processed_at: expect.any(String) });
  });
});
