import { describe, expect, it } from "vitest";

import { cartKey, MAX_CARRIER_SERVICES, parseCarrierQuote } from "./carrier";

const correios = { id: 2, name: "Correios" };

describe("parseCarrierQuote", () => {
  it("keeps available services, cheapest first, with the account's custom price and range", () => {
    const services = parseCarrierQuote([
      { id: 2, name: "SEDEX", price: "40.10", custom_price: "42.30", delivery_range: { min: 1, max: 2 }, custom_delivery_range: { min: 2, max: 3 }, company: correios },
      { id: 1, name: "PAC", price: "24.90", custom_price: "24.90", delivery_range: { min: 5, max: 7 }, company: correios },
      { id: 3, name: ".Package", error: "Transportadora não atende este trecho.", company: { id: 2, name: "Jadlog" } },
      { id: 4, name: "Broken", price: "abc", delivery_range: { min: 1, max: 2 }, company: correios },
    ]);
    expect(services).toEqual([
      { id: 1, service: "Correios PAC", price_cents: 2490, min_days: 5, max_days: 7 },
      { id: 2, service: "Correios SEDEX", price_cents: 4230, min_days: 2, max_days: 3 },
    ]);
  });

  it("caps the list and survives unexpected bodies", () => {
    const many = Array.from({ length: 9 }, (_, i) => ({
      id: i + 1,
      name: `S${i}`,
      price: String(10 + i),
      delivery_range: { min: 1, max: 3 },
      company: correios,
    }));
    expect(parseCarrierQuote(many)).toHaveLength(MAX_CARRIER_SERVICES);
    expect(parseCarrierQuote({ message: "Unauthenticated." })).toEqual([]);
    expect(parseCarrierQuote(null)).toEqual([]);
  });
});

describe("cartKey", () => {
  it("matches private.cart_key: lower-case ids in byte order", () => {
    expect(
      cartKey([
        { variantId: "B0000000-0000-4000-8000-000000000002", quantity: 2 },
        { variantId: "a0000000-0000-4000-8000-000000000001", quantity: 1 },
      ]),
    ).toEqual([
      { variant_id: "a0000000-0000-4000-8000-000000000001", quantity: 1 },
      { variant_id: "b0000000-0000-4000-8000-000000000002", quantity: 2 },
    ]);
  });
});
