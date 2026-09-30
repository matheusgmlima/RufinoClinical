/** Shipping regions with a flat rate (shipping_rates.region), in the order the admin sees them. */
export const REGIONS = ["SE", "S", "CO", "NE", "N"] as const;
export type Region = (typeof REGIONS)[number];

export const REGION_LABEL: Record<Region, string> = {
  SE: "Sudeste",
  S: "Sul",
  CO: "Centro-Oeste",
  NE: "Nordeste",
  N: "Norte",
};
