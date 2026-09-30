import { describe, expect, it } from "vitest";

import { formatDateTime, startOfMonthInSaoPaulo } from "./dates";

describe("dates", () => {
  it("formats in São Paulo time, not in the server's UTC", () => {
    expect(formatDateTime("2026-10-01T02:30:00Z")).toBe("30/09, 23:30");
  });

  it("starts the month at midnight in São Paulo", () => {
    expect(startOfMonthInSaoPaulo(new Date("2026-10-01T02:30:00Z"))).toBe("2026-09-01T03:00:00.000Z");
    expect(startOfMonthInSaoPaulo(new Date("2026-10-01T03:00:00Z"))).toBe("2026-10-01T03:00:00.000Z");
  });
});
