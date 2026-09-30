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

/**
 * Parses a price typed in the admin ("49,90", "1.289,90", "R$ 49,90", "49.9") into cents.
 * Null when it is not a positive amount with at most two decimals.
 */
export function parseBRL(input: string): number | null {
  let value = input.replace(/R\$|\s/g, "");
  // A comma is the decimal separator; without one, a dot followed by 1–2 digits is too.
  if (value.includes(",")) value = value.replace(/\./g, "").replace(",", ".");
  else if (!/^\d+\.\d{1,2}$/.test(value)) value = value.replace(/\.(?=\d{3}(\D|$))/g, "");
  const match = /^(\d{1,7})(?:\.(\d{1,2}))?$/.exec(value);
  if (!match) return null;
  const cents = Number(match[1]) * 100 + Number((match[2] ?? "0").padEnd(2, "0"));
  return cents > 0 ? cents : null;
}

/** Cents as a form value: 4990 → "49,90". */
export function centsToField(cents: number): string {
  return (cents / 100).toFixed(2).replace(".", ",");
}
