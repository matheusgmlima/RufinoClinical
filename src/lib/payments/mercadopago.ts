import "server-only";
import { randomUUID } from "node:crypto";

import { publicEnv } from "@/lib/env/public";
import { serverEnv } from "@/lib/env/server";
import { createAdminClient } from "@/lib/supabase/admin";
import type { Database } from "@/lib/supabase/database.types";
import { isPayable } from "@/lib/orders/status";
import type { createClient } from "@/lib/supabase/server";

import { mpDate, mpPaymentSchema, splitName, toPaymentRecord, type MpPayment } from "./gateway";

const API = "https://api.mercadopago.com";
// Mercado Pago minimum validity for a new Pix code (30 min) and boleto (1 day), with a margin.
const MIN_WINDOW_MS = { pix: 31 * 60_000, boleto: 24 * 3_600_000 };

export function paymentsEnabled() {
  return Boolean(serverEnv.MP_ACCESS_TOKEN && serverEnv.SUPABASE_SECRET_KEY && publicEnv.NEXT_PUBLIC_MP_PUBLIC_KEY);
}

/** A 4xx means Mercado Pago refused the request (e.g. an expired card token): nothing was charged. */
export class MpError extends Error {
  constructor(
    readonly status: number,
    path: string,
  ) {
    super(`Mercado Pago responded ${status} on ${path.split("/").slice(0, 3).join("/")}`);
  }
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
  // The response body is never logged or returned: it can contain payer data.
  if (!res.ok) throw new MpError(res.status, path);
  return res.json();
}

export async function getMpPayment(id: string): Promise<MpPayment> {
  return mpPaymentSchema.parse(await mp(`/v1/payments/${encodeURIComponent(id)}`));
}

/**
 * Stores the gateway's view of a payment and applies it to the order (see record_payment in SQL).
 * A payment approved for an order that expired, was canceled or was already paid is refunded.
 */
export async function recordPayment(payment: MpPayment): Promise<string> {
  const args = toPaymentRecord(payment);
  if (!args) return "ignored";
  type Args = Database["public"]["Functions"]["record_payment"]["Args"];
  const { data, error } = await createAdminClient().rpc("record_payment", args as Args);
  if (error) throw new Error(`record_payment failed: ${error.message}`);
  if (data === "needs_refund") {
    await mp(`/v1/payments/${args.p_provider_payment_id}/refunds`, {
      body: {},
      idempotencyKey: `refund-${args.p_provider_payment_id}`,
    });
  }
  return data;
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
  "id, number, status, total_cents, payment_method, customer_name, customer_email, customer_document, shipping_address, expires_at, items:order_items(sku, product_name, variant_name, quantity, unit_price_cents)";

export async function loadPayableOrder(supabase: Awaited<ReturnType<typeof createClient>>, orderId: string) {
  const { data } = await supabase.from("orders").select(PAYABLE_FIELDS).eq("id", orderId).maybeSingle();
  return data && isPayable(data) ? data : null;
}
type PayableOrder = NonNullable<Awaited<ReturnType<typeof loadPayableOrder>>>;

function paymentBase(order: PayableOrder) {
  const document = order.customer_document ?? "";
  return {
    transaction_amount: order.total_cents / 100, // always the database total, never a client value
    description: `Pedido #${order.number} - Rufino Clinical`,
    external_reference: order.id,
    payer: {
      email: order.customer_email,
      ...splitName(order.customer_name),
      identification: { type: document.length === 14 ? "CNPJ" : "CPF", number: document },
    },
    additional_info: {
      items: order.items.map((item) => ({
        id: item.sku,
        title: `${item.product_name} - ${item.variant_name}`,
        quantity: item.quantity,
        unit_price: item.unit_price_cents / 100,
      })),
    },
  };
}

/**
 * Generates the Pix code or boleto of an order, due at the order's own deadline. Returns false when
 * too little time is left for the gateway's minimum validity: the reservation is never stretched.
 */
export async function createPixOrBoleto(order: PayableOrder): Promise<boolean> {
  const method = order.payment_method;
  if (method !== "pix" && method !== "boleto") return false;
  const deadline = new Date(order.expires_at!);
  if (deadline.getTime() - Date.now() < MIN_WINDOW_MS[method]) return false;

  const base = paymentBase(order);
  const address = order.shipping_address as ShippingSnapshot;
  const body = {
    ...base,
    payment_method_id: method === "pix" ? "pix" : "bolbradesco",
    date_of_expiration: mpDate(deadline),
    payer:
      method === "boleto"
        ? {
            ...base.payer,
            address: {
              zip_code: address.zip_code,
              street_name: address.street,
              street_number: address.number,
              neighborhood: address.district,
              city: address.city,
              federal_unit: address.state,
            },
          }
        : base.payer,
  };
  // One code per order: double clicks and retries get the same payment back.
  const payment = mpPaymentSchema.parse(await mp("/v1/payments", { body, idempotencyKey: `${order.id}-${method}` }));
  await recordPayment(payment);
  return true;
}

export type CardInput = {
  token: string;
  payment_method_id: string;
  issuer_id?: string;
  installments: number;
  payer: { email: string; identification: { type: "CPF" | "CNPJ"; number: string } };
};

/** Charges a tokenized card (the card data itself never reaches this server). */
export async function createCardPayment(order: PayableOrder, card: CardInput) {
  const base = paymentBase(order);
  const payment = mpPaymentSchema.parse(
    await mp("/v1/payments", {
      idempotencyKey: randomUUID(), // card tokens are single-use, so every attempt is a new charge
      body: {
        ...base,
        token: card.token,
        installments: card.installments,
        payment_method_id: card.payment_method_id,
        issuer_id: card.issuer_id,
        binary_mode: true, // approved or rejected right away: no stock held by manual reviews
        payer: { ...base.payer, email: card.payer.email, identification: card.payer.identification },
      },
    }),
  );
  return { payment, outcome: await recordPayment(payment) };
}
