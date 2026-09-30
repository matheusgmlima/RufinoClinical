import { describe, expect, it } from "vitest";

import { formatBRL } from "@/lib/money";
import { orderStatusLabel } from "@/lib/orders/status";

import { formatCutoff, shippingDetail, shippingOptionSchema, shippingPrice, sortShippingOptions } from "./options";

describe("shipping options", () => {
  it("reads the options priced by the database", () => {
    const parsed = shippingOptionSchema.array().parse([
      { method: "standard", price_cents: 1990, min_days: 3, max_days: 7 },
      { method: "local", price_cents: 1500, distance_km: 4.2, cutoff: "16:00" },
      { method: "pickup", price_cents: 0 },
    ]);
    expect(parsed.map(shippingPrice)).toEqual([formatBRL(1990), formatBRL(1500), "Grátis"]);
    expect(shippingDetail(parsed[0])).toBe("3 a 7 dias úteis após a postagem.");
    expect(shippingDetail(parsed[1])).toContain("Chega hoje com pagamento confirmado até 16h em dia útil.");
    expect(sortShippingOptions(parsed).map((option) => option.method)).toEqual(["local", "pickup", "standard"]);
    expect(() => shippingOptionSchema.parse({ method: "drone", price_cents: 0 })).toThrow();
  });

  it("formats the cutoff hour", () => {
    expect(formatCutoff("16:00")).toBe("16h");
    expect(formatCutoff("09:30")).toBe("9h30");
  });

  it("names the steps of courier and pickup orders", () => {
    expect(orderStatusLabel("shipped")).toBe("Enviado");
    expect(orderStatusLabel("shipped", "local")).toBe("Saiu para entrega");
    expect(orderStatusLabel("shipped", "pickup")).toBe("Pronto para retirada");
    expect(orderStatusLabel("delivered", "pickup")).toBe("Retirado");
    expect(orderStatusLabel("paid", "pickup")).toBe("Pago");
  });
});
