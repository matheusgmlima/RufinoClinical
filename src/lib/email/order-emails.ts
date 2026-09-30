import { formatDateTime } from "@/lib/dates";
import { formatBRL } from "@/lib/money";

import { button, callout, escapeHtml, layout, paragraph, rows, strong } from "./layout";

// Transactional e-mails of an order, in the store's voice. Pure: the data comes in, subject, HTML
// and plain text come out (the text version helps deliverability and old clients).

export type OrderEmailKind = "received" | "paid" | "shipped" | "refunded";

export type EmailOrder = {
  id: string;
  number: number;
  customer_name: string;
  payment_method: "pix" | "boleto" | "credit_card" | null;
  subtotal_cents: number;
  discount_cents: number;
  payment_discount_cents: number;
  shipping_cents: number;
  total_cents: number;
  coupon_code: string | null;
  shipping_method: "standard" | "local" | "pickup";
  shipping_tracking_code: string | null;
  expires_at: string | null;
  /** Where and when to pick up (pickup orders), from the store settings. */
  pickup?: { address: string; hours: string | null } | null;
  items: { product_name: string; variant_name: string; quantity: number; total_cents: number }[];
};

export type RenderedEmail = { subject: string; html: string; text: string };

const greeting = (name: string) => {
  const first = name.trim().split(/\s+/)[0];
  return first ? `Olá, ${first}!` : "Olá!";
};
const CORREIOS = "https://rastreamento.correios.com.br/app/index.php";

function summary(order: EmailOrder) {
  const lines = order.items.map((item) => ({
    label: item.product_name,
    detail: `${item.variant_name} · ${item.quantity} ${item.quantity === 1 ? "unidade" : "unidades"}`,
    value: formatBRL(item.total_cents),
  }));
  const totals = [
    { label: "Subtotal", value: formatBRL(order.subtotal_cents) },
    ...(order.discount_cents ? [{ label: `Cupom ${order.coupon_code ?? ""}`.trim(), value: `− ${formatBRL(order.discount_cents)}` }] : []),
    ...(order.payment_discount_cents ? [{ label: "Desconto no Pix", value: `− ${formatBRL(order.payment_discount_cents)}` }] : []),
    { label: "Frete", value: order.shipping_cents ? formatBRL(order.shipping_cents) : "Grátis" },
    { label: "Total", value: formatBRL(order.total_cents) },
  ];
  return {
    html: rows(lines) + rows(totals, { emphasizeLast: true }),
    text: [
      ...lines.map((line) => `- ${line.label} (${line.detail}): ${line.value}`),
      ...totals.map((total) => `${total.label}: ${total.value}`),
    ].join("\n"),
  };
}

