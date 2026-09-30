import type { Metadata } from "next";
import { notFound, redirect } from "next/navigation";

import { MfaForm } from "@/components/admin/mfa-form";
import { AuthShell } from "@/components/auth/auth-shell";
import { getAdminStatus } from "@/lib/auth/admin";
import { requireUser } from "@/lib/auth/session";
import { createClient } from "@/lib/supabase/server";

export const metadata: Metadata = { title: "Verificação do painel", robots: { index: false, follow: false } };

export default async function AdminVerifyPage() {
  await requireUser("/admin/verificar");
  const status = await getAdminStatus();
  if (status === "ok") redirect("/admin");
  if (status !== "mfa_required") notFound();

  const { data } = await (await createClient()).auth.mfa.listFactors();
  const factorId = data?.totp[0]?.id ?? null;
  return (
    <AuthShell
      title="Verificação em duas etapas"
      lead={factorId ? "Digite o código que aparece no seu app autenticador." : undefined}
    >
      <MfaForm factorId={factorId} />
    </AuthShell>
  );
}
