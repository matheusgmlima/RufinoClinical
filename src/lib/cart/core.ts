// Cart types and helpers shared by the browser and the server. No dependencies, so the
// client bundle stays small; the server re-validates everything with zod (see schema.ts).

export const MAX_CART_LINES = 20;
export const MAX_LINE_QUANTITY = 99;

export type CartItem = { variantId: string; quantity: number };

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
  /** Card installments for the subtotal (see cardOffer). */
  cardOffer: string | null;
};

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** Parses one stored cart line, dropping unknown fields (such as a tampered price). */
export function parseCartItem(value: unknown): CartItem | null {
  if (typeof value !== "object" || value === null) return null;
  const { variantId, quantity } = value as Record<string, unknown>;
  if (typeof variantId !== "string" || !UUID.test(variantId)) return null;
  if (typeof quantity !== "number" || !Number.isInteger(quantity) || quantity < 1 || quantity > MAX_LINE_QUANTITY) {
    return null;
  }
  return { variantId, quantity };
}

/** Merges duplicate variants and keeps the first MAX_CART_LINES lines. */
export function normalizeCart(items: CartItem[]): CartItem[] {
  const merged = new Map<string, number>();
  for (const { variantId, quantity } of items) {
    merged.set(variantId, Math.min(MAX_LINE_QUANTITY, (merged.get(variantId) ?? 0) + quantity));
  }
  return [...merged].slice(0, MAX_CART_LINES).map(([variantId, quantity]) => ({ variantId, quantity }));
}
