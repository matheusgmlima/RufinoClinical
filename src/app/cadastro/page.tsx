import type { Metadata } from "next";
import { redirect } from "next/navigation";

import { AuthShell } from "@/components/auth/auth-shell";
import { SignupForm } from "@/components/auth/signup-form";
import { safeNext } from "@/lib/auth/redirect";
import { getSessionUser } from "@/lib/auth/session";

export const metadata: Metadata = { title: "Criar conta" };

export default async function SignupPage({ searchParams }: PageProps<"/cadastro">) {
  const params = await searchParams;
  const next = safeNext(typeof params.next === "string" ? params.next : null);
  if (await getSessionUser()) redirect(next);

  return (
    <AuthShell title="Criar conta" lead="Leva menos de um minuto. Profissionais e clínicas usam a mesma conta.">
      <SignupForm next={next} />
    </AuthShell>
  );
}
