import { describe, expect, it } from "vitest";

import { buildCsp, createNonce } from "./csp";

const base = { nonce: "abc123", supabaseUrl: "https://proj.supabase.co" };

function directive(csp: string, name: string) {
  return csp.split("; ").find((d) => d.startsWith(`${name} `));
}

describe("buildCsp", () => {
  it("only lets scripts run with the request nonce", () => {
    const csp = buildCsp({ ...base, isDev: false });
    expect(directive(csp, "script-src")).toBe("script-src 'self' 'nonce-abc123' 'strict-dynamic'");
    expect(csp).not.toContain("unsafe-eval");
  });

  it("allows eval only in development", () => {
    expect(directive(buildCsp({ ...base, isDev: true }), "script-src")).toContain("'unsafe-eval'");
  });

  it("blocks framing, plugins and foreign form targets", () => {
    const csp = buildCsp({ ...base, isDev: false });
    expect(directive(csp, "frame-ancestors")).toBe("frame-ancestors 'none'");
    expect(directive(csp, "object-src")).toBe("object-src 'none'");
    expect(directive(csp, "form-action")).toBe("form-action 'self'");
    expect(directive(csp, "base-uri")).toBe("base-uri 'self'");
  });

  it("allows only the project's Supabase origin and the payment gateway for data and images", () => {
    const csp = buildCsp({ ...base, isDev: false });
    expect(directive(csp, "connect-src")).toMatch(
      /^connect-src 'self' https:\/\/proj\.supabase\.co wss:\/\/proj\.supabase\.co https:\/\/api\.mercadopago\.com /,
    );
    expect(directive(csp, "connect-src")).not.toMatch(/\*|https: |http:/);
    expect(directive(csp, "img-src")).toContain("https://proj.supabase.co");
  });

  it("lets the Mercado Pago card form frame and call the gateway, but never adds script hosts", () => {
    const csp = buildCsp({ ...base, isDev: false });
    expect(directive(csp, "frame-src")).toBe(
      "frame-src 'self' https://secure-fields.mercadopago.com https://api-static.mercadopago.com",
    );
    expect(directive(csp, "connect-src")).toContain("https://api.mercadopago.com");
    expect(directive(csp, "connect-src")).toContain("https://www.mercadolivre.com"); // anti-fraud device id
    expect(directive(csp, "script-src")).not.toContain("https:");
  });

  it("upgrades insecure requests in production only", () => {
    expect(buildCsp({ ...base, isDev: false })).toContain("upgrade-insecure-requests");
    expect(buildCsp({ ...base, isDev: true })).not.toContain("upgrade-insecure-requests");
  });
});

describe("createNonce", () => {
  it("returns a fresh base64 value of 128 bits each call", () => {
    const a = createNonce();
    const b = createNonce();
    expect(a).not.toBe(b);
    expect(atob(a)).toHaveLength(16);
  });
});
