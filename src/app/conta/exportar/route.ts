import { getSessionUser } from "@/lib/auth/session";
import { createClient } from "@/lib/supabase/server";

// LGPD (art. 18, II and V): a copy of the personal data the store keeps about the signed-in customer,
// as a JSON download. The session client and RLS limit every query to the caller's own rows.

const ORDER_FIELDS = `number, status, created_at, paid_at, shipped_at, delivered_at, canceled_at, customer_name,
  customer_email, customer_phone, customer_document, shipping_address, shipping_tracking_code, payment_method,
  installments, coupon_code, subtotal_cents, discount_cents, payment_discount_cents, shipping_cents, total_cents,
  items:order_items(product_name, variant_name, sku, quantity, unit_price_cents, total_cents),
  payments(method, status, installments, amount_cents, created_at)`;

export async function GET(request: Request) {
  const user = await getSessionUser();
  if (!user) return Response.redirect(new URL("/entrar?next=/conta/dados", request.url), 303);

  const supabase = await createClient();
  const [profile, addresses, orders] = await Promise.all([
    supabase.from("profiles").select("full_name, phone, document, marketing_opt_in, created_at").eq("id", user.id).maybeSingle(),
    supabase
      .from("addresses")
      .select("label, recipient_name, zip_code, street, number, complement, district, city, state, is_default, created_at")
      .eq("user_id", user.id),
    supabase.from("orders").select(ORDER_FIELDS).eq("user_id", user.id).order("created_at"),
  ]);
  if (profile.error || addresses.error || orders.error) {
    return new Response("Não foi possível gerar o arquivo agora. Tente de novo em instantes.", { status: 503 });
  }

  const data = {
    exported_at: new Date().toISOString(),
    note: "Valores em centavos de real. Datas em UTC.",
    account: { email: user.email, ...profile.data },
    addresses: addresses.data,
    orders: orders.data,
  };
  return new Response(JSON.stringify(data, null, 2), {
    headers: {
      "Content-Type": "application/json; charset=utf-8",
      "Content-Disposition": 'attachment; filename="meus-dados-rufino-clinical.json"',
      "Cache-Control": "private, no-store",
    },
  });
}
