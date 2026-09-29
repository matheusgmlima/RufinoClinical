// Pure mapping from database rows to storefront shapes (unit-tested, no I/O).
import type { Category, ProductImage, ProductSummary, ProductVariant } from "./queries";

export type VariantRow = {
  id: string;
  name: string;
  price_cents: number;
  compare_at_price_cents: number | null;
  stock_quantity: number;
  position: number;
  is_active: boolean;
};

export type ImageRow = { storage_path: string; alt: string; position: number; variant_id: string | null };

export type ProductRow = {
  id: string;
  slug: string;
  name: string;
  short_description: string | null;
  category: Category | null;
  variants: VariantRow[];
  images: ImageRow[];
};

const byPosition = <T extends { position: number }>(a: T, b: T) => a.position - b.position;

export function toVariants(rows: VariantRow[]): ProductVariant[] {
  return rows
    .filter((v) => v.is_active)
    .sort(byPosition)
    .map((v) => ({
      id: v.id,
      name: v.name,
      priceCents: v.price_cents,
      compareAtPriceCents: v.compare_at_price_cents,
      stock: v.stock_quantity,
    }));
}

export function toImages(rows: ImageRow[], urlFor: (path: string) => string): ProductImage[] {
  return [...rows]
    .sort(byPosition)
    .map((i) => ({ url: urlFor(i.storage_path), alt: i.alt, variantId: i.variant_id }));
}

/** Card data for a product, or null when it has no active variant (it cannot be sold). */
export function summarize(row: ProductRow, urlFor: (path: string) => string): ProductSummary | null {
  const variants = toVariants(row.variants);
  if (variants.length === 0) return null;
  const inStock = variants.filter((v) => v.stock > 0);
  const cheapest = [...(inStock.length ? inStock : variants)].sort((a, b) => a.priceCents - b.priceCents)[0];
  return {
    id: row.id,
    slug: row.slug,
    name: row.name,
    shortDescription: row.short_description,
    category: row.category,
    image: toImages(row.images, urlFor)[0] ?? null,
    priceCents: cheapest.priceCents,
    compareAtPriceCents: cheapest.compareAtPriceCents,
    inStock: inStock.length > 0,
    hasPriceRange: new Set(variants.map((v) => v.priceCents)).size > 1,
  };
}
