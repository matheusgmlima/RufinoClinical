import type { Metadata } from "next";

import { AuthShell } from "@/components/auth/auth-shell";
import { NewPasswordForm } from "@/components/auth/new-password-form";
import { requireUser } from "@/lib/auth/session";

export const metadata: Metadata = { title: "Nova senha" };

export default async function NewPasswordPage() {
  await requireUser("/conta/nova-senha");
  return (
    <AuthShell title="Criar nova senha">
      <NewPasswordForm />
    </AuthShell>
  );
}
