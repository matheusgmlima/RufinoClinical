import "server-only";
import { randomUUID } from "node:crypto";

import { publicEnv } from "@/lib/env/public";
import { serverEnv } from "@/lib/env/server";
import { isPayable } from "@/lib/orders/status";
import { createAdminClient } from "@/lib/supabase/admin";
import type { Database } from "@/lib/supabase/database.types";
import type { createClient } from "@/lib/supabase/server";

import { isoDuration, mpOrderSchema, splitName, toPaymentRecord, type MpOrder } from "./gateway";

// Mercado Pago Checkout Transparente through the Orders API (/v1/orders): one order per charge attempt.
const API = "https://api.mercadopago.com";
// Minimum validity Mercado Pago accepts for a new Pix code (30 min) and boleto (1 day), with a margin.
const MIN_WINDOW_MS = { pix: 31 * 60_000, boleto: 24 * 3_600_000 };
// Sandbox: Mercado Pago only accepts its test buyer e-mails, and a Pix payer named APRO is auto-approved.
const TEST_MODE = serverEnv.MP_TEST_MODE === "true";

export function paymentsEnabled() {
  return Boolean(serverEnv.MP_ACCESS_TOKEN && serverEnv.SUPABASE_SECRET_KEY && publicEnv.NEXT_PUBLIC_MP_PUBLIC_KEY);
}

/** A 4xx means Mercado Pago refused the request. On 402 (card declined) the order still exists. */
export class MpError extends Error {
  constructor(
    readonly status: number,
    path: string,
    readonly orderId?: string,
    reason = "",
  ) {
    super(`Mercado Pago responded ${status} on ${path.split("/").slice(0, 3).join("/")}${reason && `: ${reason}`}`);
  }
}

// Only the error codes and field paths are kept (e-mails and long numbers masked): enough to debug, no payer data.
function errorReason(body: { errors?: unknown } | null) {
  if (!Array.isArray(body?.errors)) return "";
  return body.errors
    .map((e: { code?: unknown; details?: unknown }) => [e?.code, ...(Array.isArray(e?.details) ? e.details : [])])
    .flat()
    .filter((part): part is string => typeof part === "string")
    .join("; ")
    .replace(/\S+@\S+/g, "[email]")
    .replace(/\d{6,}/g, "[n]")
    .slice(0, 400);
}

async function mp(path: string, init: { body?: unknown; idempotencyKey?: string } = {}): Promise<unknown> {
  if (!serverEnv.MP_ACCESS_TOKEN) throw new Error("Mercado Pago is not configured");
  const res = await fetch(`${API}${path}`, {
    method: init.body === undefined ? "GET" : "POST",
    headers: {
      Authorization: `Bearer ${serverEnv.MP_ACCESS_TOKEN}`,
      "Content-Type": "application/json",
      ...(init.idempotencyKey ? { "X-Idempotency-Key": init.idempotencyKey } : {}),
    },
    body: init.body === undefined ? undefined : JSON.stringify(init.body),
    signal: AbortSignal.timeout(15_000),
    cache: "no-store",
  });
  const data: unknown = await res.json().catch(() => null);
  if (!res.ok) {
    // Error bodies are never logged whole or returned (they can carry payer data).
    const body = data as { id?: unknown; data?: { id?: unknown }; errors?: unknown } | null;
    const id = body?.id ?? body?.data?.id;
    const orderId = typeof id === "string" && /^[A-Za-z0-9]{1,64}$/.test(id) ? id : undefined;
    throw new MpError(res.status, path, orderId, errorReason(body));
  }
  return data;
}

export async function getMpOrder(id: string): Promise<MpOrder> {
  return mpOrderSchema.parse(await mp(`/v1/orders/${encodeURIComponent(id)}`));
}

/**
 * Stores the gateway's view of a charge and applies it to the order (see record_payment in SQL).
 * A charge approved for an order that expired, was canceled or was already paid is refunded.
 */
export async function recordPayment(order: MpOrder): Promise<string> {
  const args = toPaymentRecord(order);
  if (!args) return "ignored";
  type Args = Database["public"]["Functions"]["record_payment"]["Args"];
  const { data, error } = await createAdminClient().rpc("record_payment", args as Args);
  if (error) throw new Error(`record_payment failed: ${error.message}`);
  if (data === "needs_refund") {
    await mp(`/v1/orders/${order.id}/refund`, { body: {}, idempotencyKey: randomUUID() }).catch((err) => {
      if (!(err instanceof MpError && err.status === 409)) throw err; // 409: already refunded or in progress
    });
  }
  return data;
}

/** Voids a Pix code or boleto still waiting for payment. 409: already paid, canceled or expired. */
export async function cancelMpOrder(id: string) {
  await mp(`/v1/orders/${encodeURIComponent(id)}/cancel`, { body: {}, idempotencyKey: randomUUID() }).catch((err) => {
    if (!(err instanceof MpError && err.status === 409)) throw err;
  });
}

