import type { Metadata } from "next";

import { AuthShell } from "@/components/auth/auth-shell";
import { ForgotForm } from "@/components/auth/forgot-form";

export const metadata: Metadata = { title: "Recuperar senha" };

export default function ForgotPasswordPage() {
  return (
    <AuthShell title="Recuperar senha" lead="Informe o e-mail da sua conta e enviaremos um link para criar uma nova senha.">
      <ForgotForm />
    </AuthShell>
  );
}
