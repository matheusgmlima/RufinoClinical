"use client";

import { Moped, Package, Storefront } from "@phosphor-icons/react";
import { useEffect, useRef, useState, useSyncExternalStore, useTransition, type FormEvent } from "react";

import { estimateShipping, type ShippingEstimate } from "@/app/actions/shipping";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/field";
import { shippingDetail, shippingKey, shippingPrice, shippingTitle, sortShippingOptions } from "@/lib/shipping/options";
import { formatCep, onlyDigits } from "@/lib/validation/br";

const ICON = { standard: Package, local: Moped, pickup: Storefront } as const;
const STORAGE_KEY = "rufino:cep";
const FIND_CEP = "https://buscacepinter.correios.com.br/app/endereco/index.php";

function readSavedCep(): string {
  try {
    const saved = localStorage.getItem(STORAGE_KEY) ?? "";
    return /^\d{8}$/.test(saved) ? saved : "";
  } catch {
    return "";
  }
}
const noSubscription = () => () => {};

/** "Calcule o frete": every option and price for a CEP, straight from the database. */
export function ShippingCalculator({ variantId, quantity }: { variantId: string; quantity: number }) {
  // The last CEP comes back on every product (only in this browser) until the visitor types.
  const saved = useSyncExternalStore(noSubscription, readSavedCep, () => "");
  const [draft, setCep] = useState<string | null>(null);
  const cep = draft ?? saved;
  const [result, setResult] = useState<ShippingEstimate | null>(null);
  const [pending, start] = useTransition();
  const asked = useRef<string | null>(null);

  function run(digits: string) {
    asked.current = digits;
    start(async () => {
      const estimate = await estimateShipping({ cep: digits, variantId, quantity }).catch(() => ({
        error: "Sem conexão com a loja. Confira a internet e tente de novo.",
      }));
      setResult(estimate);
      if (!("error" in estimate)) {
        try {
          localStorage.setItem(STORAGE_KEY, digits);
        } catch {}
      }
    });
  }

  // A new option or quantity can cross the free-shipping line: price it again.
  useEffect(() => {
    if (asked.current) run(asked.current);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [variantId, quantity]);

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (cep.length !== 8) {
      setResult({ error: "Digite um CEP com 8 números." });
      return;
    }
    run(cep);
  }

  const error = result && "error" in result ? result.error : undefined;

  return (
    <div className="space-y-3">
      <form onSubmit={submit} className="grid gap-2" noValidate>
        <label htmlFor="frete-cep" className="text-sm font-semibold text-ink">
          Calcule o frete
        </label>
        <div className="flex gap-2">
          <Input
            id="frete-cep"
            inputMode="numeric"
            autoComplete="postal-code"
            placeholder="00000-000"
            value={formatCep(cep)}
            onChange={(e) => setCep(onlyDigits(e.target.value).slice(0, 8))}
            error={error}
            className="max-w-40"
          />
          <Button type="submit" variant="secondary" disabled={pending} className="h-12 shrink-0">
            {pending ? "Calculando..." : "Calcular"}
          </Button>
        </div>
        <a
          href={FIND_CEP}
          target="_blank"
          rel="noopener noreferrer"
          className="justify-self-start text-xs text-ink-muted underline hover:text-wine"
        >
          Não sei meu CEP
        </a>
      </form>

      <div aria-live="polite" aria-busy={pending}>
        {error ? (
          <p id="frete-cep-error" role="alert" className="text-sm font-medium text-wine">
            {error}
          </p>
        ) : result && !("error" in result) ? (
          result.options.length ? (
            <div className="space-y-2">
              <p className="text-xs text-ink-muted">
                Para {result.city} - {result.state}
              </p>
              <ul className="divide-y divide-line rounded-2xl border border-line bg-white">
                {sortShippingOptions(result.options).map((option) => {
                  const Icon = ICON[option.method];
                  return (
                    <li key={shippingKey(option)} className="flex gap-3 p-4 text-sm">
                      <Icon size={20} className="mt-0.5 shrink-0 text-wine" aria-hidden="true" />
                      <span className="min-w-0 flex-1">
                        <span className="flex flex-wrap justify-between gap-x-3 font-semibold text-ink">
                          {shippingTitle(option)}
                          <span className="tabular-nums">{shippingPrice(option)}</span>
                        </span>
                        <span className="mt-0.5 block text-ink-muted">{shippingDetail(option)}</span>
                      </span>
                    </li>
                  );
                })}
              </ul>
            </div>
          ) : (
            <p className="text-sm text-ink-muted">Ainda não entregamos nesse CEP.</p>
          )
        ) : null}
      </div>
    </div>
  );
}
