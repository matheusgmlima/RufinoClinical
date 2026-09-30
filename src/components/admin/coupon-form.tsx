"use client";

import { useEffect, useRef, useState } from "react";

import { saveCoupon } from "@/app/actions/admin/coupons";
import { Button } from "@/components/ui/button";
import { Field, Input } from "@/components/ui/field";
import { toDateField } from "@/lib/dates";
import { centsToField } from "@/lib/money";

import { Checkbox, FormMessage, SelectField } from "./fields";
import { useAdminForm } from "./use-admin-form";

export type CouponValues = {
  id: string;
  code: string;
  discount_type: "percent" | "fixed";
  discount_value: number;
  min_subtotal_cents: number;
  starts_at: string | null;
  ends_at: string | null;
  max_redemptions: number | null;
  is_active: boolean;
};

/** Creates a coupon (no `coupon`) or edits one. Dates are São Paulo calendar days. */
export function CouponForm({ coupon }: { coupon?: CouponValues }) {
  const { state, errors, onSubmit, pending } = useAdminForm(saveCoupon.bind(null, coupon?.id ?? null));
  const [type, setType] = useState(coupon?.discount_type ?? "percent");
  const form = useRef<HTMLFormElement>(null);
  const p = coupon ? `cp-${coupon.id}` : "cp-new";

  useEffect(() => {
    if (!coupon && state.status === "ok") form.current?.reset();
  }, [state, coupon]);

  const value = coupon
    ? coupon.discount_type === "percent"
      ? String(coupon.discount_value)
      : centsToField(coupon.discount_value)
    : "";
  // ends_at is exclusive (start of the next day): the field shows the last valid day.
  const lastDay = coupon?.ends_at ? toDateField(new Date(Date.parse(coupon.ends_at) - 1)) : "";

  return (
    <form ref={form} onSubmit={onSubmit} className="grid gap-5" noValidate>
      <FormMessage state={state} />
      <Field id={`${p}-code`} label="Código" error={errors.code} hint="O cliente digita no checkout. Ex.: BEMVINDA10.">
        <Input
          id={`${p}-code`}
          name="code"
          defaultValue={coupon?.code}
          maxLength={30}
          autoComplete="off"
          className="uppercase"
          hint
          error={errors.code}
        />
      </Field>
      <div className="grid gap-5 sm:grid-cols-2">
        <SelectField
          id={`${p}-type`}
          name="discount_type"
          label="Tipo de desconto"
          value={type}
          onChange={(event) => setType(event.target.value as "percent" | "fixed")}
          error={errors.discount_type}
        >
          <option value="percent">Porcentagem (%)</option>
          <option value="fixed">Valor fixo (R$)</option>
        </SelectField>
        <Field id={`${p}-value`} label={type === "percent" ? "Desconto (%)" : "Desconto (R$)"} error={errors.discount_value}>
          <Input
            id={`${p}-value`}
            name="discount_value"
            inputMode={type === "percent" ? "numeric" : "decimal"}
            placeholder={type === "percent" ? "10" : "20,00"}
            defaultValue={value}
            error={errors.discount_value}
          />
        </Field>
        <Field
          id={`${p}-min`}
          label="Pedido mínimo (R$)"
          error={errors.min_subtotal}
          hint="Soma dos produtos, sem frete."
          optional
        >
          <Input
            id={`${p}-min`}
            name="min_subtotal"
            inputMode="decimal"
            defaultValue={coupon?.min_subtotal_cents ? centsToField(coupon.min_subtotal_cents) : ""}
            hint
            error={errors.min_subtotal}
          />
        </Field>
        <Field
          id={`${p}-max`}
          label="Limite de usos"
          error={errors.max_redemptions}
          hint="Em branco, sem limite."
          optional
        >
          <Input
            id={`${p}-max`}
            name="max_redemptions"
            type="number"
            inputMode="numeric"
            min={1}
            defaultValue={coupon?.max_redemptions ?? ""}
            hint
            error={errors.max_redemptions}
          />
        </Field>
        <Field id={`${p}-start`} label="Começa em" error={errors.starts_at} optional>
          <Input
            id={`${p}-start`}
            name="starts_at"
            type="date"
            defaultValue={coupon?.starts_at ? toDateField(coupon.starts_at) : ""}
            error={errors.starts_at}
          />
        </Field>
        <Field id={`${p}-end`} label="Válido até (inclusive)" error={errors.ends_at} optional>
          <Input id={`${p}-end`} name="ends_at" type="date" defaultValue={lastDay} error={errors.ends_at} />
        </Field>
      </div>
      <Checkbox id={`${p}-active`} name="is_active" label="Ativo" defaultChecked={coupon?.is_active ?? true} />
      <Button type="submit" variant={coupon ? "secondary" : "primary"} disabled={pending} className="justify-self-start">
        {pending ? "Salvando..." : coupon ? "Salvar cupom" : "Criar cupom"}
      </Button>
    </form>
  );
}
