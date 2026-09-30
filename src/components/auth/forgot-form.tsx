"use client";

import { useState, type FormEvent } from "react";

import { Button } from "@/components/ui/button";
import { Field, FormAlert, Input } from "@/components/ui/field";
import { authErrorMessage } from "@/lib/auth/errors";
import { createClient } from "@/lib/supabase/client";

export function ForgotForm({ otherDevice }: { otherDevice: boolean }) {
  const [pending, setPending] = useState(false);
  const [done, setDone] = useState(false);
  const [error, setError] = useState<string | null>(
    otherDevice ? "Abra o link no mesmo aparelho e navegador em que pediu a nova senha, ou peça outro abaixo." : null,
  );

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const email = String(new FormData(event.currentTarget).get("email") ?? "")
      .trim()
      .toLowerCase();
    setPending(true);
    setError(null);
    const { error } = await createClient().auth.resetPasswordForEmail(email, {
      redirectTo: `${window.location.origin}/auth/confirm?next=${encodeURIComponent("/conta/nova-senha")}`,
    });
    setPending(false);
    // Only throttling is reported; "unknown e-mail" looks the same as success (no enumeration).
    if (error && (error.status === 429 || error.code?.startsWith("over_"))) {
      setError(authErrorMessage(error));
      return;
    }
    setDone(true);
  }

  if (done) {
    return (
      <FormAlert tone="success">
        Se houver uma conta com esse e-mail, você vai receber um link para criar uma nova senha em instantes.
      </FormAlert>
    );
  }

  return (
    <form onSubmit={onSubmit} className="grid gap-5">
      {error ? <FormAlert>{error}</FormAlert> : null}
      <Field id="email" label="E-mail da conta">
        <Input id="email" type="email" autoComplete="email" inputMode="email" required maxLength={254} />
      </Field>
      <Button type="submit" size="lg" disabled={pending} className="w-full">
        {pending ? "Enviando..." : "Enviar link"}
      </Button>
    </form>
  );
}
