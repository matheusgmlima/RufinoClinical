import { describe, expect, it } from "vitest";

import { cardClaim, cardOffer, formatBRL, installmentPlan, pixPriceCents } from "./money";

describe("formatBRL", () => {
  it("formats cents as Brazilian reais", () => {
    expect(formatBRL(4990).replace(/\s/g, " ")).toBe("R$ 49,90");
    expect(formatBRL(128990).replace(/\s/g, " ")).toBe("R$ 1.289,90");
  });
});

describe("pixPriceCents", () => {
  it("applies the percentage and rounds to the cent", () => {
    expect(pixPriceCents(4990, 5)).toBe(4741);
    expect(pixPriceCents(28990, 5)).toBe(27541);
    expect(pixPriceCents(1000, 0)).toBe(1000);
  });
});

describe("installmentPlan", () => {
  it("caps installments at the store maximum", () => {
    expect(installmentPlan(28990, 6, 3000)).toEqual({ count: 6, amountCents: 4832 });
  });

  it("keeps each installment above the minimum", () => {
    expect(installmentPlan(8990, 6, 3000)).toEqual({ count: 2, amountCents: 4495 });
  });

  it("never returns fewer than one installment", () => {
    expect(installmentPlan(1990, 6, 3000)).toEqual({ count: 1, amountCents: 1990 });
  });
});

describe("card terms", () => {
  const terms = { maxInstallments: 6, interestFreeInstallments: 3, minInstallmentCents: 3000 };
  const buyerPays = { ...terms, interestFreeInstallments: 1 };
  const text = (value: string | null) => value?.replace(/\s/g, " ");

  it("promises 'sem juros' only up to the interest-free installments", () => {
    expect(cardClaim(terms)).toBe("até 3x sem juros");
    expect(text(cardOffer(28990, terms))).toBe("3x de R$ 96,63 sem juros");
    expect(text(cardOffer(8990, terms))).toBe("2x de R$ 44,95 sem juros");
  });

  it("never says 'sem juros' when the buyer pays all interest", () => {
    expect(cardClaim(buyerPays)).toBe("parcelamento em até 6x");
    expect(cardOffer(28990, buyerPays)).toBe("até 6x no cartão");
    expect(cardOffer(1990, buyerPays)).toBeNull();
    expect(cardClaim({ ...buyerPays, maxInstallments: 1 })).toBeNull();
  });
});
