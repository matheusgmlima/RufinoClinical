"use client";

import { useRouter } from "next/navigation";
import { useState, type FormEvent } from "react";

import { Button } from "@/components/ui/button";
import { Field, FormAlert, Input } from "@/components/ui/field";
import { authErrorMessage } from "@/lib/auth/errors";
import { createClient } from "@/lib/supabase/client";

type Enrollment = { factorId: string; qrCode: string; secret: string };

/**
 * Second factor for the admin panel (TOTP app such as Google Authenticator). Runs in the browser
 * so Supabase rate-limits by the admin's own IP; a verified code upgrades the session to aal2.
 */
export function MfaForm({ factorId }: { factorId: string | null }) {
  const router = useRouter();
  const [enrollment, setEnrollment] = useState<Enrollment | null>(null);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const activeFactor = factorId ?? enrollment?.factorId ?? null;

  async function enroll() {
    setPending(true);
    setError(null);
    const { auth } = createClient();
    // A setup that was never confirmed would block a new one with the same name.
    const { data: factors } = await auth.mfa.listFactors();
    for (const stale of factors?.all.filter((f) => f.status === "unverified") ?? []) {
      await auth.mfa.unenroll({ factorId: stale.id });
    }
    const { data, error } = await auth.mfa.enroll({ factorType: "totp", friendlyName: "Rufino Clinical" });
    setPending(false);
    if (error || !data) return setError(authErrorMessage(error));
    setEnrollment({ factorId: data.id, qrCode: data.totp.qr_code, secret: data.totp.secret });
  }

  async function verify(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!activeFactor) return;
    const code = String(new FormData(event.currentTarget).get("code") ?? "").replace(/\D/g, "");
    setPending(true);
    setError(null);
    const mfa = createClient().auth.mfa;
    let { error } = await mfa.challengeAndVerify({ factorId: activeFactor, code });
    // Supabase requires the challenge and the verify from the same IP; mobile networks and
    // proxies sometimes switch between the two calls, so a fresh pair usually succeeds.
    for (let retry = 0; retry < 2 && error?.code === "mfa_ip_address_mismatch"; retry++) {
      ({ error } = await mfa.challengeAndVerify({ factorId: activeFactor, code }));
    }
    setPending(false);
    if (error) return setError(authErrorMessage(error));
    router.replace("/admin");
    router.refresh();
  }

  if (!activeFactor) {
    return (
      <div className="grid gap-5">
        {error ? <FormAlert>{error}</FormAlert> : null}
        <p className="text-ink-muted">
          O painel exige um segundo fator. Instale um app autenticador no celular (Google Authenticator, Microsoft
          Authenticator ou similar) e continue.
        </p>
        <Button size="lg" onClick={enroll} disabled={pending} className="w-full sm:w-auto">
          {pending ? "Preparando..." : "Configurar verificação"}
        </Button>
      </div>
    );
  }

  return (
    <form onSubmit={verify} className="grid gap-5">
      {error ? <FormAlert>{error}</FormAlert> : null}
      {enrollment ? (
        <div className="grid gap-4 rounded-2xl border border-line bg-white p-5">
          <p className="text-sm text-ink">Leia o QR Code com o app autenticador:</p>
          {/* eslint-disable-next-line @next/next/no-img-element -- SVG data URL from Supabase */}
          <img src={enrollment.qrCode} alt="QR Code para o app autenticador" width={184} height={184} />
          <p className="text-sm text-ink-muted">
            Sem câmera? Digite esta chave no app:{" "}
            <code className="select-all break-all font-semibold text-ink">{enrollment.secret}</code>
          </p>
        </div>
      ) : null}
      <Field id="code" label="Código de 6 dígitos do app">
        <Input
          id="code"
          inputMode="numeric"
          autoComplete="one-time-code"
          pattern="\d{6}"
          maxLength={6}
          required
          autoFocus
          className="tracking-[0.3em]"
        />
      </Field>
      <Button type="submit" size="lg" disabled={pending} className="w-full">
        {pending ? "Verificando..." : "Entrar no painel"}
      </Button>
    </form>
  );
}
