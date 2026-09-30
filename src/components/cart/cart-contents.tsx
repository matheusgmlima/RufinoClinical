"use client";

import { Info, Minus, Plus, Trash, WarningCircle } from "@phosphor-icons/react";
import Image from "next/image";
import Link from "next/link";

import { LogoSymbol } from "@/components/brand/logo";
import { ButtonLink } from "@/components/ui/button";
import { formatBRL } from "@/lib/money";

import { useCart, useCartQuote } from "./cart-provider";

type Props = { onNavigate?: () => void; variant: "drawer" | "page" };

export function CartContents({ onNavigate, variant }: Props) {
  const { items, setQuantity, remove } = useCart();
  const { quote, pending, error, adjusted } = useCartQuote();
  const page = variant === "page";

  if (!pending && items.length === 0) {
    return (
      <div className="flex flex-1 flex-col items-center justify-center gap-5 px-6 py-16 text-center">
        <LogoSymbol className="h-16 w-auto text-wine/15" />
        <div className="space-y-1.5">
          <p className="text-lg font-semibold text-ink">Seu carrinho está vazio</p>
          <p className="text-sm text-ink-muted">Os produtos que você adicionar aparecem aqui.</p>
        </div>
        <ButtonLink href="/produtos" onClick={onNavigate}>
          Ver produtos
        </ButtonLink>
      </div>
    );
  }

  const lines = quote?.lines ?? [];
  const showSkeleton = !quote && pending;

  return (
    <div className={page ? "grid gap-10 lg:grid-cols-12" : "flex min-h-0 flex-1 flex-col"}>
      <div className={page ? "lg:col-span-7" : "min-h-0 flex-1 overflow-y-auto px-6"}>
        {error ? (
          <p role="alert" className="my-4 flex items-center gap-2 rounded-2xl bg-blush px-4 py-3 text-sm text-wine">
            <WarningCircle size={18} weight="bold" aria-hidden="true" />
            Não foi possível atualizar os preços. Verifique sua conexão.
          </p>
        ) : null}
        {adjusted ? (
          <p role="status" className="my-4 flex items-start gap-2 rounded-2xl bg-blush px-4 py-3 text-sm text-ink">
            <Info size={18} weight="bold" className="mt-0.5 shrink-0 text-wine" aria-hidden="true" />
            Atualizamos seu carrinho: itens esgotados saíram e as quantidades foram ajustadas ao estoque.
          </p>
        ) : null}

        <ul className="divide-y divide-line" aria-busy={pending}>
          {showSkeleton
            ? items.map((item) => (
                <li key={item.variantId} className="flex gap-4 py-5" aria-hidden="true">
                  <div className="size-20 shrink-0 animate-pulse rounded-2xl bg-blush" />
                  <div className="flex-1 space-y-2 pt-1">
                    <div className="h-4 w-3/4 animate-pulse rounded-full bg-blush" />
                    <div className="h-3 w-1/3 animate-pulse rounded-full bg-blush" />
                  </div>
                </li>
              ))
            : lines.map((line) => (
                <li key={line.variantId} className="flex gap-4 py-5">
                  <Link
                    href={`/produtos/${line.productSlug}`}
                    onClick={onNavigate}
                    aria-hidden="true"
                    tabIndex={-1}
                    className="relative size-20 shrink-0 overflow-hidden rounded-2xl bg-blush"
                  >
                    {line.imageUrl ? (
                      <Image src={line.imageUrl} alt="" fill sizes="80px" className="object-cover" />
                    ) : (
                      <LogoSymbol className="absolute inset-0 m-auto h-1/2 w-auto text-wine/15" />
                    )}
                  </Link>
                  <div className="flex min-w-0 flex-1 flex-col gap-3">
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <Link
                          href={`/produtos/${line.productSlug}`}
                          onClick={onNavigate}
                          className="text-sm font-semibold leading-snug text-ink hover:text-wine"
                        >
                          {line.productName}
                        </Link>
                        <p className="mt-0.5 text-xs text-ink-muted">{line.variantName}</p>
                      </div>
                      <p className="text-sm font-semibold text-ink tabular-nums">{formatBRL(line.lineTotalCents)}</p>
                    </div>
                    <div className="flex items-center justify-between">
                      <QuantityStepper
                        value={line.quantity}
                        max={line.maxQuantity}
                        label={line.productName}
                        onChange={(q) => setQuantity(line.variantId, q)}
                      />
                      <button
                        type="button"
                        onClick={() => remove(line.variantId)}
                        className="inline-flex items-center gap-1.5 rounded-full px-2 py-1 text-xs font-medium text-ink-muted hover:text-wine"
                      >
                        <Trash size={16} aria-hidden="true" />
                        Remover
                      </button>
                    </div>
                    {line.quantity >= line.maxQuantity ? (
                      <p className="text-xs text-ink-muted">Quantidade máxima disponível em estoque.</p>
                    ) : null}
                  </div>
                </li>
              ))}
        </ul>
      </div>

      <div
        className={
          page
            ? "h-fit rounded-2xl bg-blush p-6 lg:sticky lg:top-24 lg:col-span-5"
            : "border-t border-line bg-cream px-6 pb-6 pt-5"
        }
      >
        <dl className="space-y-2 text-sm" aria-live="polite">
          <div className="flex justify-between text-ink-muted">
            <dt>Subtotal</dt>
            <dd className="tabular-nums">{quote ? formatBRL(quote.subtotalCents) : "..."}</dd>
          </div>
          <div className="flex justify-between text-ink-muted">
            <dt>Frete</dt>
            <dd>Calculado no checkout</dd>
          </div>
          <div className="flex items-baseline justify-between pt-2 text-ink">
            <dt className="font-semibold">Total no Pix</dt>
            <dd className="text-xl font-semibold tabular-nums text-wine">
              {quote ? formatBRL(quote.pixTotalCents) : "..."}
            </dd>
          </div>
          {quote?.cardOffer ? (
            <p className="text-right text-xs text-ink-muted">
              ou {formatBRL(quote.subtotalCents)} em {quote.cardOffer}
            </p>
          ) : null}
        </dl>
        <div className="mt-5 space-y-2">
          {lines.length > 0 ? (
            <ButtonLink href="/checkout" size="lg" onClick={onNavigate} className="w-full">
              Finalizar compra
            </ButtonLink>
          ) : null}
          {!page ? (
            <ButtonLink href="/carrinho" variant="ghost" onClick={onNavigate} className="w-full">
              Ver carrinho completo
            </ButtonLink>
          ) : null}
        </div>
      </div>
    </div>
  );
}

export function QuantityStepper({
  value,
  max,
  label,
  onChange,
}: {
  value: number;
  max: number;
  label: string;
  onChange: (value: number) => void;
}) {
  return (
    <div className="inline-flex h-9 items-center rounded-full border border-line bg-cream">
      <button
        type="button"
        onClick={() => onChange(value - 1)}
        disabled={value <= 1}
        aria-label={`Diminuir quantidade de ${label}`}
        className="flex size-9 items-center justify-center rounded-full text-ink hover:text-wine disabled:opacity-35"
      >
        <Minus size={14} weight="bold" aria-hidden="true" />
      </button>
      <span className="w-7 text-center text-sm font-semibold tabular-nums" aria-live="polite">
        {value}
      </span>
      <button
        type="button"
        onClick={() => onChange(value + 1)}
        disabled={value >= max}
        aria-label={`Aumentar quantidade de ${label}`}
        className="flex size-9 items-center justify-center rounded-full text-ink hover:text-wine disabled:opacity-35"
      >
        <Plus size={14} weight="bold" aria-hidden="true" />
      </button>
    </div>
  );
}
