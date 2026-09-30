import { ArrowSquareOut } from "@phosphor-icons/react/ssr";
import type { Metadata } from "next";
import Image from "next/image";
import { notFound } from "next/navigation";
import { z } from "zod";

import { OrderSummary } from "@/components/checkout/order-summary";
import { CardPayment } from "@/components/order/card-payment";
import { AutoRefresh, CancelOrder, CopyCode, RetryPayment } from "@/components/order/payment-tools";
import { ButtonLink, buttonClass } from "@/components/ui/button";
import { FormAlert } from "@/components/ui/field";
import { requireUser } from "@/lib/auth/session";
import { getDeliverySettings, getStoreSettings } from "@/lib/catalog/queries";
import { publicEnv } from "@/lib/env/public";
import { formatDateTime, formatDayMonth } from "@/lib/dates";
import { installmentPlan } from "@/lib/money";
import { isPayable, ORDER_STATUS_TONE, orderStatusLabel } from "@/lib/orders/status";
import { cardRejectionMessage, type PaymentDisplay } from "@/lib/payments/gateway";
import { paymentsEnabled, recheckPendingPayment } from "@/lib/payments/mercadopago";
import { SHIPPING_METHOD_LABEL, type ShippingMethod } from "@/lib/shipping/options";
import type { Enums } from "@/lib/supabase/database.types";
import { createClient } from "@/lib/supabase/server";
import { formatCep } from "@/lib/validation/br";

export const metadata: Metadata = { title: "Pedido" };

const STATUS_NOTE: Record<Enums<"order_status">, string> = {
  pending_payment: "O prazo de pagamento terminou. O pedido será cancelado automaticamente.",
  paid: "Pagamento confirmado. Já estamos separando seus produtos.",
  preparing: "Seu pedido está em separação.",
  shipped: "Seu pedido está a caminho.",
  delivered: "Pedido entregue. Agradecemos a compra!",
  canceled: "Pedido cancelado. Nenhum valor foi cobrado ou o estorno já foi solicitado.",
  refunded: "Pedido reembolsado. O valor volta pelo mesmo meio de pagamento.",
};

// Courier and pickup orders read differently from carrier shipments.
function statusNote(status: Enums<"order_status">, method: ShippingMethod): string {
  if (method === "pickup") {
    if (status === "paid" || status === "preparing") return "Pagamento confirmado. Avisamos quando estiver pronto para retirar.";
    if (status === "shipped") return "Seu pedido está pronto para retirada.";
    if (status === "delivered") return "Pedido retirado. Agradecemos a compra!";
  }
  if (method === "local" && status === "shipped") return "Seu pedido saiu para entrega com o motoboy.";
  return STATUS_NOTE[status];
}

const ORDER_FIELDS = `id, number, status, payment_method, subtotal_cents, discount_cents, payment_discount_cents,
  shipping_cents, total_cents, coupon_code, expires_at, created_at, shipping_address, shipping_method,
  shipping_tracking_code, customer_email, customer_document,
  items:order_items(product_name, variant_name, quantity, total_cents),
  payments(provider_payment_id, status, status_detail, raw, created_at, updated_at)`;

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

