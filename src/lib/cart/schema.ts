import { z } from "zod";

export const MAX_CART_LINES = 20;
export const MAX_LINE_QUANTITY = 99;

export const cartItemSchema = z.object({
  variantId: z.uuid(),
  quantity: z.number().int().min(1).max(MAX_LINE_QUANTITY),
});

export const cartSchema = z.array(cartItemSchema).max(MAX_CART_LINES);

export type CartItem = z.infer<typeof cartItemSchema>;

export type QuoteLine = {
  variantId: string;
  productName: string;
  productSlug: string;
  variantName: string;
  imageUrl: string | null;
  unitPriceCents: number;
  compareAtPriceCents: number | null;
  quantity: number;
  maxQuantity: number;
  lineTotalCents: number;
};

export type CartQuote = {
  lines: QuoteLine[];
  /** Variants that no longer exist, were deactivated or sold out. */
  unavailable: string[];
  subtotalCents: number;
  pixTotalCents: number;
  pixDiscountPercent: number;
  installments: { count: number; amountCents: number };
};

/** Merges duplicate variants and keeps the first MAX_CART_LINES lines. */
export function normalizeCart(items: CartItem[]): CartItem[] {
  const merged = new Map<string, number>();
  for (const { variantId, quantity } of items) {
    merged.set(variantId, Math.min(MAX_LINE_QUANTITY, (merged.get(variantId) ?? 0) + quantity));
  }
  return [...merged].slice(0, MAX_CART_LINES).map(([variantId, quantity]) => ({ variantId, quantity }));
}
