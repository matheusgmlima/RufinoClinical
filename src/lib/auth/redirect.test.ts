import { describe, expect, it } from "vitest";

import { safeNext } from "./redirect";

describe("safeNext", () => {
  it("keeps same-site paths", () => {
    expect(safeNext("/checkout")).toBe("/checkout");
    expect(safeNext("/produtos?categoria=compressao")).toBe("/produtos?categoria=compressao");
  });

  it("blocks off-site and malformed destinations", () => {
    for (const bad of [
      "https://evil.example",
      "//evil.example",
      "/\\evil.example",
      "\\\\evil.example",
      "javascript:alert(1)",
      "/%0d%0aSet-Cookie:x",
      "/\u0000",
      "",
      null,
      undefined,
    ]) {
      const result = safeNext(bad as string);
      expect(result.startsWith("/")).toBe(true);
      expect(result.startsWith("//")).toBe(false);
      expect(result).not.toContain("evil");
    }
  });

  it("uses the fallback for rejected values", () => {
    expect(safeNext("https://evil.example", "/")).toBe("/");
  });
});
