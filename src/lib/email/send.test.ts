import { afterEach, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));
vi.stubEnv("NEXT_PUBLIC_SITE_URL", "http://localhost:3000");
vi.stubEnv("NEXT_PUBLIC_SUPABASE_URL", "https://proj.supabase.co");
vi.stubEnv("NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY", "sb_publishable_test");
vi.stubEnv("RESEND_API_KEY", "re_test_123");
vi.stubEnv("EMAIL_FROM", "Rufino Clinical <pedidos@loja.example>");
vi.stubEnv("EMAIL_REPLY_TO", "contato@loja.example");
const { emailEnabled, sendEmail } = await import("./send");

const email = { subject: "Pedido #1 enviado", html: "<p>oi</p>", text: "oi" };

afterEach(() => vi.unstubAllGlobals());

describe("sendEmail", () => {
  it("posts to Resend with the sender, reply-to and idempotency key", async () => {
    const fetch = vi.fn(async () => new Response("{}", { status: 200 }));
    vi.stubGlobal("fetch", fetch);
    expect(emailEnabled()).toBe(true);
    await sendEmail("ana@cliente.example", email, "order-shipped/abc");

    const [url, init] = fetch.mock.calls[0] as unknown as [string, RequestInit];
    expect(url).toBe("https://api.resend.com/emails");
    const headers = init.headers as Record<string, string>;
    expect(headers.Authorization).toBe("Bearer re_test_123");
    expect(headers["Idempotency-Key"]).toBe("order-shipped/abc");
    expect(JSON.parse(String(init.body))).toEqual({
      from: "Rufino Clinical <pedidos@loja.example>",
      to: ["ana@cliente.example"],
      subject: "Pedido #1 enviado",
      html: "<p>oi</p>",
      text: "oi",
      reply_to: "contato@loja.example",
    });
  });

  it("throws on a rejected send so the caller can log it", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => new Response('{"message":"domain not verified"}', { status: 403 })));
    await expect(sendEmail("ana@cliente.example", email, "k")).rejects.toThrow("Resend 403");
  });
});
