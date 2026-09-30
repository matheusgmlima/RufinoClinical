import { describe, expect, it } from "vitest";

import { SLUG_PATTERN, slugify } from "./slug";

describe("slugify", () => {
  it("drops accents, symbols and repeated separators", () => {
    expect(slugify("Kinesio Tape 5 cm (Bege)")).toBe("kinesio-tape-5-cm-bege");
    expect(slugify("  Óleo de Massagem — Relaxante  ")).toBe("oleo-de-massagem-relaxante");
    expect(slugify("Gel Condutor 1kg!!")).toBe("gel-condutor-1kg");
  });

  it("respects the length limit without a trailing dash", () => {
    const slug = slugify("a ".repeat(100), 9);
    expect(slug).toBe("a-a-a-a-a");
    expect(SLUG_PATTERN.test(slug)).toBe(true);
  });

  it("returns an empty string when nothing is left", () => {
    expect(slugify("!!!")).toBe("");
  });
});
