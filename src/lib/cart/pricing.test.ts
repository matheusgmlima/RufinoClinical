import { describe, expect, it } from "vitest";

import { priceCart, type VariantForQuote } from "./pricing";

const settings = { pixDiscountPercent: 5, maxInstallments: 6, interestFreeInstallments: 3, minInstallmentCents: 3000 };
const id = (n: number) => `00000000-0000-4000-8000-${String(n).padStart(12, "0")}`;

function variant(n: number, overrides: Partial<VariantForQuote> = {}): VariantForQuote {
  return {
    id: id(n),
    name: `Variante ${n}`,
    priceCents: 4990,
    compareAtPriceCents: null,
    stock: 10,
    active: true,
    product: { slug: `produto-${n}`, name: `Produto ${n}`, active: true, imageUrl: null },
    ...overrides,
  };
}

describe("priceCart", () => {
  it("uses database prices and computes totals", () => {
    const quote = priceCart([{ variantId: id(1), quantity: 2 }], [variant(1)], settings);
    expect(quote.lines[0].unitPriceCents).toBe(4990);
    expect(quote.subtotalCents).toBe(9980);
    expect(quote.pixTotalCents).toBe(9481);
    expect(quote.cardOffer?.replace(/\s/g, " ")).toBe("3x de R$ 33,27 sem juros");
  });

  it("clamps quantity to available stock", () => {
    const quote = priceCart([{ variantId: id(1), quantity: 99 }], [variant(1, { stock: 3 })], settings);
    expect(quote.lines[0]).toMatchObject({ quantity: 3, maxQuantity: 3, lineTotalCents: 14970 });
  });

  it("reports missing, inactive and sold-out items as unavailable", () => {
    const quote = priceCart(
      [
        { variantId: id(1), quantity: 1 },
        { variantId: id(2), quantity: 1 },
        { variantId: id(3), quantity: 1 },
        { variantId: id(4), quantity: 1 },
        { variantId: id(5), quantity: 1 },
      ],
      [
        variant(2, { active: false }),
        variant(3, { product: { slug: "x", name: "X", active: false, imageUrl: null } }),
        variant(4, { stock: 0 }),
        variant(5),
      ],
      settings,
    );
    expect(quote.unavailable).toEqual([id(1), id(2), id(3), id(4)]);
    expect(quote.lines.map((l) => l.variantId)).toEqual([id(5)]);
  });

  it("returns an empty quote for an empty cart", () => {
    expect(priceCart([], [], settings)).toMatchObject({ lines: [], subtotalCents: 0, pixTotalCents: 0 });
  });
});
