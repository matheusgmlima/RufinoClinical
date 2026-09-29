import { installmentPlan, pixPriceCents } from "@/lib/money";

import { MAX_LINE_QUANTITY, type CartItem, type CartQuote, type QuoteLine } from "./core";

/** A variant as loaded from the database, with its product. */
export type VariantForQuote = {
  id: string;
  name: string;
  priceCents: number;
  compareAtPriceCents: number | null;
  stock: number;
  active: boolean;
  product: { slug: string; name: string; active: boolean; imageUrl: string | null } | null;
};

export type PricingSettings = { pixDiscountPercent: number; maxInstallments: number; minInstallmentCents: number };

/**
 * Prices cart lines strictly from database rows. Items that are missing, inactive or sold out
 * are reported as unavailable; quantities are clamped to stock. Pure, so it is unit-tested.
 */
export function priceCart(items: CartItem[], variants: VariantForQuote[], settings: PricingSettings): CartQuote {
  const byId = new Map(variants.map((v) => [v.id, v]));
  const lines: QuoteLine[] = [];
  const unavailable: string[] = [];

  for (const item of items) {
    const variant = byId.get(item.variantId);
    if (!variant || !variant.active || !variant.product?.active || variant.stock < 1) {
      unavailable.push(item.variantId);
      continue;
    }
    const maxQuantity = Math.min(variant.stock, MAX_LINE_QUANTITY);
    const quantity = Math.min(item.quantity, maxQuantity);
    lines.push({
      variantId: variant.id,
      productName: variant.product.name,
      productSlug: variant.product.slug,
      variantName: variant.name,
      imageUrl: variant.product.imageUrl,
      unitPriceCents: variant.priceCents,
      compareAtPriceCents: variant.compareAtPriceCents,
      quantity,
      maxQuantity,
      lineTotalCents: variant.priceCents * quantity,
    });
  }

  const subtotalCents = lines.reduce((sum, line) => sum + line.lineTotalCents, 0);
  return {
    lines,
    unavailable,
    subtotalCents,
    pixTotalCents: pixPriceCents(subtotalCents, settings.pixDiscountPercent),
    pixDiscountPercent: settings.pixDiscountPercent,
    installments:
      subtotalCents > 0
        ? installmentPlan(subtotalCents, settings.maxInstallments, settings.minInstallmentCents)
        : { count: 1, amountCents: 0 },
  };
}
