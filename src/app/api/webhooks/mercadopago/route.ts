import { serverEnv } from "@/lib/env/server";
import { verifyWebhookSignature } from "@/lib/payments/gateway";
import { getMpPayment, MpError, paymentsEnabled, recordPayment } from "@/lib/payments/mercadopago";
import { createAdminClient } from "@/lib/supabase/admin";
import type { Json } from "@/lib/supabase/database.types";

const MAX_BODY_BYTES = 16_384;
const NORMAL_OUTCOMES = new Set(["paid", "already_paid", "refunded", "recorded"]);
const reply = (status: number) => new Response(null, { status });

/**
 * Mercado Pago payment notifications (configured in "Suas integrações" → Webhooks).
 * A notification only says "payment X changed": the payment itself is always fetched from the
 * API, so a forged or replayed call cannot mark anything paid. Any status other than 200 makes
 * Mercado Pago retry later.
 */
export async function POST(request: Request) {
  const secret = serverEnv.MP_WEBHOOK_SECRET;
  if (!secret || !paymentsEnabled()) return reply(503);

  const url = new URL(request.url);
  const dataId = url.searchParams.get("data.id");
  const requestId = request.headers.get("x-request-id");
  if (!verifyWebhookSignature({ signature: request.headers.get("x-signature"), requestId, dataId, secret })) {
    return reply(401);
  }
  if (url.searchParams.get("type") !== "payment" || !dataId || !/^\d{1,20}$/.test(dataId)) return reply(200);
  if (Number(request.headers.get("content-length") ?? 0) > MAX_BODY_BYTES) return reply(413);

  let payload: { [key: string]: Json | undefined } = {};
  try {
    const parsed: unknown = JSON.parse((await request.text()).slice(0, MAX_BODY_BYTES));
    if (parsed && typeof parsed === "object" && !Array.isArray(parsed)) payload = parsed as typeof payload;
  } catch {
    // The body is informative only; the signed query string is what matters.
  }

  // Logged before processing: idempotency (a handled delivery is skipped) and audit trail.
  const admin = createAdminClient();
  const event = { provider: "mercadopago", event_key: `${dataId}:${String(payload.id ?? requestId)}` };
  const { data: inserted } = await admin
    .from("webhook_events")
    .upsert({ ...event, type: "payment", payload }, { onConflict: "provider,event_key", ignoreDuplicates: true })
    .select("id");
  if (!inserted?.length) {
    const { data: seen } = await admin.from("webhook_events").select("processed_at").match(event).maybeSingle();
    if (seen?.processed_at) return reply(200);
  }

  try {
    const outcome = await recordPayment(await getMpPayment(dataId));
    await admin
      .from("webhook_events")
      .update({ processed_at: new Date().toISOString(), error: NORMAL_OUTCOMES.has(outcome) ? null : outcome })
      .match(event);
    return reply(200);
  } catch (err) {
    const permanent = err instanceof MpError && err.status < 500; // e.g. a payment of another account
    await admin
      .from("webhook_events")
      .update({ error: String(err).slice(0, 300), processed_at: permanent ? new Date().toISOString() : null })
      .match(event);
    return reply(permanent ? 200 : 500);
  }
}