export default async function OrderPage({ params }: PageProps<"/pedido/[id]">) {
  const { id } = await params;
  if (!z.uuid().safeParse(id).success) notFound();
  await requireUser(`/pedido/${id}`);

  const supabase = await createClient();
  const load = () => supabase.from("orders").select(ORDER_FIELDS).eq("id", id).maybeSingle();
  const [{ data: found }, settings, delivery] = await Promise.all([load(), getStoreSettings(), getDeliverySettings()]);
  // RLS: another customer's order is indistinguishable from a missing one.
  if (!found) notFound();

  const latest = (payments: typeof found.payments) =>
    payments.toSorted((a, b) => b.created_at.localeCompare(a.created_at))[0];
  const rechecked = await recheckPendingPayment(latest(found.payments)).catch((err) => {
    console.error("payment recheck failed", err);
    return false;
  });
  const order = (rechecked && (await load()).data) || found;
  const payment = latest(order.payments);
  const display = payment?.status === "pending" ? (payment.raw as PaymentDisplay | null) : null;
  const open = isPayable(order);
  const deadline = new Date(display?.expiresAt ?? order.expires_at ?? order.created_at);
  const address = order.shipping_address as Address;

  let panel: React.ReactNode;
  if (!open) {
    panel = (
      <div className="space-y-4">
        <p className="text-ink">{statusNote(order.status, order.shipping_method)}</p>
        {order.shipping_tracking_code ? (
          <p className="text-sm text-ink-muted">
            Código de rastreio: <strong className="select-all text-ink">{order.shipping_tracking_code}</strong>
          </p>
        ) : null}
        {order.status === "pending_payment" || order.status === "canceled" ? (
          <ButtonLink href="/produtos">Fazer um novo pedido</ButtonLink>
        ) : null}
      </div>
    );
  } else if (!paymentsEnabled() || !publicEnv.NEXT_PUBLIC_MP_PUBLIC_KEY) {
    panel = <FormAlert>Os pagamentos estão sendo configurados. Tente novamente em alguns minutos.</FormAlert>;
  } else if (order.payment_method === "credit_card") {
    panel =
      payment?.status === "pending" ? (
        <div className="space-y-2">
          <h2 className="text-lg font-semibold text-ink">Pagamento em análise</h2>
          <p className="text-sm text-ink-muted">
            O Mercado Pago está analisando o pagamento. Esta página atualiza sozinha com a resposta.
          </p>
          <AutoRefresh seconds={15} />
        </div>
      ) : (
        <div className="space-y-4">
          <h2 className="text-lg font-semibold text-ink">Pague com cartão de crédito</h2>
          <CardPayment
            orderId={order.id}
            lastDecline={payment?.status === "rejected" ? cardRejectionMessage(payment.status_detail) : null}
            amountCents={order.total_cents}
            email={order.customer_email}
            document={order.customer_document ?? ""}
            maxInstallments={
              installmentPlan(order.total_cents, settings.maxInstallments, settings.minInstallmentCents).count
            }
            publicKey={publicEnv.NEXT_PUBLIC_MP_PUBLIC_KEY}
          />
        </div>
      );
  } else if (order.payment_method === "pix") {
    panel = display?.qrCode ? (
      <div className="space-y-5">
        <div>
          <h2 className="text-lg font-semibold text-ink">Pague com Pix</h2>
          <p className="mt-1 text-sm text-ink-muted">
            No app do seu banco, escolha Pix e leia o QR Code ou use o código copia e cola.
          </p>
        </div>
        {display.qrCodeBase64 ? (
          <Image
            src={`data:image/png;base64,${display.qrCodeBase64}`}
            alt="QR Code do Pix"
            width={224}
            height={224}
            unoptimized
            className="rounded-2xl border border-line bg-white p-3"
          />
        ) : null}
        <CopyCode code={display.qrCode} label="Copiar código Pix" />
        <p className="text-sm text-ink-muted">
          Válido até {formatDateTime(deadline)}. A confirmação aparece aqui sozinha.
        </p>
        <AutoRefresh seconds={5} />
      </div>
    ) : (
      <RetryPayment orderId={order.id} label="Gerar código Pix" />
    );
  } else {
    panel = display?.boletoUrl ? (
      <div className="space-y-5">
        <div>
          <h2 className="text-lg font-semibold text-ink">Pague o boleto até {formatDayMonth(deadline)}</h2>
          <p className="mt-1 text-sm text-ink-muted">A confirmação pode levar até 3 dias úteis após o pagamento.</p>
        </div>
        <a href={display.boletoUrl} target="_blank" rel="noopener noreferrer" className={buttonClass()}>
          Abrir boleto
          <ArrowSquareOut size={18} aria-hidden="true" />
        </a>
        {display.barcode ? <CopyCode code={display.barcode} label="Copiar linha digitável" /> : null}
      </div>
    ) : (
      <RetryPayment orderId={order.id} label="Gerar boleto" />
    );
  }

  return (
    <div className="container-page grid gap-10 py-10 lg:grid-cols-12 lg:py-14">
      <div className="space-y-8 lg:col-span-7">
        <header className="space-y-2">
          <p className="text-sm text-ink-muted">Feito em {formatDateTime(order.created_at)}</p>
          <h1 className="text-4xl font-semibold tracking-tight text-ink">Pedido #{order.number}</h1>
          <p className={`inline-block rounded-full px-3 py-1 text-xs font-semibold ${ORDER_STATUS_TONE[order.status]}`}>
            {orderStatusLabel(order.status, order.shipping_method)}
          </p>
        </header>
        <section aria-label="Pagamento" className="rounded-2xl border border-line p-6">
          {panel}
        </section>
        {open ? <CancelOrder orderId={order.id} /> : null}
      </div>

      <aside className="h-fit space-y-6 rounded-2xl bg-blush p-6 lg:col-span-5">
        <h2 className="text-lg font-semibold text-ink">Resumo</h2>
        <OrderSummary lines={order.items} totals={order} />
        <div className="space-y-1 text-sm">
          <h3 className="font-semibold text-ink">{SHIPPING_METHOD_LABEL[order.shipping_method]}</h3>
          {order.shipping_method === "pickup" ? (
            <p className="leading-relaxed text-ink-muted">
              {delivery.pickup ? delivery.pickup.address : "Combinamos a retirada pelo seu e-mail."}
              {delivery.pickup?.hours ? (
                <>
                  <br />
                  {delivery.pickup.hours}
                </>
              ) : null}
            </p>
          ) : (
            <p className="leading-relaxed text-ink-muted">
              {address.recipient_name}
              <br />
              {address.street}, {address.number}
              {address.complement ? `, ${address.complement}` : ""}
              <br />
              {address.district}, {address.city} - {address.state}, {formatCep(address.zip_code)}
            </p>
          )}
        </div>
      </aside>
    </div>
  );
}
