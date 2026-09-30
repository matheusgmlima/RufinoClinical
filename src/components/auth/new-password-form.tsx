"use client";

import { useRouter } from "next/navigation";
import { useState, type FormEvent } from "react";

import { Button } from "@/components/ui/button";
import { Field, FormAlert } from "@/components/ui/field";
import { authErrorMessage, isStrongPassword, PASSWORD_RULE } from "@/lib/auth/errors";
import { createClient } from "@/lib/supabase/client";

import { PasswordInput } from "./password-input";

export function NewPasswordForm() {
  const router = useRouter();
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [fieldError, setFieldError] = useState<{ password?: string; confirm?: string }>({});

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const password = String(form.get("password") ?? "");
    const confirm = String(form.get("confirm") ?? "");
    const found: typeof fieldError = {};
    if (!isStrongPassword(password)) found.password = PASSWORD_RULE;
    else if (password !== confirm) found.confirm = "As senhas não são iguais.";
    setFieldError(found);
    if (Object.keys(found).length > 0) return;

    setPending(true);
    setError(null);
    const { error } = await createClient().auth.updateUser({ password });
    setPending(false);
    if (error) {
      setError(authErrorMessage(error));
      return;
    }
    router.replace("/conta?senha=alterada");
    router.refresh();
  }

  return (
    <form onSubmit={onSubmit} className="grid gap-5" noValidate>
      {error ? <FormAlert>{error}</FormAlert> : null}
      <Field id="password" label="Nova senha" error={fieldError.password} hint={PASSWORD_RULE}>
        <PasswordInput id="password" autoComplete="new-password" error={fieldError.password} hint />
      </Field>
      <Field id="confirm" label="Repita a nova senha" error={fieldError.confirm}>
        <PasswordInput id="confirm" autoComplete="new-password" error={fieldError.confirm} />
      </Field>
      <Button type="submit" size="lg" disabled={pending} className="w-full">
        {pending ? "Salvando..." : "Salvar nova senha"}
      </Button>
    </form>
  );
}
