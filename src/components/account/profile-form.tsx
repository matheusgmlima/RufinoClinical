"use client";

import { useActionState } from "react";

import { updateProfile } from "@/app/actions/account";
import { Button } from "@/components/ui/button";
import { Field, FormAlert, Input } from "@/components/ui/field";
import type { FormState } from "@/lib/forms";
import { formatDocument, formatPhone } from "@/lib/validation/br";

type Profile = { full_name: string | null; phone: string | null; document: string | null; marketing_opt_in: boolean };

export function ProfileForm({ email, profile }: { email: string; profile: Profile }) {
  const [state, action, pending] = useActionState<FormState, FormData>(updateProfile, { status: "idle" });
  const errors = state.fieldErrors ?? {};

  return (
    <form action={action} className="grid max-w-xl gap-5">
      {state.status === "ok" ? <FormAlert tone="success">{state.message}</FormAlert> : null}
      {state.status === "error" && state.message ? <FormAlert>{state.message}</FormAlert> : null}

      <Field id="full_name" label="Nome completo" error={errors.full_name}>
        <Input id="full_name" autoComplete="name" defaultValue={profile.full_name ?? ""} maxLength={120} error={errors.full_name} />
      </Field>
      <Field id="email" label="E-mail">
        <Input id="email" type="email" value={email} readOnly disabled />
      </Field>
      <Field id="phone" label="Celular com DDD" error={errors.phone} optional>
        <Input
          id="phone"
          type="tel"
          inputMode="tel"
          autoComplete="tel-national"
          defaultValue={profile.phone ? formatPhone(profile.phone) : ""}
          onInput={(e) => (e.currentTarget.value = formatPhone(e.currentTarget.value))}
          maxLength={15}
          error={errors.phone}
        />
      </Field>
      <Field
        id="document"
        label="CPF ou CNPJ"
        error={errors.document}
        hint="Usado na nota fiscal. Clínicas podem informar o CNPJ."
        optional
      >
        <Input
          id="document"
          inputMode="numeric"
          defaultValue={profile.document ? formatDocument(profile.document) : ""}
          onInput={(e) => (e.currentTarget.value = formatDocument(e.currentTarget.value))}
          maxLength={18}
          error={errors.document}
          hint
        />
      </Field>
      <label className="flex items-start gap-3 text-sm text-ink">
        <input
          type="checkbox"
          name="marketing_opt_in"
          defaultChecked={profile.marketing_opt_in}
          className="mt-0.5 size-5 shrink-0 accent-wine"
        />
        Quero receber novidades e promoções por e-mail.
      </label>
      <Button type="submit" disabled={pending} className="justify-self-start">
        {pending ? "Salvando..." : "Salvar dados"}
      </Button>
    </form>
  );
}
