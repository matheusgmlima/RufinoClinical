import type { Metadata } from "next";

import { PrivacyPanel } from "@/components/account/privacy-panel";
import { ProfileForm } from "@/components/account/profile-form";
import { requireUser } from "@/lib/auth/session";
import { createClient } from "@/lib/supabase/server";

export const metadata: Metadata = { title: "Meus dados" };

export default async function ProfilePage() {
  const user = await requireUser("/conta/dados");
  const supabase = await createClient();
  const { data: profile } = await supabase
    .from("profiles")
    .select("full_name, phone, document, marketing_opt_in")
    .eq("id", user.id)
    .single();

  return (
    <div className="space-y-8">
      <h1 className="text-3xl font-semibold tracking-tight text-ink">Meus dados</h1>
      <ProfileForm
        email={user.email}
        profile={profile ?? { full_name: null, phone: null, document: null, marketing_opt_in: false }}
      />
      <PrivacyPanel />
    </div>
  );
}
