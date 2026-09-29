import "server-only";
import { cache } from "react";

import { createClient } from "@/lib/supabase/server";

import { productImageUrl } from "./images";

// Reads go through the per-request client (publishable key + user session), so RLS only
// returns active products and variants.

export type StoreSettings = {
  pixDiscountPercent: number;
  maxInstallments: number;
  minInstallmentCents: number;
  freeShippingThresholdCents: number | null;
};

export type Category = { slug: string; name: string; description: string | null };

export type ProductImage = { url: string; alt: string };

export type ProductVariant = {
  id: string;
  name: string;
  priceCents: number;
  compareAtPriceCents: number | null;
  stock: number;
};

export type ProductSummary = {
  id: string;
  slug: string;
  name: string;
  shortDescription: string | null;
  category: Category | null;
  image: ProductImage | null;
  /** Lowest price among in-stock variants (or among all, if everything is sold out). */
  priceCents: number;
  compareAtPriceCents: number | null;
  inStock: boolean;
  /** True when variants have different prices ("a partir de"). */
  hasPriceRange: boolean;
};

export type ProductDetail = ProductSummary & {
  description: string | null;
  usageInstructions: string | null;
  indications: string | null;
  anvisaRegistration: string | null;
  seoTitle: string | null;
  seoDescription: string | null;
  images: ProductImage[];
  variants: ProductVariant[];
};

const PRODUCT_FIELDS = `
  id, slug, name, short_description, position, category_id,
  category:categories(slug, name, description),
  variants:product_variants(id, name, price_cents, compare_at_price_cents, stock_quantity, position, is_active),
  images:product_images(storage_path, alt, position)
`;

const DETAIL_FIELDS = `${PRODUCT_FIELDS}, description, usage_instructions, indications, anvisa_registration, seo_title, seo_description`;

type VariantRow = {
  id: string;
  name: string;
  price_cents: number;
  compare_at_price_cents: number | null;
  stock_quantity: number;
  position: number;
  is_active: boolean;
};
type ImageRow = { storage_path: string; alt: string; position: number };
type ProductRow = {
  id: string;
  slug: string;
  name: string;
  short_description: string | null;
  category: Category | null;
  variants: VariantRow[];
  images: ImageRow[];
};

const byPosition = <T extends { position: number }>(a: T, b: T) => a.position - b.position;

function toVariants(rows: VariantRow[]): ProductVariant[] {
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

function toImages(rows: ImageRow[]): ProductImage[] {
  return [...rows].sort(byPosition).map((i) => ({ url: productImageUrl(i.storage_path), alt: i.alt }));
}

function toSummary(row: ProductRow): ProductSummary | null {
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
    image: toImages(row.images)[0] ?? null,
    priceCents: cheapest.priceCents,
    compareAtPriceCents: cheapest.compareAtPriceCents,
    inStock: inStock.length > 0,
    hasPriceRange: new Set(variants.map((v) => v.priceCents)).size > 1,
  };
}

export const getStoreSettings = cache(async (): Promise<StoreSettings> => {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("store_settings")
    .select("pix_discount_percent, max_installments, min_installment_cents, free_shipping_threshold_cents")
    .single();
  if (error) throw error;
  return {
    pixDiscountPercent: Number(data.pix_discount_percent),
    maxInstallments: data.max_installments,
    minInstallmentCents: data.min_installment_cents,
    freeShippingThresholdCents: data.free_shipping_threshold_cents,
  };
});

export const getCategories = cache(async (): Promise<Category[]> => {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("categories")
    .select("slug, name, description")
    .eq("is_active", true)
    .order("position");
  if (error) throw error;
  return data;
});

export const getProducts = cache(
  async (filter: { categorySlug?: string; featured?: boolean } = {}): Promise<ProductSummary[]> => {
    const supabase = await createClient();
    let query = supabase.from("products").select(PRODUCT_FIELDS).eq("is_active", true).order("position");
    if (filter.featured) query = query.eq("is_featured", true);
    const { data, error } = await query.returns<ProductRow[]>();
    if (error) throw error;
    return data
      .filter((p) => !filter.categorySlug || p.category?.slug === filter.categorySlug)
      .map(toSummary)
      .filter((p): p is ProductSummary => p !== null);
  },
);

export const getProductBySlug = cache(async (slug: string): Promise<ProductDetail | null> => {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("products")
    .select(DETAIL_FIELDS)
    .eq("slug", slug)
    .eq("is_active", true)
    .returns<
      (ProductRow & {
        description: string | null;
        usage_instructions: string | null;
        indications: string | null;
        anvisa_registration: string | null;
        seo_title: string | null;
        seo_description: string | null;
      })[]
    >()
    .maybeSingle();
  if (error) throw error;
  if (!data) return null;
  const summary = toSummary(data);
  if (!summary) return null;
  return {
    ...summary,
    description: data.description,
    usageInstructions: data.usage_instructions,
    indications: data.indications,
    anvisaRegistration: data.anvisa_registration,
    seoTitle: data.seo_title,
    seoDescription: data.seo_description,
    images: toImages(data.images),
    variants: toVariants(data.variants),
  };
});
