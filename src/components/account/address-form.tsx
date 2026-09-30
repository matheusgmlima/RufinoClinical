"use client";

import { useActionState, useState } from "react";

import { lookupCep, saveAddress } from "@/app/actions/addresses";
import type { FormState } from "@/app/actions/account";
import { Button } from "@/components/ui/button";
import { Field, FormAlert, Input, inputClass } from "@/components/ui/field";
import { formatCep, onlyDigits, UFS } from "@/lib/validation/br";

export type AddressValues = {
  id?: string;
  label: string | null;
  recipient_name: string;
  zip_code: string;
  street: string;
  number: string;
  complement: string | null;
  district: string;
  city: string;
  state: string;
  is_default: boolean;
};

export function AddressForm({
  initial,
  defaultName,
  onDone,
}: {
  initial?: AddressValues;
  defaultName: string;
  onDone: () => void;
}) {
  const [state, action, pending] = useActionState<FormState, FormData>(async (prev, data) => {
    const result = await saveAddress(prev, data);
    if (result.status === "ok") onDone();
    return result;
  }, { status: "idle" });
  const errors = state.fieldErrors ?? {};

  // Fields filled from the CEP stay editable (ViaCEP is sometimes incomplete).
  const [place, setPlace] = useState({
    street: initial?.street ?? "",
    district: initial?.district ?? "",
    city: initial?.city ?? "",
    state: initial?.state ?? "",
  });
  const [cepStatus, setCepStatus] = useState<"idle" | "loading" | "notfound">("idle");

  async function onCep(value: string) {
    const digits = onlyDigits(value);
    if (digits.length !== 8) return;
    setCepStatus("loading");
    const found = await lookupCep(digits);
    if (!found) {
      setCepStatus("notfound");
      return;
    }
    setCepStatus("idle");
    setPlace((p) => ({
      street: found.street || p.street,
      district: found.district || p.district,
      city: found.city,
      state: found.state,
    }));
  }

  return (
    <form action={action} className="grid gap-5 rounded-2xl border border-line p-5 sm:p-6">
      {state.status === "error" && state.message ? <FormAlert>{state.message}</FormAlert> : null}
      <input type="hidden" name="id" value={initial?.id ?? ""} />

      <div className="grid gap-5 sm:grid-cols-2">
        <Field id="recipient_name" label="Quem vai receber" error={errors.recipient_name}>
          <Input id="recipient_name" autoComplete="name" defaultValue={initial?.recipient_name ?? defaultName} maxLength={120} error={errors.recipient_name} />
        </Field>
        <Field id="label" label="Apelido do endereço" error={errors.label} optional>
          <Input id="label" placeholder="Casa, Clínica..." defaultValue={initial?.label ?? ""} maxLength={40} error={errors.label} />
        </Field>
      </div>

      <div className="grid gap-5 sm:grid-cols-[12rem_1fr]">
        <Field
          id="zip_code"
          label="CEP"
          error={errors.zip_code}
          hint={cepStatus === "loading" ? "Buscando endereço..." : cepStatus === "notfound" ? "CEP não encontrado. Preencha o endereço abaixo." : undefined}
        >
          <Input
            id="zip_code"
            inputMode="numeric"
            autoComplete="postal-code"
            defaultValue={initial ? formatCep(initial.zip_code) : ""}
            maxLength={9}
            onInput={(e) => {
              e.currentTarget.value = formatCep(e.currentTarget.value);
              void onCep(e.currentTarget.value);
            }}
            error={errors.zip_code}
            hint={cepStatus !== "idle"}
          />
        </Field>
        <Field id="street" label="Rua" error={errors.street}>
          <Input id="street" autoComplete="address-line1" value={place.street} onChange={(e) => setPlace({ ...place, street: e.target.value })} maxLength={160} error={errors.street} />
        </Field>
      </div>

      <div className="grid gap-5 sm:grid-cols-[8rem_1fr]">
        <Field id="number" label="Número" error={errors.number}>
          <Input id="number" defaultValue={initial?.number ?? ""} maxLength={20} error={errors.number} />
        </Field>
        <Field id="complement" label="Complemento" error={errors.complement} optional>
          <Input id="complement" autoComplete="address-line2" defaultValue={initial?.complement ?? ""} maxLength={80} error={errors.complement} />
        </Field>
      </div>

      <div className="grid gap-5 sm:grid-cols-[1fr_1fr_7rem]">
        <Field id="district" label="Bairro" error={errors.district}>
          <Input id="district" value={place.district} onChange={(e) => setPlace({ ...place, district: e.target.value })} maxLength={80} error={errors.district} />
        </Field>
        <Field id="city" label="Cidade" error={errors.city}>
          <Input id="city" autoComplete="address-level2" value={place.city} onChange={(e) => setPlace({ ...place, city: e.target.value })} maxLength={80} error={errors.city} />
        </Field>
        <Field id="state" label="UF" error={errors.state}>
          <select
            id="state"
            name="state"
            autoComplete="address-level1"
            value={place.state}
            onChange={(e) => setPlace({ ...place, state: e.target.value })}
            aria-invalid={errors.state ? true : undefined}
            className={inputClass}
          >
            <option value="">--</option>
            {UFS.map((uf) => (
              <option key={uf} value={uf}>
                {uf}
              </option>
            ))}
          </select>
        </Field>
      </div>

      <label className="flex items-center gap-3 text-sm text-ink">
        <input type="checkbox" name="is_default" defaultChecked={initial?.is_default ?? false} className="size-5 accent-wine" />
        Usar como endereço principal
      </label>

      <div className="flex flex-wrap gap-3">
        <Button type="submit" disabled={pending}>
          {pending ? "Salvando..." : "Salvar endereço"}
        </Button>
        <Button type="button" variant="ghost" onClick={onDone}>
          Cancelar
        </Button>
      </div>
    </form>
  );
}
