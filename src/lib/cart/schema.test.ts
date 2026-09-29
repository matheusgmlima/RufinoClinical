import { describe, expect, it } from "vitest";

import { cartSchema, MAX_CART_LINES, normalizeCart } from "./schema";

const id = (n: number) => `00000000-0000-4000-8000-${String(n).padStart(12, "0")}`;

describe("cartSchema", () => {
  it("rejects malformed ids, zero or huge quantities and oversized carts", () => {
    expect(cartSchema.safeParse([{ variantId: "1; drop table", quantity: 1 }]).success).toBe(false);
    expect(cartSchema.safeParse([{ variantId: id(1), quantity: 0 }]).success).toBe(false);
    expect(cartSchema.safeParse([{ variantId: id(1), quantity: 100 }]).success).toBe(false);
    expect(cartSchema.safeParse([{ variantId: id(1), quantity: 1.5 }]).success).toBe(false);
    const big = Array.from({ length: MAX_CART_LINES + 1 }, (_, i) => ({ variantId: id(i), quantity: 1 }));
    expect(cartSchema.safeParse(big).success).toBe(false);
  });

  it("ignores client-sent prices", () => {
    const parsed = cartSchema.parse([{ variantId: id(1), quantity: 2, priceCents: 1 }]);
    expect(parsed).toEqual([{ variantId: id(1), quantity: 2 }]);
  });
});

describe("normalizeCart", () => {
  it("merges duplicates and caps quantity", () => {
    expect(normalizeCart([
      { variantId: id(1), quantity: 60 },
      { variantId: id(1), quantity: 60 },
      { variantId: id(2), quantity: 1 },
    ])).toEqual([
      { variantId: id(1), quantity: 99 },
      { variantId: id(2), quantity: 1 },
    ]);
  });
});
