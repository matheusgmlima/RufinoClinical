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
 * Interest-free installments: as many as allowed while each one stays at or above the minimum.
 * The gateway computes the exact split at checkout; this is the display value.
 */
export function installmentPlan(cents: number, maxInstallments: number, minInstallmentCents: number): InstallmentPlan {
  const count = Math.max(1, Math.min(maxInstallments, Math.floor(cents / minInstallmentCents)));
  return { count, amountCents: Math.round(cents / count) };
}
