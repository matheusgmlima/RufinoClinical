"use client";

import { Check, ShoppingBag } from "@phosphor-icons/react";
import { useEffect, useRef, useState } from "react";

import { useCart } from "@/components/cart/cart-provider";
import { QuantityStepper } from "@/components/cart/cart-contents";
import { Button } from "@/components/ui/button";
import type { ProductVariant, StoreSettings } from "@/lib/catalog/queries";
import { formatBRL, pixPriceCents } from "@/lib/money";

import { Price } from "./price";

const LOW_STOCK = 5;

export function ProductPurchase({
  productName,
  variants,
  settings,
}: {
  productName: string;
  variants: ProductVariant[];
  settings: StoreSettings;
}) {
  const firstAvailable = variants.find((v) => v.stock > 0) ?? variants[0];
  const [variantId, setVariantId] = useState(firstAvailable.id);
  const [quantity, setQuantity] = useState(1);
  const [added, setAdded] = useState(false);
  const { add, setOpen } = useCart();
  const actionsRef = useRef<HTMLDivElement>(null);
  const [showBar, setShowBar] = useState(false);

  // On phones, a buy bar slides in once the main button has scrolled out of view above.
  useEffect(() => {
    const el = actionsRef.current;
    if (!el) return;
    // The huge bottom margin makes "below the viewport" count as intersecting, so the state only
    // flips when the button passes the top edge, even on a fast fling that skips over the viewport.
    const observer = new IntersectionObserver(([entry]) => setShowBar(!entry.isIntersecting), {
      rootMargin: "0px 0px 100000px 0px",
    });
    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  const variant = variants.find((v) => v.id === variantId) ?? firstAvailable;
  const soldOut = variant.stock < 1;
  const maxQuantity = Math.max(1, Math.min(variant.stock, 99));

  function selectVariant(id: string) {
    setVariantId(id);
    setQuantity(1);
    setAdded(false);
  }

  function handleAdd() {
    add(variant.id, Math.min(quantity, maxQuantity));
    setAdded(true);
    setOpen(true);
  }

  return (
    <div className="space-y-7">
      <Price
        priceCents={variant.priceCents}
        compareAtPriceCents={variant.compareAtPriceCents}
        settings={settings}
        size="lg"
      />

      {variants.length > 1 ? (
        <fieldset className="space-y-3">
          <legend className="text-sm font-semibold text-ink">
            Opção: <span className="font-medium text-ink-muted">{variant.name}</span>
          </legend>
          <div className="flex flex-wrap gap-2">
            {variants.map((v) => {
              const selected = v.id === variant.id;
              const unavailable = v.stock < 1;
              return (
                <label
                  key={v.id}
                  className={`relative inline-flex h-10 min-w-12 cursor-pointer items-center justify-center rounded-full border px-4 text-sm font-medium transition has-[:focus-visible]:outline-2 has-[:focus-visible]:outline-offset-2 has-[:focus-visible]:outline-wine ${
                    selected ? "border-wine bg-wine text-cream" : "border-line bg-cream text-ink hover:border-wine/50"
                  } ${unavailable ? "text-ink-muted line-through decoration-1" : ""}`}
                >
                  <input
                    type="radio"
                    name="variant"
                    value={v.id}
                    checked={selected}
                    onChange={() => selectVariant(v.id)}
                    className="sr-only"
                  />
                  {v.name}
                  {unavailable ? <span className="sr-only"> (esgotado)</span> : null}
                </label>
              );
            })}
          </div>
        </fieldset>
      ) : null}

      <div ref={actionsRef} className="space-y-3">
        <div className="flex flex-wrap items-center gap-3">
          {!soldOut ? (
            <QuantityStepper value={quantity} max={maxQuantity} label={productName} onChange={setQuantity} />
          ) : null}
          <Button size="lg" onClick={handleAdd} disabled={soldOut} className="flex-1 sm:flex-none">
            {added ? <Check size={20} weight="bold" aria-hidden="true" /> : <ShoppingBag size={20} aria-hidden="true" />}
            {soldOut ? "Esgotado" : added ? "Adicionado" : "Adicionar ao carrinho"}
          </Button>
        </div>
        <p className="text-sm text-ink-muted" aria-live="polite">
          {soldOut
            ? "Esta opção está esgotada no momento."
            : variant.stock <= LOW_STOCK
              ? `Restam só ${variant.stock} ${variant.stock === 1 ? "unidade" : "unidades"}.`
              : "Em estoque, pronto para envio."}
        </p>
      </div>

      <div
        inert={!showBar}
        className={`fixed inset-x-0 bottom-0 z-20 border-t border-line bg-cream/95 px-4 pt-3 backdrop-blur-md transition-transform duration-300 ease-out pb-[calc(0.75rem+env(safe-area-inset-bottom,0px))] lg:hidden ${
          showBar ? "translate-y-0" : "translate-y-full"
        }`}
      >
        <div className="flex items-center gap-3">
          <div className="min-w-0 flex-1">
            <p className="truncate text-sm font-semibold text-ink">
              {productName}
              {variants.length > 1 ? <span className="font-medium text-ink-muted"> · {variant.name}</span> : null}
            </p>
            <p className="text-sm font-semibold text-wine tabular-nums">
              {formatBRL(pixPriceCents(variant.priceCents, settings.pixDiscountPercent))} no Pix
            </p>
          </div>
          <Button onClick={handleAdd} disabled={soldOut}>
            <ShoppingBag size={18} aria-hidden="true" />
            {soldOut ? "Esgotado" : "Adicionar"}
          </Button>
        </div>
      </div>
    </div>
  );
}
