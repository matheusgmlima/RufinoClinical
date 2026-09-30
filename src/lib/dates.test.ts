import { describe, expect, it } from "vitest";

import { formatDateTime, saoPauloDay, startOfMonthInSaoPaulo, toDateField } from "./dates";

describe("dates", () => {
  it("formats in São Paulo time, not in the server's UTC", () => {
    expect(formatDateTime("2026-10-01T02:30:00Z")).toBe("30/09, 23:30");
  });

  it("starts the month at midnight in São Paulo", () => {
    expect(startOfMonthInSaoPaulo(new Date("2026-10-01T02:30:00Z"))).toBe("2026-09-01T03:00:00.000Z");
    expect(startOfMonthInSaoPaulo(new Date("2026-10-01T03:00:00Z"))).toBe("2026-10-01T03:00:00.000Z");
  });
});

describe("saoPauloDay", () => {
  it("starts the day at midnight in São Paulo", () => {
    expect(saoPauloDay("2026-10-01")).toBe("2026-10-01T03:00:00.000Z");
  });

  it("ends a period at the start of the next day, across months and years", () => {
    expect(saoPauloDay("2026-10-31", { dayAfter: true })).toBe("2026-11-01T03:00:00.000Z");
    expect(saoPauloDay("2026-12-31", { dayAfter: true })).toBe("2027-01-01T03:00:00.000Z");
  });

  it("rejects malformed and impossible dates", () => {
    for (const bad of ["", "2026-13-01", "2026-02-30", "01/10/2026", "2026-10-1"]) expect(saoPauloDay(bad)).toBeNull();
  });

  it("round-trips with toDateField", () => {
    expect(toDateField(saoPauloDay("2026-10-01")!)).toBe("2026-10-01");
    // The last instant of a period still falls on its last day.
    expect(toDateField(new Date(Date.parse(saoPauloDay("2026-10-31", { dayAfter: true })!) - 1))).toBe("2026-10-31");
  });
});
