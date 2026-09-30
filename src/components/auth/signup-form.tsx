"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, type FormEvent } from "react";

import { Button } from "@/components/ui/button";
import { Field, FormAlert, Input } from "@/components/ui/field";
import { authErrorMessage, isStrongPassword, PASSWORD_RULE } from "@/lib/auth/errors";
import { createClient } from "@/lib/supabase/client";

import { PasswordInput } from "./password-input";

type Errors = Partial<Record<"name" | "email" | "password", string>>;

export function SignupForm({ next, legal }: { next: string; legal: boolean }) {
  const router = useRouter();
  const [pending, setPending] = useState(false);
  const [errors, setErrors] = useState<Errors>({});
  const [formError, setFormError] = useState<string | null>(null);
  const [sentTo, setSentTo] = useState<string | null>(null);

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const name = String(form.get("name") ?? "").trim();
    const email = String(form.get("email") ?? "").trim().toLowerCase();
    const password = String(form.get("password") ?? "");

    const found: Errors = {};
    if (name.length < 2) found.name = "Informe seu nome.";
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) found.email = "Informe um e-mail válido.";
    if (!isStrongPassword(password)) found.password = PASSWORD_RULE;
    setErrors(found);
    setFormError(null);
    if (Object.keys(found).length > 0) return;

    setPending(true);
    const { data, error } = await createClient().auth.signUp({
      email,
      password,
      options: {
        data: { full_name: name.slice(0, 120) },
        emailRedirectTo: `${window.location.origin}/auth/confirm?next=${encodeURIComponent(next)}`,
      },
    });
    setPending(false);
    if (error) {
      setFormError(authErrorMessage(error));
      return;
    }
    if (data.session) {
      router.replace(next);
      router.refresh();
      return;
    }
    // E-mail confirmation is on: the same message appears whether or not the address already
    // had an account, so the form cannot be used to discover registered e-mails.
    setSentTo(email);
  }

  if (sentTo) {
    return (
      <div className="grid gap-4">
        <FormAlert tone="success">
          Enviamos um link de confirmação para <strong>{sentTo}</strong>. Abra o e-mail para ativar sua conta.
        </FormAlert>
        <p className="text-sm text-ink-muted">Não chegou? Veja a caixa de spam ou tente entrar para reenviar o link.</p>
      </div>
    );
  }

  return (
    <form onSubmit={onSubmit} className="grid gap-5" noValidate>
      {formError ? <FormAlert>{formError}</FormAlert> : null}
      <Field id="name" label="Nome completo" error={errors.name}>
        <Input id="name" autoComplete="name" required maxLength={120} error={errors.name} />
      </Field>
      <Field id="email" label="E-mail" error={errors.email}>
        <Input id="email" type="email" autoComplete="email" inputMode="email" required maxLength={254} error={errors.email} />
      </Field>
      <Field id="password" label="Senha" error={errors.password} hint={PASSWORD_RULE}>
        <PasswordInput id="password" autoComplete="new-password" error={errors.password} hint />
      </Field>
      <Button type="submit" size="lg" disabled={pending} className="w-full">
        {pending ? "Criando conta..." : "Criar conta"}
      </Button>
      {legal ? (
        <p className="text-center text-xs text-ink-muted">
          Ao criar a conta, você aceita os{" "}
          <Link href="/termos" className="font-semibold text-wine hover:underline">
            Termos de uso
          </Link>{" "}
          e a{" "}
          <Link href="/privacidade" className="font-semibold text-wine hover:underline">
            Política de privacidade
          </Link>
          .
        </p>
      ) : null}
      <p className="text-center text-sm text-ink-muted">
        Já tem conta?{" "}
        <Link href={`/entrar?next=${encodeURIComponent(next)}`} className="font-semibold text-wine hover:underline">
          Entrar
        </Link>
      </p>
    </form>
  );
}