/** Subject, HTML and text of one order e-mail. `siteUrl` builds the links (no trailing slash). */
export function orderEmail(kind: OrderEmailKind, order: EmailOrder, siteUrl: string): RenderedEmail {
  const orderUrl = `${siteUrl}/pedido/${order.id}`;
  const hello = greeting(order.customer_name);
  const n = `#${order.number}`;
  const items = summary(order);
  let subject: string, title: string, preheader: string, html: string, text: string[];

  switch (kind) {
    case "received": {
      const how = order.payment_method === "boleto" ? "o boleto" : "o Pix";
      const until = order.expires_at ? formatDateTime(order.expires_at) : null;
      subject = `Pedido ${n} recebido: falta o pagamento`;
      title = "Recebemos seu pedido";
      preheader = `Pague ${how} para garantir os produtos do pedido ${n}.`;
      html =
        paragraph(`${escapeHtml(hello)} Seu pedido ${strong(n)} está reservado. Pague ${how} para garantir os produtos.`) +
        (until ? callout(`Pague até ${strong(until)}. Depois disso a reserva é liberada.`) : "") +
        items.html +
        button(order.payment_method === "boleto" ? "Ver o boleto" : "Ver o código Pix", orderUrl);
      text = [hello, `Seu pedido ${n} está reservado. Pague ${how} para garantir os produtos.`, until ? `Pague até ${until}.` : "", items.text, `Pagar: ${orderUrl}`];
      break;
    }
    case "paid": {
      const next =
        order.shipping_method === "pickup"
          ? "Avisamos quando estiver pronto para retirar."
          : order.shipping_method === "local"
            ? "Avisamos quando sair com o motoboy."
            : "Avisamos quando saírem para entrega.";
      subject = `Pagamento aprovado: pedido ${n}`;
      title = "Pagamento aprovado";
      preheader = `Já estamos separando o pedido ${n}.`;
      html =
        paragraph(`${escapeHtml(hello)} O pagamento do pedido ${strong(n)} foi aprovado. Já estamos separando seus produtos. ${next}`) +
        items.html +
        button("Acompanhar pedido", orderUrl);
      text = [hello, `O pagamento do pedido ${n} foi aprovado. Já estamos separando seus produtos. ${next}`, items.text, `Acompanhar: ${orderUrl}`];
      break;
    }
    case "shipped": {
      if (order.shipping_method === "local") {
        subject = `Pedido ${n} saiu para entrega`;
        title = "Seu pedido saiu para entrega";
        preheader = `O pedido ${n} está com o motoboy.`;
        html =
          paragraph(`${escapeHtml(hello)} O pedido ${strong(n)} saiu com o motoboy e chega ainda hoje no endereço de entrega.`) +
          button("Ver pedido", orderUrl);
        text = [hello, `O pedido ${n} saiu com o motoboy e chega ainda hoje no endereço de entrega.`, `Pedido: ${orderUrl}`];
        break;
      }
      if (order.shipping_method === "pickup") {
        const where = order.pickup ? [order.pickup.address, order.pickup.hours].filter(Boolean).join(" · ") : null;
        subject = `Pedido ${n} pronto para retirada`;
        title = "Pronto para retirar";
        preheader = `O pedido ${n} já pode ser retirado.`;
        html =
          paragraph(`${escapeHtml(hello)} O pedido ${strong(n)} está pronto para retirada. Leve um documento com foto.`) +
          (where ? callout(escapeHtml(where)) : "") +
          button("Ver pedido", orderUrl);
        text = [hello, `O pedido ${n} está pronto para retirada. Leve um documento com foto.`, where ?? "", `Pedido: ${orderUrl}`];
        break;
      }
      const code = order.shipping_tracking_code ?? "";
      subject = `Pedido ${n} enviado`;
      title = "Seu pedido está a caminho";
      preheader = code ? `Código de rastreio: ${code}` : `O pedido ${n} saiu para entrega.`;
      html =
        paragraph(`${escapeHtml(hello)} O pedido ${strong(n)} foi enviado.`) +
        (code ? callout(`Código de rastreio: ${strong(code)}`) : "") +
        paragraph("O rastreio pode levar até um dia útil para aparecer no site dos Correios.") +
        button("Rastrear nos Correios", CORREIOS);
      text = [hello, `O pedido ${n} foi enviado.`, code ? `Código de rastreio: ${code}` : "", `Rastrear: ${CORREIOS}`, `Pedido: ${orderUrl}`];
      break;
    }
    case "refunded": {
      const when =
        order.payment_method === "credit_card"
          ? "No cartão, o estorno aparece em até duas faturas, conforme o banco."
          : order.payment_method === "boleto"
            ? "No boleto, o Mercado Pago faz a devolução e pode pedir seus dados bancários para isso."
            : "O valor volta para a conta de origem em até dois dias úteis.";
      subject = `Reembolso do pedido ${n}`;
      title = "Reembolso feito";
      preheader = `Devolvemos ${formatBRL(order.total_cents)} do pedido ${n}.`;
      html =
        paragraph(`${escapeHtml(hello)} Devolvemos ${strong(formatBRL(order.total_cents))} do pedido ${strong(n)} pelo mesmo meio de pagamento.`) +
        paragraph(escapeHtml(when)) +
        button("Ver pedido", orderUrl);
      text = [hello, `Devolvemos ${formatBRL(order.total_cents)} do pedido ${n} pelo mesmo meio de pagamento.`, when, `Pedido: ${orderUrl}`];
      break;
    }
  }

  return {
    subject,
    html: layout({ title, preheader, content: html, siteUrl }),
    text: [...text.filter(Boolean), "", "Rufino Clinical"].join("\n\n"),
  };
}
