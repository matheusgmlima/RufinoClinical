import { describe, expect, it } from "vitest";

import { auditChanges, auditHref, auditSubject, formatValue } from "./audit";

describe("auditChanges", () => {
  it("lists only the fields that changed, formatted", () => {
    const before = { id: "1", name: "Gel", price_cents: 4990, is_active: false, updated_at: "2026-09-30T10:00:00Z" };
    const after = { id: "1", name: "Gel", price_cents: 4490, is_active: true, updated_at: "2026-09-30T11:00:00Z" };
    const changes = auditChanges(before, after).map((c) => ({ ...c, before: c.before.replace(/\s/g, " "), after: c.after.replace(/\s/g, " ") }));
    expect(changes).toEqual([
      { field: "price_cents", before: "R$ 49,90", after: "R$ 44,90" },
      { field: "is_active", before: "Não", after: "Sim" },
    ]);
  });

  it("returns nothing for inserts and deletes", () => {
    expect(auditChanges(null, { name: "x" })).toEqual([]);
    expect(auditChanges({ name: "x" }, null)).toEqual([]);
  });
});

describe("formatValue", () => {
  it("shows dates in São Paulo time and truncates long text", () => {
    expect(formatValue("paid_at", "2026-10-01T02:30:00Z")).toBe("30/09, 23:30");
    expect(formatValue("description", "a".repeat(200))).toHaveLength(120);
    expect(formatValue("notes", null)).toBe("—");
    expect(formatValue("status", "refunded")).toBe("Reembolsado");
  });
});

describe("auditSubject and auditHref", () => {
  it("names and links the row", () => {
    expect(auditSubject("orders", null, { number: 1034 })).toBe("#1034");
    expect(auditSubject("coupons", { code: "BEMVINDA10" }, null)).toBe("BEMVINDA10");
    expect(auditSubject("shipping_rates", null, { region: "NE" })).toBe("Nordeste");
    expect(auditHref("product_variants", "v1", null, { product_id: "p1" })).toBe("/admin/produtos/p1");
    expect(auditHref("products", "p1", { name: "x" }, null)).toBeNull();
  });
});
