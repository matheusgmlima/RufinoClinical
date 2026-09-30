import type { Metadata } from "next";

import { AddressList } from "@/components/account/address-list";
import { requireUser } from "@/lib/auth/session";
import { createClient } from "@/lib/supabase/server";

export const metadata: Metadata = { title: "Endereços" };

export default async function AddressesPage() {
  const user = await requireUser("/conta/enderecos");
  const supabase = await createClient();
  const [{ data: addresses }, { data: profile }] = await Promise.all([
    supabase
      .from("addresses")
      .select("id, label, recipient_name, zip_code, street, number, complement, district, city, state, is_default")
      .order("is_default", { ascending: false })
      .order("created_at"),
    supabase.from("profiles").select("full_name").eq("id", user.id).maybeSingle(),
  ]);

  return (
    <div className="space-y-8">
      <h1 className="text-3xl font-semibold tracking-tight text-ink">Endereços</h1>
      <AddressList addresses={addresses ?? []} defaultName={profile?.full_name ?? ""} />
    </div>
  );
}