// ---------------------------------------------------------------------------------------------
// Orders being paid. They are always loaded with the buyer's session, so RLS proves ownership.
// ---------------------------------------------------------------------------------------------
type ShippingSnapshot = {
  zip_code: string;
  street: string;
  number: string;
  district: string;
  city: string;
  state: string;
};

const PAYABLE_FIELDS =
  "id, number, status, total_cents, shipping_cents, payment_method, customer_name, customer_email, customer_document, shipping_address, expires_at, items:order_items(sku, product_name, variant_name, quantity, unit_price_cents)";

export async function loadPayableOrder(supabase: Awaited<ReturnType<typeof createClient>>, orderId: string) {
  const { data } = await supabase.from("orders").select(PAYABLE_FIELDS).eq("id", orderId).maybeSingle();
  return data && isPayable(data) ? data : null;
}
type PayableOrder = NonNullable<Awaited<ReturnType<typeof loadPayableOrder>>>;

const money = (cents: number) => (cents / 100).toFixed(2);

function addressOf(order: PayableOrder) {
  const a = order.shipping_address as ShippingSnapshot;
  return {
    zip_code: a.zip_code,
    street_name: a.street,
    street_number: a.number,
    neighborhood: a.district,
    city: a.city,
    state: a.state,
  };
}

function payerOf(order: PayableOrder, email: string) {
  const document = order.customer_document ?? "";
  return {
    email,
    ...splitName(order.customer_name),
    identification: { type: document.length === 14 ? "CNPJ" : "CPF", number: document },
  };
}

/**
 * Mercado Pago refuses items that do not add up to total_amount, and item prices cannot be negative.
 * Products plus shipping add up only without discounts; otherwise the items are left out.
 */
function itemsOf(order: PayableOrder) {
  const lines = order.items.map((item) => ({
    title: `${item.product_name} - ${item.variant_name}`.slice(0, 150),
    unit_price: money(item.unit_price_cents),
    quantity: item.quantity,
    external_code: item.sku,
  }));
  if (order.shipping_cents > 0)
    lines.push({ title: "Frete", unit_price: money(order.shipping_cents), quantity: 1, external_code: "FRETE" });
  const sum = order.items.reduce((total, item) => total + item.unit_price_cents * item.quantity, order.shipping_cents);
  return sum === order.total_cents ? { items: lines } : {};
}

function orderBody(order: PayableOrder, payer: object, payment: object) {
  return {
    type: "online",
    processing_mode: "automatic",
    external_reference: order.id,
    total_amount: money(order.total_cents), // always the database total, never a client value
    description: `Pedido #${order.number} - Rufino Clinical`,
    payer,
    shipment: { address: addressOf(order) },
    ...itemsOf(order),
    transactions: { payments: [{ amount: money(order.total_cents), ...payment }] },
  };
}

/**
 * Generates the Pix code or boleto of an order, due at the order's own deadline. Returns false when
 * too little time is left for the gateway's minimum validity: the reservation is never stretched.
 */
export async function createPixOrBoleto(order: PayableOrder): Promise<boolean> {
  const method = order.payment_method;
  if (method !== "pix" && method !== "boleto") return false;
  const remaining = Date.parse(order.expires_at!) - Date.now();
  if (remaining < MIN_WINDOW_MS[method]) return false;

  const payer = {
    ...payerOf(order, TEST_MODE ? "test_user_br@testuser.com" : order.customer_email),
    ...(method === "boleto" ? { address: addressOf(order) } : {}),
    ...(TEST_MODE && method === "pix" ? { first_name: "APRO" } : {}),
  };
  const body = orderBody(order, payer, {
    payment_method: method === "pix" ? { id: "pix", type: "bank_transfer" } : { id: "boleto", type: "ticket" },
    expiration_time: isoDuration(remaining),
  });
  await recordPayment(mpOrderSchema.parse(await mp("/v1/orders", { body, idempotencyKey: randomUUID() })));
  return true;
}

export type CardInput = {
  token: string;
  payment_method_id: string;
  installments: number;
  payer: { email: string; identification: { type: "CPF" | "CNPJ"; number: string } };
};

/** Charges a tokenized card (the card data itself never reaches this server). */
export async function createCardPayment(order: PayableOrder, card: CardInput) {
  const payer = {
    ...payerOf(order, TEST_MODE ? "test@testuser.com" : card.payer.email),
    identification: card.payer.identification,
  };
  const body = orderBody(order, payer, {
    payment_method: {
      id: card.payment_method_id,
      type: "credit_card",
      token: card.token,
      installments: card.installments,
      statement_descriptor: "RUFINO CLINICAL",
    },
  });
  let created: MpOrder;
  try {
    // Card tokens are single-use, so every attempt is a new order with a new idempotency key.
    created = mpOrderSchema.parse(await mp("/v1/orders", { body, idempotencyKey: randomUUID() }));
  } catch (err) {
    // 402: the order exists but the card was declined; the details come from the API.
    if (!(err instanceof MpError && err.status === 402 && err.orderId)) throw err;
    created = await getMpOrder(err.orderId);
  }
  const tx = created.transactions.payments[0];
  return { outcome: await recordPayment(created), status: tx.status, statusDetail: tx.status_detail ?? null };
}
