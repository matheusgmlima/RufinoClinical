"use client";

import { useEffect, useRef } from "react";

import { adjustStock, saveVariant } from "@/app/actions/admin/catalog";
import { Button } from "@/components/ui/button";
import { Field, Input } from "@/components/ui/field";
import { centsToField } from "@/lib/money";

import { Checkbox, FormMessage, SelectField } from "./fields";
import { useAdminForm } from "./use-admin-form";

export type VariantValues = {
  id: string;
  sku: string;
  name: string;
  price_cents: number;
  compare_at_price_cents: number | null;
  weight_grams: number;
  length_cm: number;
  width_cm: number;
  height_cm: number;
  position: number;
  is_active: boolean;
};

const decimal = (value: number) => String(value).replace(".", ",");

/** Adds a variant (no `variant`) or edits one. Field ids carry a prefix: several forms share the page. */
export function VariantForm({ productId, variant }: { productId: string; variant?: VariantValues }) {
  const { state, errors, onSubmit, pending } = useAdminForm(saveVariant.bind(null, productId, variant?.id ?? null));
  const form = useRef<HTMLFormElement>(null);
  const p = variant ? `v-${variant.id}` : "v-new";

  // A new variant clears the form for the next one; an edit keeps what was saved on screen.
  useEffect(() => {
    if (!variant && state.status === "ok") form.current?.reset();
  }, [state, variant]);

  return (
    <form ref={form} onSubmit={onSubmit} className="grid gap-5" noValidate>
      <FormMessage state={state} />
      <div className="grid gap-5 sm:grid-cols-2">
        <Field id={`${p}-name`} label="Nome da variante" error={errors.name} hint="Ex.: Bege, 5 cm, 250 ml.">
          <Input id={`${p}-name`} name="name" defaultValue={variant?.name} maxLength={80} hint error={errors.name} />
        </Field>
        <Field id={`${p}-sku`} label="SKU (código interno)" error={errors.sku}>
          <Input
            id={`${p}-sku`}
            name="sku"
            defaultValue={variant?.sku}
            maxLength={40}
            autoComplete="off"
            className="uppercase"
            error={errors.sku}
          />
        </Field>
        <Field id={`${p}-price`} label="Preço de venda (R$)" error={errors.price}>
          <Input
            id={`${p}-price`}
            name="price"
            inputMode="decimal"
            placeholder="49,90"
            defaultValue={variant ? centsToField(variant.price_cents) : ""}
            error={errors.price}
          />
        </Field>
        <Field
          id={`${p}-compare`}
          label="Preço “de” (R$)"
          error={errors.compare_at_price}
          hint="Aparece riscado. Deixe em branco se não houver promoção."
          optional
        >
          <Input
            id={`${p}-compare`}
            name="compare_at_price"
            inputMode="decimal"
            defaultValue={variant?.compare_at_price_cents ? centsToField(variant.compare_at_price_cents) : ""}
            hint
            error={errors.compare_at_price}
          />
        </Field>
      </div>

      <fieldset className="grid gap-3">
        <legend className="mb-2 text-sm font-semibold text-ink">Embalagem (para o frete)</legend>
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          <Field id={`${p}-weight`} label="Peso (g)" error={errors.weight_grams}>
            <Input
              id={`${p}-weight`}
              name="weight_grams"
              inputMode="numeric"
              defaultValue={variant?.weight_grams}
              error={errors.weight_grams}
            />
          </Field>
          <Field id={`${p}-length`} label="Compr. (cm)" error={errors.length_cm}>
            <Input
              id={`${p}-length`}
              name="length_cm"
              inputMode="decimal"
              defaultValue={variant ? decimal(variant.length_cm) : ""}
              error={errors.length_cm}
            />
          </Field>
          <Field id={`${p}-width`} label="Largura (cm)" error={errors.width_cm}>
            <Input
              id={`${p}-width`}
              name="width_cm"
              inputMode="decimal"
              defaultValue={variant ? decimal(variant.width_cm) : ""}
              error={errors.width_cm}
            />
          </Field>
          <Field id={`${p}-height`} label="Altura (cm)" error={errors.height_cm}>
            <Input
              id={`${p}-height`}
              name="height_cm"
              inputMode="decimal"
              defaultValue={variant ? decimal(variant.height_cm) : ""}
              error={errors.height_cm}
            />
          </Field>
        </div>
      </fieldset>

      <div className="grid gap-5 sm:grid-cols-2">
        <Field id={`${p}-position`} label="Ordem" error={errors.position} hint="Menor aparece primeiro.">
          <Input
            id={`${p}-position`}
            name="position"
            type="number"
            inputMode="numeric"
            min={0}
            max={9999}
            defaultValue={variant?.position ?? 0}
            hint
            error={errors.position}
          />
        </Field>
        {variant ? null : (
          <Field id={`${p}-stock`} label="Estoque inicial" error={errors.initial_stock} optional>
            <Input
              id={`${p}-stock`}
              name="initial_stock"
              type="number"
              inputMode="numeric"
              min={0}
              defaultValue={0}
              error={errors.initial_stock}
            />
          </Field>
        )}
      </div>
      <Checkbox
        id={`${p}-active`}
        name="is_active"
        label="Disponível para venda"
        defaultChecked={variant?.is_active ?? true}
      />
      <Button type="submit" variant={variant ? "secondary" : "primary"} disabled={pending} className="justify-self-start">
        {pending ? "Salvando..." : variant ? "Salvar variante" : "Adicionar variante"}
      </Button>
    </form>
  );
}

/** Stock entry, exit/loss or customer return for one variant. */
export function StockForm({ productId, variantId }: { productId: string; variantId: string }) {
  const { state, errors, onSubmit, pending } = useAdminForm(adjustStock.bind(null, productId, variantId));
  const form = useRef<HTMLFormElement>(null);
  const p = `s-${variantId}`;

  useEffect(() => {
    if (state.status === "ok") form.current?.reset();
  }, [state]);

  return (
    <form ref={form} onSubmit={onSubmit} className="grid gap-3" noValidate>
      <FormMessage state={state} />
      <div className="grid grid-cols-[1fr_7rem] gap-3 sm:grid-cols-[1fr_7rem_auto] sm:items-end">
        <SelectField id={`${p}-kind`} name="kind" label="Tipo de ajuste" defaultValue="entrada" error={errors.kind}>
          <option value="entrada">Entrada</option>
          <option value="saida">Saída ou perda</option>
          <option value="devolucao">Devolução</option>
        </SelectField>
        <Field id={`${p}-qty`} label="Quantidade" error={errors.quantity}>
          <Input id={`${p}-qty`} name="quantity" type="number" inputMode="numeric" min={1} error={errors.quantity} />
        </Field>
        <Button type="submit" variant="secondary" disabled={pending} className="col-span-2 h-12 sm:col-span-1">
          {pending ? "Ajustando..." : "Ajustar estoque"}
        </Button>
      </div>
    </form>
  );
}
