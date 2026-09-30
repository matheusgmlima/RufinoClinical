"use client";

import { saveDelivery, saveSettings, saveShippingRates } from "@/app/actions/admin/settings";
import { Button } from "@/components/ui/button";
import { Field, Input } from "@/components/ui/field";
import { centsToField } from "@/lib/money";
import { REGION_LABEL, REGIONS, type Region } from "@/lib/shipping/regions";
import { formatCep } from "@/lib/validation/br";

import { Checkbox, FormMessage } from "./fields";
import { useAdminForm } from "./use-admin-form";

type Settings = {
  pix_discount_percent: number;
  max_installments: number;
  interest_free_installments: number;
  min_installment_cents: number;
  free_shipping_threshold_cents: number | null;
};

export function SettingsForm({ settings }: { settings: Settings }) {
  const { state, errors, onSubmit, pending } = useAdminForm(saveSettings);

  return (
    <form onSubmit={onSubmit} className="grid gap-5" noValidate>
      <FormMessage state={state} />
      <Field id="pix_discount_percent" label="Desconto no Pix (%)" error={errors.pix_discount_percent}>
        <Input
          id="pix_discount_percent"
          inputMode="decimal"
          defaultValue={String(settings.pix_discount_percent).replace(".", ",")}
          className="max-w-32"
          error={errors.pix_discount_percent}
        />
      </Field>
      <div className="grid gap-5 sm:grid-cols-2">
        <Field id="max_installments" label="Máximo de parcelas no cartão" error={errors.max_installments}>
          <Input
            id="max_installments"
            type="number"
            inputMode="numeric"
            min={1}
            max={12}
            defaultValue={settings.max_installments}
            error={errors.max_installments}
          />
        </Field>
        <Field
          id="interest_free_installments"
          label="Parcelas sem juros"
          error={errors.interest_free_installments}
          hint="Precisa ser igual ao configurado no Mercado Pago (Seu negócio → Custos). Acima disso, os juros são do cliente."
        >
          <Input
            id="interest_free_installments"
            type="number"
            inputMode="numeric"
            min={1}
            max={12}
            defaultValue={settings.interest_free_installments}
            hint
            error={errors.interest_free_installments}
          />
        </Field>
        <Field id="min_installment" label="Parcela mínima (R$)" error={errors.min_installment}>
          <Input
            id="min_installment"
            inputMode="decimal"
            defaultValue={centsToField(settings.min_installment_cents)}
            error={errors.min_installment}
          />
        </Field>
        <Field
          id="free_shipping_threshold"
          label="Frete grátis a partir de (R$)"
          error={errors.free_shipping_threshold}
          hint="Em branco, sem frete grátis."
          optional
        >
          <Input
            id="free_shipping_threshold"
            inputMode="decimal"
            defaultValue={
              settings.free_shipping_threshold_cents ? centsToField(settings.free_shipping_threshold_cents) : ""
            }
            hint
            error={errors.free_shipping_threshold}
          />
        </Field>
      </div>
      <Button type="submit" disabled={pending} className="justify-self-start">
        {pending ? "Salvando..." : "Salvar configurações"}
      </Button>
    </form>
  );
}

type Rate = { region: string; price_cents: number; min_days: number; max_days: number };

export function ShippingForm({ rates }: { rates: Rate[] }) {
  const { state, errors, onSubmit, pending } = useAdminForm(saveShippingRates);
  const byRegion = new Map(rates.map((rate) => [rate.region, rate]));

  return (
    <form onSubmit={onSubmit} className="grid gap-5" noValidate>
      <FormMessage state={state} />
      <div className="grid gap-4">
        {REGIONS.map((region: Region) => {
          const rate = byRegion.get(region);
          return (
            <fieldset key={region} className="grid gap-3 border-t border-line pt-4 first:border-t-0 first:pt-0">
              <legend className="float-left mb-1 text-sm font-semibold text-ink">{REGION_LABEL[region]}</legend>
              <div className="grid grid-cols-[1fr_5rem_5rem] gap-3">
                <Field id={`${region}-price`} label="Preço (R$)" error={errors[`${region}-price`]}>
                  <Input
                    id={`${region}-price`}
                    inputMode="decimal"
                    defaultValue={rate ? centsToField(rate.price_cents) : ""}
                    error={errors[`${region}-price`]}
                  />
                </Field>
                <Field id={`${region}-min`} label="De (dias)" error={errors[`${region}-min`]}>
                  <Input
                    id={`${region}-min`}
                    type="number"
                    inputMode="numeric"
                    min={1}
                    defaultValue={rate?.min_days}
                    error={errors[`${region}-min`]}
                  />
                </Field>
                <Field id={`${region}-max`} label="Até (dias)" error={errors[`${region}-max`]}>
                  <Input
                    id={`${region}-max`}
                    type="number"
                    inputMode="numeric"
                    min={1}
                    defaultValue={rate?.max_days}
                    error={errors[`${region}-max`]}
                  />
                </Field>
              </div>
            </fieldset>
          );
        })}
      </div>
      <Button type="submit" disabled={pending} className="justify-self-start">
        {pending ? "Salvando..." : "Salvar frete"}
      </Button>
    </form>
  );
}

