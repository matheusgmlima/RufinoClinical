import type { Metadata } from "next";
import { redirect } from "next/navigation";

import { AuthShell } from "@/components/auth/auth-shell";
import { LoginForm } from "@/components/auth/login-form";
import { safeNext } from "@/lib/auth/redirect";
import { getSessionUser } from "@/lib/auth/session";

export const metadata: Metadata = { title: "Entrar" };

export default async function LoginPage({ searchParams }: PageProps<"/entrar">) {
  const params = await searchParams;
  const next = safeNext(typeof params.next === "string" ? params.next : null);
  if (await getSessionUser()) redirect(next);

  return (
    <AuthShell title="Entrar" lead="Acesse sua conta para finalizar compras e acompanhar pedidos.">
      <LoginForm next={next} linkExpired={params.erro === "link"} />
    </AuthShell>
  );
}
