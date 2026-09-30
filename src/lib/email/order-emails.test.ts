import { describe, expect, it } from "vitest";

import { escapeHtml } from "./layout";
import { orderEmail, type EmailOrder } from "./order-emails";

const order: EmailOrder = {
  id: "0b6f0c1e-0000-4000-8000-000000000001",
  number: 1042,
  customer_name: "Ana <script>alert(1)</script> Souza",
  payment_method: "pix",
  subtotal_cents: 9980,
  discount_cents: 998,
  payment_discount_cents: 449,
  shipping_cents: 1990,
  total_cents: 10523,
  coupon_code: "BEMVINDA10",
  shipping_tracking_code: "BR123456789BR",
  expires_at: "2026-10-01T02:30:00Z",
  items: [{ product_name: "Kinesio Tape <b>5 cm</b>", variant_name: "Bege", quantity: 2, total_cents: 9980 }],
};
const SITE = "https://loja.example";

describe("orderEmail", () => {
  it("escapes everything that came from the database", () => {
    const { html } = orderEmail("paid", order, SITE);
    expect(html).not.toContain("<script>");
    expect(html).not.toContain("<b>5 cm</b>");
    expect(html).toContain("Kinesio Tape &lt;b&gt;5 cm&lt;/b&gt;");
    expect(html).toContain("Olá, Ana!");
  });

  it("asks for the payment with the deadline in São Paulo time", () => {
    const email = orderEmail("received", order, SITE);
    expect(email.subject).toBe("Pedido #1042 recebido: falta o pagamento");
    expect(email.html).toContain("30/09, 23:30");
    expect(email.html).toContain(`${SITE}/pedido/${order.id}`);
    expect(email.html).toContain("Ver o código Pix");
    expect(orderEmail("received", { ...order, payment_method: "boleto" }, SITE).html).toContain("Ver o boleto");
  });

  it("lists items and totals when the payment is approved", () => {
    const { subject, text } = orderEmail("paid", order, SITE);
    expect(subject).toBe("Pagamento aprovado: pedido #1042");
    expect(text.replace(/\s/g, " ")).toContain("Cupom BEMVINDA10: − R$ 9,98");
    expect(text.replace(/\s/g, " ")).toContain("Total: R$ 105,23");
  });

  it("carries the tracking code when shipped", () => {
    const { subject, html, text } = orderEmail("shipped", order, SITE);
    expect(subject).toBe("Pedido #1042 enviado");
    expect(html).toContain("BR123456789BR");
    expect(text).toContain("Código de rastreio: BR123456789BR");
  });

  it("explains how the refund arrives for each payment method", () => {
    expect(orderEmail("refunded", { ...order, payment_method: "credit_card" }, SITE).text).toContain("fatura");
    expect(orderEmail("refunded", order, SITE).text).toContain("conta de origem");
  });

  it("greets without a name when there is none", () => {
    expect(orderEmail("paid", { ...order, customer_name: "  " }, SITE).text.startsWith("Olá!")).toBe(true);
  });
});

describe("escapeHtml", () => {
  it("escapes the five HTML special characters", () => {
    expect(escapeHtml(`<a href="x">'&'</a>`)).toBe("&lt;a href=&quot;x&quot;&gt;&#39;&amp;&#39;&lt;/a&gt;");
  });
});
