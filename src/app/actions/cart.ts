"use server";

import { productImageUrl } from "@/lib/catalog/images";
import { getStoreSettings } from "@/lib/catalog/queries";
import { priceCart, type VariantForQuote } from "@/lib/cart/pricing";
import { cartSchema, normalizeCart, type CartQuote } from "@/lib/cart/schema";
import { createClient } from "@/lib/supabase/server";

/**
 * Prices the cart from the database. The browser only sends variant ids and quantities;
 * prices, stock and totals always come from here (see priceCart).
 */
export async function quoteCart(input: unknown): Promise<CartQuote> {
  const items = normalizeCart(cartSchema.parse(input));
  const settings = await getStoreSettings();
  if (items.length === 0) return priceCart([], [], settings);

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("product_variants")
    .select(
      "id, name, price_cents, compare_at_price_cents, stock_quantity, is_active, product:products(slug, name, is_active, images:product_images(storage_path, position))",
    )
    .in(
      "id",
      items.map((i) => i.variantId),
    );
  if (error) throw new Error("Não foi possível atualizar o carrinho.");

  const variants: VariantForQuote[] = data.map((row) => {
    const image = row.product ? [...row.product.images].sort((a, b) => a.position - b.position)[0] : undefined;
    return {
      id: row.id,
      name: row.name,
      priceCents: row.price_cents,
      compareAtPriceCents: row.compare_at_price_cents,
      stock: row.stock_quantity,
      active: row.is_active,
      product: row.product
        ? {
            slug: row.product.slug,
            name: row.product.name,
            active: row.product.is_active,
            imageUrl: image ? productImageUrl(image.storage_path) : null,
          }
        : null,
    };
  });

  return priceCart(items, variants, settings);
}
