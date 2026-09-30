import type { Metadata } from "next";

import { CheckoutForm } from "@/components/checkout/checkout-form";
import { requireUser } from "@/lib/auth/session";
import { getStoreSettings } from "@/lib/catalog/queries";
import { paymentsEnabled } from "@/lib/payments/mercadopago";
import { createClient } from "@/lib/supabase/server";

export const metadata: Metadata = { title: "Finalizar compra" };

export default async function CheckoutPage() {
  const user = await requireUser("/checkout");
  const supabase = await createClient();
  const [{ data: addresses }, { data: profile }, settings] = await Promise.all([
    supabase
      .from("addresses")
      .select("id, label, recipient_name, zip_code, street, number, complement, district, city, state, is_default")
      .order("is_default", { ascending: false })
      .order("created_at"),
    supabase.from("profiles").select("full_name, document").eq("id", user.id).maybeSingle(),
    getStoreSettings(),
  ]);

  return (
    // min-h-svh: the cart is only known in the browser, so the footer must not jump when it loads.
    <div className="container-page min-h-svh py-10 lg:py-14">
      <h1 className="text-4xl font-semibold tracking-tight text-ink md:text-5xl">Finalizar compra</h1>
      <CheckoutForm
        addresses={addresses ?? []}
        defaultName={profile?.full_name ?? ""}
        needsDocument={!profile?.document}
        pixDiscountPercent={settings.pixDiscountPercent}
        card={settings}
        enabled={paymentsEnabled()}
      />
    </div>
  );
}
