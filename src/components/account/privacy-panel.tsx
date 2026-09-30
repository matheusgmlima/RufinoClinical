"use client";

import { DownloadSimple } from "@phosphor-icons/react";
import { useActionState, useState } from "react";

import { deleteAccount } from "@/app/actions/account";
import { Button } from "@/components/ui/button";
import { Field, FormAlert, Input } from "@/components/ui/field";
import type { FormState } from "@/lib/forms";

/** LGPD rights in the account: a copy of the data and account deletion (with a typed confirmation). */
export function PrivacyPanel() {
  const [open, setOpen] = useState(false);
  const [state, action, pending] = useActionState<FormState, FormData>(deleteAccount, { status: "idle" });
  const error = state.fieldErrors?.confirm;

  return (
    <section aria-labelledby="privacy-title" className="surface space-y-5 p-5 sm:p-6">
      <div>
        <h2 id="privacy-title" className="text-xl font-semibold text-ink">
          Privacidade
        </h2>
        <p className="mt-1 text-sm text-ink-muted">Seus direitos pela Lei Geral de Proteção de Dados (LGPD).</p>
      </div>

      <div className="space-y-2">
        <a
          href="/conta/exportar"
          download
          className="inline-flex items-center gap-2 text-sm font-semibold text-wine hover:underline"
        >
          <DownloadSimple size={18} aria-hidden="true" />
          Baixar uma cópia dos meus dados
        </a>
        <p className="text-xs text-ink-muted">Cadastro, endereços e pedidos em um arquivo (JSON).</p>
      </div>

      {open ? (
        <form action={action} className="max-w-xl space-y-4 rounded-2xl bg-wine/5 p-5">
          {state.status === "error" && state.message ? <FormAlert>{state.message}</FormAlert> : null}
          <p className="text-sm text-ink">
            Excluir a conta apaga seu cadastro, endereços e acesso. Isso não pode ser desfeito. Os pedidos já feitos
            ficam guardados pelo prazo da lei (notas e garantias), sem ligação com a conta.
          </p>
          <Field id="confirm" label="Para confirmar, digite EXCLUIR" error={error}>
            <Input id="confirm" autoComplete="off" autoCapitalize="characters" error={error} />
          </Field>
          <div className="flex flex-wrap gap-2">
            <Button type="submit" disabled={pending}>
              {pending ? "Excluindo..." : "Excluir minha conta"}
            </Button>
            <Button variant="ghost" onClick={() => setOpen(false)} disabled={pending}>
              Voltar
            </Button>
          </div>
        </form>
      ) : (
        <Button variant="ghost" className="-ml-4 text-wine" onClick={() => setOpen(true)}>
          Excluir minha conta
        </Button>
      )}
    </section>
  );
}
