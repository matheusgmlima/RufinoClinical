import "server-only";
import { after } from "next/server";

import { publicEnv } from "@/lib/env/public";
import { createAdminClient } from "@/lib/supabase/admin";

import { orderEmail, type EmailOrder, type OrderEmailKind } from "./order-emails";
import { emailEnabled, sendEmail } from "./send";

const EMAIL_FIELDS = `id, number, customer_name, customer_email, payment_method, subtotal_cents, discount_cents,
  payment_discount_cents, shipping_cents, total_cents, coupon_code, shipping_method, shipping_tracking_code, expires_at,
  items:order_items(product_name, variant_name, quantity, total_cents)`;

/**
 * E-mails the customer about an order event after the response is sent, so a slow or failing
 * e-mail never delays or breaks a payment, webhook or admin action. Callers fire it once per real
 * transition (record_payment returns "paid"/"refunded" only once); the idempotency key covers
 * retries. The order is read with the service client: webhooks have no session.
 */
export function notifyOrder(kind: OrderEmailKind, orderId: string) {
  if (!emailEnabled()) return;
  after(async () => {
    try {
      const db = createAdminClient();
      const { data: order } = await db.from("orders").select(EMAIL_FIELDS).eq("id", orderId).maybeSingle();
      if (!order) return;
      let pickup: EmailOrder["pickup"] = null;
      if (order.shipping_method === "pickup") {
        const { data } = await db.from("store_settings").select("pickup_address, pickup_hours").single();
        if (data?.pickup_address) pickup = { address: data.pickup_address, hours: data.pickup_hours };
      }
      const email = orderEmail(kind, { ...order, pickup } as EmailOrder, publicEnv.NEXT_PUBLIC_SITE_URL.replace(/\/$/, ""));
      await sendEmail(order.customer_email, email, `order-${kind}/${orderId}`);
    } catch (err) {
      console.error("order e-mail failed", { kind, orderId, err });
    }
  });
}
