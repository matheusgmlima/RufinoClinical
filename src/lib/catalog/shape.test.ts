import { describe, expect, it } from "vitest";

import { summarize, type ProductRow, type VariantRow } from "./shape";

const url = (path: string) => `https://cdn.test/${path}`;

function variant(overrides: Partial<VariantRow>): VariantRow {
  return {
    id: "v",
    name: "Único",
    price_cents: 1000,
    compare_at_price_cents: null,
    stock_quantity: 5,
    position: 0,
    is_active: true,
    ...overrides,
  };
}

function product(variants: VariantRow[], images: ProductRow["images"] = []): ProductRow {
  return { id: "p", slug: "p", name: "Produto", short_description: null, category: null, variants, images };
}

describe("summarize", () => {
  it("shows the cheapest in-stock price and flags price ranges", () => {
    const s = summarize(
      product([
        variant({ id: "a", price_cents: 900, stock_quantity: 0 }),
        variant({ id: "b", price_cents: 1200 }),
        variant({ id: "c", price_cents: 1500 }),
      ]),
      url,
    );
    expect(s).toMatchObject({ priceCents: 1200, inStock: true, hasPriceRange: true });
  });

  it("does not flag a range when every variant has the same price", () => {
    const s = summarize(product([variant({ id: "a" }), variant({ id: "b" })]), url);
    expect(s?.hasPriceRange).toBe(false);
  });

  it("marks sold-out products and falls back to the cheapest price", () => {
    const s = summarize(
      product([variant({ id: "a", price_cents: 800, stock_quantity: 0 }), variant({ id: "b", stock_quantity: 0 })]),
      url,
    );
    expect(s).toMatchObject({ priceCents: 800, inStock: false });
  });

  it("hides products without active variants", () => {
    expect(summarize(product([variant({ is_active: false })]), url)).toBeNull();
  });

  it("uses the first image by position", () => {
    const s = summarize(
      product(
        [variant({})],
        [
          { storage_path: "products/b.jpg", alt: "B", position: 2, variant_id: null },
          { storage_path: "products/a.jpg", alt: "A", position: 1, variant_id: null },
        ],
      ),
      url,
    );
    expect(s?.image).toEqual({ url: "https://cdn.test/products/a.jpg", alt: "A", variantId: null });
  });
});
