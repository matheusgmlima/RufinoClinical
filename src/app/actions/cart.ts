"use server";

import { getStoreSettings } from "@/lib/catalog/queries";
import { productImageUrl } from "@/lib/catalog/images";
import { cartSchema, normalizeCart, type CartQuote, type QuoteLine, MAX_LINE_QUANTITY } from "@/lib/cart/schema";
import { installmentPlan, pixPriceCents } from "@/lib/money";
import { createClient } from "@/lib/supabase/server";

type VariantRow = {
  id: string;
  name: string;
  price_cents: number;
  compare_at_price_cents: number | null;
  stock_quantity: number;
  is_active: boolean;
  product: {
    slug: string;
    name: string;
    is_active: boolean;
    images: { storage_path: string; alt: string; position: number }[];
  } | null;
};

/**
 * Prices the cart from the database. The browser only sends variant ids and quantities;
 * prices, stock and totals always come from here. Quantities are clamped to available stock.
 */
export async function quoteCart(input: unknown): Promise<CartQuote> {
  const items = normalizeCart(cartSchema.parse(input));
  const settings = await getStoreSettings();
  const empty: CartQuote = {
    lines: [],
    unavailable: [],
    subtotalCents: 0,
    pixTotalCents: 0,
    pixDiscountPercent: settings.pixDiscountPercent,
    installments: { count: 1, amountCents: 0 },
  };
  if (items.length === 0) return empty;

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("product_variants")
    .select(
      "id, name, price_cents, compare_at_price_cents, stock_quantity, is_active, product:products(slug, name, is_active, images:product_images(storage_path, alt, position))",
    )
    .in(
      "id",
      items.map((i) => i.variantId),
    )
    .returns<VariantRow[]>();
  if (error) throw new Error("Não foi possível atualizar o carrinho.");

  const rows = new Map(data.map((row) => [row.id, row]));
  const lines: QuoteLine[] = [];
  const unavailable: string[] = [];

  for (const item of items) {
    const row = rows.get(item.variantId);
    if (!row || !row.is_active || !row.product?.is_active || row.stock_quantity < 1) {
      unavailable.push(item.variantId);
      continue;
    }
    const maxQuantity = Math.min(row.stock_quantity, MAX_LINE_QUANTITY);
    const quantity = Math.min(item.quantity, maxQuantity);
    const image = [...row.product.images].sort((a, b) => a.position - b.position)[0];
    lines.push({
      variantId: row.id,
      productName: row.product.name,
      productSlug: row.product.slug,
      variantName: row.name,
      imageUrl: image ? productImageUrl(image.storage_path) : null,
      unitPriceCents: row.price_cents,
      compareAtPriceCents: row.compare_at_price_cents,
      quantity,
      maxQuantity,
      lineTotalCents: row.price_cents * quantity,
    });
  }

  const subtotalCents = lines.reduce((sum, line) => sum + line.lineTotalCents, 0);
  return {
    lines,
    unavailable,
    subtotalCents,
    pixTotalCents: pixPriceCents(subtotalCents, settings.pixDiscountPercent),
    pixDiscountPercent: settings.pixDiscountPercent,
    installments: installmentPlan(subtotalCents, settings.maxInstallments, settings.minInstallmentCents),
  };
}
