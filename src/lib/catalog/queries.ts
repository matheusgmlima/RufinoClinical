import "server-only";
import { cache } from "react";

import type { CardTerms } from "@/lib/money";
import { createClient } from "@/lib/supabase/server";

import { productImageUrl } from "./images";
import { summarize, toImages, toVariants, type ImageRow, type VariantRow } from "./shape";
import { SLUG_PATTERN } from "./slug";

// Reads go through the per-request client (publishable key + user session), so RLS only
// returns active products and variants.

export type StoreSettings = CardTerms & {
  pixDiscountPercent: number;
  freeShippingThresholdCents: number | null;
};

export type Category = { slug: string; name: string; description: string | null };

export type ProductImage = { url: string; alt: string; variantId: string | null };

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

const SUMMARY_FIELDS = `
  id, slug, name, short_description,
  category:categories(slug, name, description),
  variants:product_variants(id, name, price_cents, compare_at_price_cents, stock_quantity, position, is_active),
  images:product_images(storage_path, alt, position, variant_id)
`;

export const getStoreSettings = cache(async (): Promise<StoreSettings> => {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("store_settings")
    .select(
      "pix_discount_percent, max_installments, interest_free_installments, min_installment_cents, free_shipping_threshold_cents",
    )
    .single();
  if (error) throw error;
  return {
    pixDiscountPercent: Number(data.pix_discount_percent),
    maxInstallments: data.max_installments,
    interestFreeInstallments: data.interest_free_installments,
    minInstallmentCents: data.min_installment_cents,
    freeShippingThresholdCents: data.free_shipping_threshold_cents,
  };
});

export type DeliverySettings = {
  /** Same-day courier around the stock; `city` is where the stock is. */
  local: { priceCents: number; cutoff: string; city: string | null } | null;
  pickup: { address: string; hours: string | null } | null;
};

/** Local delivery and pickup, for the product page, checkout and orders (not every page). */
export const getDeliverySettings = cache(async (): Promise<DeliverySettings> => {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("store_settings")
    .select(
      "origin_zip, local_delivery_enabled, local_delivery_price_cents, local_delivery_cutoff, pickup_enabled, pickup_address, pickup_hours",
    )
    .single();
  if (error) throw error;

  let city: string | null = null;
  if (data.local_delivery_enabled && data.origin_zip) {
    const { data: place } = await supabase.rpc("estimate_shipping", { p_zip: data.origin_zip });
    const found = (place as { city?: unknown } | null)?.city;
    city = typeof found === "string" ? found : null;
  }
  return {
    local: data.local_delivery_enabled
      ? { priceCents: data.local_delivery_price_cents, cutoff: data.local_delivery_cutoff.slice(0, 5), city }
      : null,
    pickup:
      data.pickup_enabled && data.pickup_address ? { address: data.pickup_address, hours: data.pickup_hours } : null,
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
    let query = supabase.from("products").select(SUMMARY_FIELDS).eq("is_active", true).order("position");
    if (filter.featured) query = query.eq("is_featured", true);
    if (filter.categorySlug) {
      if (!SLUG_PATTERN.test(filter.categorySlug)) return [];
      const { data: category } = await supabase
        .from("categories")
        .select("id")
        .eq("slug", filter.categorySlug)
        .maybeSingle();
      if (!category) return [];
      query = query.eq("category_id", category.id);
    }
    const { data, error } = await query;
    if (error) throw error;
    return data.map((row) => summarize(row, productImageUrl)).filter((p): p is ProductSummary => p !== null);
  },
);

export const getProductBySlug = cache(async (slug: string): Promise<ProductDetail | null> => {
  if (!SLUG_PATTERN.test(slug) || slug.length > 120) return null;
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("products")
    .select(
      `${SUMMARY_FIELDS}, description, usage_instructions, indications, anvisa_registration, seo_title, seo_description`,
    )
    .eq("slug", slug)
    .eq("is_active", true)
    .maybeSingle();
  if (error) throw error;
  if (!data) return null;
  const summary = summarize(data, productImageUrl);
  if (!summary) return null;
  return {
    ...summary,
    description: data.description,
    usageInstructions: data.usage_instructions,
    indications: data.indications,
    anvisaRegistration: data.anvisa_registration,
    seoTitle: data.seo_title,
    seoDescription: data.seo_description,
    images: toImages(data.images as ImageRow[], productImageUrl),
    variants: toVariants(data.variants as VariantRow[]),
  };
});
