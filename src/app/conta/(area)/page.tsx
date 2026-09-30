import type { Metadata } from "next";
import Link from "next/link";

import { LogoSymbol } from "@/components/brand/logo";
import { ButtonLink } from "@/components/ui/button";
import { FormAlert } from "@/components/ui/field";
import { formatLongDate } from "@/lib/dates";
import { formatBRL } from "@/lib/money";
import { ORDER_STATUS_LABEL, ORDER_STATUS_TONE } from "@/lib/orders/status";
import { createClient } from "@/lib/supabase/server";

export const metadata: Metadata = { title: "Meus pedidos" };

export default async function OrdersPage({ searchParams }: PageProps<"/conta">) {
  const { senha } = await searchParams;
  const supabase = await createClient();
  const { data: orders } = await supabase
    .from("orders")
    .select("id, number, status, total_cents, created_at, items:order_items(product_name, quantity)")
    .order("created_at", { ascending: false })
    .limit(50);

  return (
    <div className="space-y-8">
      <h1 className="text-3xl font-semibold tracking-tight text-ink">Pedidos</h1>
      {senha === "alterada" ? <FormAlert tone="success">Sua senha foi alterada.</FormAlert> : null}

      {orders && orders.length > 0 ? (
        <ul className="grid gap-4">
          {orders.map((order) => {
            const count = order.items.reduce((sum, item) => sum + item.quantity, 0);
            return (
              <li key={order.id}>
                <Link
                  href={`/pedido/${order.id}`}
                  className="surface block p-5 transition hover:border-wine/40"
                >
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div>
                      <p className="font-semibold text-ink">Pedido #{order.number}</p>
                      <p className="text-sm text-ink-muted">
                        {formatLongDate(order.created_at)} · {count} {count === 1 ? "item" : "itens"}
                      </p>
                    </div>
                    <span className={`rounded-full px-3 py-1 text-xs font-semibold ${ORDER_STATUS_TONE[order.status]}`}>
                      {ORDER_STATUS_LABEL[order.status]}
                    </span>
                  </div>
                  <p className="mt-3 text-sm text-ink-muted">
                    {order.items.map((item) => item.product_name).join(", ")}
                  </p>
                  <p className="mt-3 flex items-baseline justify-between gap-3">
                    <span className="font-semibold text-ink tabular-nums">{formatBRL(order.total_cents)}</span>
                    {order.status === "pending_payment" ? (
                      <span className="text-sm font-semibold text-wine">Pagar agora</span>
                    ) : null}
                  </p>
                </Link>
              </li>
            );
          })}
        </ul>
      ) : (
        <div className="surface flex flex-col items-center gap-5 px-6 py-16 text-center">
          <LogoSymbol className="h-14 w-auto text-wine/20" />
          <div className="space-y-1.5">
            <p className="text-lg font-semibold text-ink">Você ainda não fez pedidos</p>
            <p className="text-sm text-ink-muted">Quando comprar, o acompanhamento aparece aqui.</p>
          </div>
          <ButtonLink href="/produtos">Ver produtos</ButtonLink>
        </div>
      )}
      <p className="text-sm text-ink-muted">
        Precisa trocar a senha?{" "}
        <Link href="/recuperar-senha" className="font-semibold text-wine hover:underline">
          Enviar link de nova senha
        </Link>
      </p>
    </div>
  );
}