type Delivery = {
  origin_zip: string | null;
  local_delivery_enabled: boolean;
  local_delivery_radius_km: number;
  local_delivery_price_cents: number;
  local_delivery_cutoff: string;
  pickup_enabled: boolean;
  pickup_address: string | null;
  pickup_hours: string | null;
};

export function DeliveryForm({ delivery }: { delivery: Delivery }) {
  const { state, errors, onSubmit, pending } = useAdminForm(saveDelivery);

  return (
    <form onSubmit={onSubmit} className="grid gap-5" noValidate>
      <FormMessage state={state} />
      <Field
        id="origin_zip"
        label="CEP do estoque"
        error={errors.origin_zip}
        hint="A distância até o cliente é medida a partir daqui."
      >
        <Input
          id="origin_zip"
          inputMode="numeric"
          autoComplete="off"
          defaultValue={delivery.origin_zip ? formatCep(delivery.origin_zip) : ""}
          className="max-w-40"
          hint
          error={errors.origin_zip}
        />
      </Field>

      <fieldset className="grid gap-4 border-t border-line pt-5">
        <legend className="sr-only">Entrega no mesmo dia</legend>
        <Checkbox
          id="local_delivery_enabled"
          label="Entrega no mesmo dia por motoboy"
          hint="Aparece no checkout para CEPs dentro do raio. A distância é em linha reta e, para muitos CEPs, conta a partir do centro do bairro ou da cidade."
          defaultChecked={delivery.local_delivery_enabled}
        />
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-3">
          <Field id="local_delivery_radius_km" label="Raio (km)" error={errors.local_delivery_radius_km}>
            <Input
              id="local_delivery_radius_km"
              inputMode="decimal"
              defaultValue={String(delivery.local_delivery_radius_km).replace(".", ",")}
              error={errors.local_delivery_radius_km}
            />
          </Field>
          <Field id="local_delivery_price" label="Preço (R$)" error={errors.local_delivery_price}>
            <Input
              id="local_delivery_price"
              inputMode="decimal"
              defaultValue={centsToField(delivery.local_delivery_price_cents)}
              error={errors.local_delivery_price}
            />
          </Field>
          <Field
            id="local_delivery_cutoff"
            label="Pago até (horário)"
            error={errors.local_delivery_cutoff}
            hint="Depois disso, sai no dia útil seguinte."
          >
            <Input
              id="local_delivery_cutoff"
              type="time"
              defaultValue={delivery.local_delivery_cutoff.slice(0, 5)}
              hint
              error={errors.local_delivery_cutoff}
            />
          </Field>
        </div>
      </fieldset>

      <fieldset className="grid gap-4 border-t border-line pt-5">
        <legend className="sr-only">Retirada</legend>
        <Checkbox
          id="pickup_enabled"
          label="Retirada na loja (grátis)"
          hint="Aparece para clientes do mesmo estado do estoque. O endereço e o horário aparecem no checkout."
          defaultChecked={delivery.pickup_enabled}
        />
        <Field id="pickup_address" label="Endereço de retirada" error={errors.pickup_address}>
          <Input
            id="pickup_address"
            maxLength={300}
            defaultValue={delivery.pickup_address ?? ""}
            placeholder="Rua, número, bairro, cidade"
            error={errors.pickup_address}
          />
        </Field>
        <Field id="pickup_hours" label="Horário de retirada" error={errors.pickup_hours} optional>
          <Input
            id="pickup_hours"
            maxLength={200}
            defaultValue={delivery.pickup_hours ?? ""}
            placeholder="Seg. a sex., 9h às 18h"
            error={errors.pickup_hours}
          />
        </Field>
      </fieldset>

      <Button type="submit" disabled={pending} className="justify-self-start">
        {pending ? "Salvando..." : "Salvar entrega local"}
      </Button>
    </form>
  );
}
