"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, type FormEvent } from "react";

import { Button } from "@/components/ui/button";
import { Field, FormAlert, Input } from "@/components/ui/field";
import { authErrorMessage } from "@/lib/auth/errors";
import { createClient } from "@/lib/supabase/client";

import { PasswordInput } from "./password-input";

// Sign-in runs in the browser so Supabase rate-limits by the shopper's own IP, not the server's.
export function LoginForm({ next, notice }: { next: string; notice: "confirmed" | "expired" | null }) {
  const router = useRouter();
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(
    notice === "expired" ? "O link expirou ou já foi usado. Peça um novo." : null,
  );
  const [unconfirmed, setUnconfirmed] = useState<string | null>(null);
  const [resent, setResent] = useState(false);

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const email = String(form.get("email") ?? "")
      .trim()
      .toLowerCase();
    const password = String(form.get("password") ?? "");
    setPending(true);
    setError(null);
    const { error } = await createClient().auth.signInWithPassword({ email, password });
    setPending(false);
    if (error) {
      setError(authErrorMessage(error));
      setUnconfirmed(error.code === "email_not_confirmed" ? email : null);
      return;
    }
    router.replace(next);
    router.refresh();
  }

  async function resend() {
    if (!unconfirmed) return;
    const { error } = await createClient().auth.resend({
      type: "signup",
      email: unconfirmed,
      options: { emailRedirectTo: `${window.location.origin}/auth/confirm?next=${encodeURIComponent(next)}` },
    });
    if (error) setError(authErrorMessage(error));
    else setResent(true);
  }

  return (
    <form onSubmit={onSubmit} className="grid gap-5" noValidate={false}>
      {error ? <FormAlert>{error}</FormAlert> : null}
      {notice === "confirmed" && !error ? (
        <FormAlert tone="success">
          Link aberto em outro navegador. Se era a confirmação do cadastro, seu e-mail já está confirmado: entre com sua
          senha.
        </FormAlert>
      ) : null}
      {unconfirmed && !resent ? (
        <button type="button" onClick={resend} className="justify-self-start text-sm font-semibold text-wine underline">
          Reenviar link de confirmação
        </button>
      ) : null}
      {resent ? <FormAlert tone="success">Enviamos um novo link para {unconfirmed}.</FormAlert> : null}

      <Field id="email" label="E-mail">
        <Input id="email" type="email" autoComplete="email" inputMode="email" required maxLength={254} />
      </Field>
      <Field id="password" label="Senha">
        <PasswordInput id="password" autoComplete="current-password" />
      </Field>
      <Link href="/recuperar-senha" className="justify-self-start text-sm font-medium text-wine hover:underline">
        Esqueci minha senha
      </Link>
      <Button type="submit" size="lg" disabled={pending} className="w-full">
        {pending ? "Entrando..." : "Entrar"}
      </Button>
      <p className="text-center text-sm text-ink-muted">
        Ainda não tem conta?{" "}
        <Link href={`/cadastro?next=${encodeURIComponent(next)}`} className="font-semibold text-wine hover:underline">
          Criar conta
        </Link>
      </p>
    </form>
  );
}
