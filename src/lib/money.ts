const brl = new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" });

export function formatBRL(cents: number): string {
  return brl.format(cents / 100);
}

/** Price after the Pix discount, rounded to the cent. */
export function pixPriceCents(cents: number, discountPercent: number): number {
  return Math.round((cents * (100 - discountPercent)) / 100);
}

export type InstallmentPlan = { count: number; amountCents: number };

/**
 * Installments without interest: as many as allowed while each one stays at or above the minimum.
 * The gateway computes the exact split at checkout; this is the display value.
 */
export function installmentPlan(cents: number, maxInstallments: number, minInstallmentCents: number): InstallmentPlan {
  const count = Math.max(1, Math.min(maxInstallments, Math.floor(cents / minInstallmentCents)));
  return { count, amountCents: Math.round(cents / count) };
}

/**
 * Card terms. The store pays the interest up to `interestFreeInstallments` (Mercado Pago account
 * setting "parcelamento sem juros"); above it, up to `maxInstallments`, the buyer pays it.
 */
export type CardTerms = { maxInstallments: number; interestFreeInstallments: number; minInstallmentCents: number };

/** Store-wide claim: "até 3x sem juros", or "parcelamento em até 6x" when the buyer pays all interest. */
export function cardClaim(terms: CardTerms): string | null {
  if (terms.interestFreeInstallments > 1) return `até ${terms.interestFreeInstallments}x sem juros`;
  return terms.maxInstallments > 1 ? `parcelamento em até ${terms.maxInstallments}x` : null;
}

/**
 * Offer for an amount: "3x de R$ 33,27 sem juros", or "até 6x no cartão" when no installment is
 * interest-free (the gateway shows the buyer's interest). Null when it cannot be split.
 */
export function cardOffer(cents: number, terms: CardTerms): string | null {
  const free = installmentPlan(cents, terms.interestFreeInstallments, terms.minInstallmentCents);
  if (free.count > 1) return `${free.count}x de ${formatBRL(free.amountCents)} sem juros`;
  const count = installmentPlan(cents, terms.maxInstallments, terms.minInstallmentCents).count;
  return count > 1 ? `até ${count}x no cartão` : null;
}
