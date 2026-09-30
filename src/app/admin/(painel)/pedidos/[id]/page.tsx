import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { z } from "zod";

import { OrderActions } from "@/components/admin/order-actions";
import { AdminHeader, Panel, StatusBadge } from "@/components/admin/ui";
import { OrderSummary } from "@/components/checkout/order-summary";
import { requireAdmin } from "@/lib/auth/admin";
import { formatDateTime } from "@/lib/dates";
import { formatBRL } from "@/lib/money";
import { orderStatusLabel, PAYMENT_METHOD_LABEL, PAYMENT_STATUS_LABEL } from "@/lib/orders/status";
import { SHIPPING_METHOD_LABEL } from "@/lib/shipping/options";
import { formatCep, formatDocument, formatPhone } from "@/lib/validation/br";

export const metadata: Metadata = { title: "Pedido" };

const ORDER_FIELDS = `id, number, status, customer_name, customer_email, customer_phone, customer_document,
  shipping_address, shipping_method, shipping_tracking_code, subtotal_cents, discount_cents, payment_discount_cents, shipping_cents,
  total_cents, payment_method, installments, coupon_code, gateway_payment_id, created_at, paid_at, shipped_at,
  delivered_at, canceled_at,
  items:order_items(product_name, variant_name, sku, quantity, unit_price_cents, total_cents),
  payments(id, provider_payment_id, status, status_detail, method, installments, amount_cents, created_at),
  note:order_notes(notes)`;

type Address = {
  recipient_name: string;
  street: string;
  number: string;
  complement: string | null;
  district: string;
  city: string;
  state: string;
  zip_code: string;
};

function Detail({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <dt className="text-xs text-ink-muted">{label}</dt>
      <dd className="mt-0.5 break-words text-ink">{children}</dd>
    </div>
  );
}

export default async function AdminOrderPage({ params }: PageProps<"/admin/pedidos/[id]">) {
  const { id } = await params;
  if (!z.uuid().safeParse(id).success) notFound();
  const { supabase } = await requireAdmin();
  const { data: order } = await supabase.from("orders").select(ORDER_FIELDS).eq("id", id).maybeSingle();
  if (!order) notFound();

  const address = order.shipping_address as Address;
  const refundable = !!order.gateway_payment_id && ["paid", "preparing", "shipped", "delivered"].includes(order.status);
  const timeline = [
    ["Pedido feito", order.created_at],
    ["Pagamento aprovado", order.paid_at],
    [orderStatusLabel("shipped", order.shipping_method), order.shipped_at],
    [orderStatusLabel("delivered", order.shipping_method), order.delivered_at],
    ["Cancelado", order.canceled_at],
  ].filter((entry): entry is [string, string] => !!entry[1]);

  return (
    <>
      <Link href="/admin/pedidos" className="text-sm font-semibold text-wine hover:underline">
        ← Pedidos
      </Link>
      <AdminHeader
        title={`Pedido #${order.number}`}
        lead={`${formatDateTime(order.created_at)}${order.payment_method ? ` · ${PAYMENT_METHOD_LABEL[order.payment_method]}` : ""}${order.installments && order.installments > 1 ? ` em ${order.installments}x` : ""}`}
        action={<StatusBadge status={order.status} method={order.shipping_method} />}
      />

      <div className="grid grid-cols-1 gap-6 xl:grid-cols-3">
        <div className="grid content-start gap-6 xl:col-span-2">
          <Panel title="Itens">
            <OrderSummary lines={order.items} totals={order} />
            <p className="mt-3 text-xs text-ink-muted">SKUs: {order.items.map((item) => item.sku).join(", ")}</p>
          </Panel>

          <Panel title="Pagamentos">
            {order.payments.length ? (
              <ul className="divide-y divide-line text-sm">
                {order.payments.map((payment) => (
                  <li key={payment.id} className="flex flex-wrap items-center justify-between gap-2 py-3">
                    <span className="min-w-0">
                      <span className="font-medium">
                        {PAYMENT_STATUS_LABEL[payment.status] ?? payment.status}
                        {payment.status_detail ? ` · ${payment.status_detail}` : ""}
                      </span>
                      <span className="block text-xs text-ink-muted">
                        {formatDateTime(payment.created_at)}
                        {payment.method ? ` · ${PAYMENT_METHOD_LABEL[payment.method]}` : ""} · Mercado Pago{" "}
                        <span className="select-all">{payment.provider_payment_id}</span>
                      </span>
                    </span>
                    <span className="tabular-nums">{formatBRL(payment.amount_cents)}</span>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="text-sm text-ink-muted">Nenhuma cobrança gerada.</p>
            )}
          </Panel>

          <Panel title="Histórico">
            <ol className="grid gap-2 text-sm">
              {timeline.map(([label, date]) => (
                <li key={label} className="flex justify-between gap-4">
                  <span>{label}</span>
                  <span className="text-ink-muted tabular-nums">{formatDateTime(date)}</span>
                </li>
              ))}
            </ol>
          </Panel>
        </div>

        <div className="grid content-start gap-6">
          <Panel title="Ações">
            <OrderActions
              orderId={order.id}
              status={order.status}
              shippingMethod={order.shipping_method}
              notes={order.note?.notes ?? null}
              refundable={refundable}
              total={formatBRL(order.total_cents)}
            />
          </Panel>

          <Panel title="Cliente">
            <dl className="grid gap-3 text-sm">
              <Detail label="Nome">{order.customer_name}</Detail>
              <Detail label="E-mail">
                <a href={`mailto:${order.customer_email}`} className="text-wine hover:underline">
                  {order.customer_email}
                </a>
              </Detail>
              {order.customer_phone ? <Detail label="Telefone">{formatPhone(order.customer_phone)}</Detail> : null}
              {order.customer_document ? (
                <Detail label={order.customer_document.length === 14 ? "CNPJ" : "CPF"}>
                  {formatDocument(order.customer_document)}
                </Detail>
              ) : null}
            </dl>
          </Panel>

          <Panel title="Entrega">
            <dl className="grid gap-3 text-sm">
              <Detail label="Forma">
                <span className={order.shipping_method === "standard" ? "" : "font-semibold text-wine"}>
                  {SHIPPING_METHOD_LABEL[order.shipping_method]}
                </span>
              </Detail>
              <Detail label="Destinatário">{address.recipient_name}</Detail>
              <Detail label={order.shipping_method === "pickup" ? "Endereço do cliente" : "Endereço"}>
                {address.street}, {address.number}
                {address.complement ? `, ${address.complement}` : ""}
                <br />
                {address.district}, {address.city} - {address.state}, {formatCep(address.zip_code)}
              </Detail>
              {order.shipping_tracking_code ? (
                <Detail label="Rastreio">
                  <span className="select-all font-semibold">{order.shipping_tracking_code}</span>
                </Detail>
              ) : null}
            </dl>
          </Panel>
        </div>
      </div>
    </>
  );
}
