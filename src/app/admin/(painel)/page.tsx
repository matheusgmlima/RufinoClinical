import type { Icon } from "@phosphor-icons/react";
import { ChartLineUp, Clock, Package, Tray } from "@phosphor-icons/react/ssr";
import type { Metadata } from "next";
import Link from "next/link";

import { AdminHeader, Panel, StatusBadge } from "@/components/admin/ui";
import { requireAdmin } from "@/lib/auth/admin";
import { formatDateTime, startOfMonthInSaoPaulo } from "@/lib/dates";
import { formatBRL } from "@/lib/money";
import type { Enums } from "@/lib/supabase/database.types";

export const metadata: Metadata = { title: "Visão geral" };

const SOLD: Enums<"order_status">[] = ["paid", "preparing", "shipped", "delivered"];
const LOW_STOCK = 5;

export default async function AdminHomePage() {
  const { supabase } = await requireAdmin();
  const count = (status: Enums<"order_status">) =>
    supabase.from("orders").select("id", { count: "exact", head: true }).eq("status", status);

  const [toShip, preparing, awaiting, month, recent, lowStock] = await Promise.all([
    count("paid"),
    count("preparing"),
    count("pending_payment"),
    supabase.from("orders").select("total_cents").in("status", SOLD).gte("paid_at", startOfMonthInSaoPaulo()),
    supabase
      .from("orders")
      .select("id, number, status, customer_name, total_cents, created_at")
      .order("created_at", { ascending: false })
      .limit(8),
    supabase
      .from("product_variants")
      .select("id, sku, name, stock_quantity, product:products(id, name)")
      .eq("is_active", true)
      .lte("stock_quantity", LOW_STOCK)
      .order("stock_quantity")
      .limit(8),
  ]);
  const sales = month.data ?? [];

  const toShipCount = toShip.count ?? 0;
  const cards: { label: string; value: string; href: string; icon: Icon; urgent?: boolean }[] = [
    // Paid orders waiting to be picked are the one thing that needs the team: they stand out.
    { label: "A separar", value: String(toShipCount), href: "/admin/pedidos?status=paid", icon: Tray, urgent: toShipCount > 0 },
    { label: "Em separação", value: String(preparing.count ?? 0), href: "/admin/pedidos?status=preparing", icon: Package },
    {
      label: "Aguardando pagamento",
      value: String(awaiting.count ?? 0),
      href: "/admin/pedidos?status=pending_payment",
      icon: Clock,
    },
    {
      label: `Vendas no mês · ${sales.length} ${sales.length === 1 ? "pedido" : "pedidos"}`,
      value: formatBRL(sales.reduce((sum, order) => sum + order.total_cents, 0)),
      href: "/admin/pedidos",
      icon: ChartLineUp,
    },
  ];

  return (
    <>
      <AdminHeader title="Visão geral" />
      <ul className="grid grid-cols-2 gap-3 sm:gap-4 xl:grid-cols-4">
        {cards.map(({ icon: CardIcon, ...card }) => (
          <li key={card.label}>
            <Link
              href={card.href}
              className={`flex h-full flex-col gap-3 rounded-3xl p-4 transition sm:p-5 ${
                card.urgent
                  ? "bg-wine text-cream shadow-card hover:bg-wine-deep"
                  : "surface hover:border-wine/40"
              }`}
            >
              <span
                className={`flex size-9 items-center justify-center rounded-full ${card.urgent ? "bg-cream/15" : "bg-blush text-wine"}`}
              >
                <CardIcon size={20} aria-hidden="true" />
              </span>
              <span>
                <span className={`block text-sm ${card.urgent ? "text-cream/85" : "text-ink-muted"}`}>{card.label}</span>
                <span className="mt-1 block text-2xl font-semibold tracking-tight tabular-nums sm:text-3xl">
                  {card.value}
                </span>
              </span>
            </Link>
          </li>
        ))}
      </ul>

      <div className="mt-8 grid grid-cols-1 gap-6 xl:grid-cols-5">
        <div className="xl:col-span-3">
          <Panel
            title="Pedidos recentes"
            action={
              <Link href="/admin/pedidos" className="text-sm font-semibold text-wine hover:underline">
                Ver todos
              </Link>
            }
          >
            {recent.data?.length ? (
              <ul className="divide-y divide-line">
                {recent.data.map((order) => (
                  <li key={order.id}>
                    <Link
                      href={`/admin/pedidos/${order.id}`}
                      className="flex flex-wrap items-center justify-between gap-x-4 gap-y-1 py-3 hover:text-wine"
                    >
                      <span className="min-w-0">
                        <span className="font-semibold">#{order.number}</span>{" "}
                        <span className="text-ink-muted">· {order.customer_name}</span>
                        <span className="block text-xs text-ink-muted">{formatDateTime(order.created_at)}</span>
                      </span>
                      <span className="flex items-center gap-3">
                        <span className="tabular-nums">{formatBRL(order.total_cents)}</span>
                        <StatusBadge status={order.status} />
                      </span>
                    </Link>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="text-sm text-ink-muted">Nenhum pedido ainda.</p>
            )}
          </Panel>
        </div>
        <div className="xl:col-span-2">
          <Panel title={`Estoque baixo (até ${LOW_STOCK})`}>
            {lowStock.data?.length ? (
              <ul className="divide-y divide-line">
                {lowStock.data.map((variant) => (
                  <li key={variant.id}>
                    <Link
                      href={`/admin/produtos/${variant.product?.id}`}
                      className="flex items-center justify-between gap-4 py-3 hover:text-wine"
                    >
                      <span className="min-w-0">
                        <span className="block truncate font-medium">{variant.product?.name}</span>
                        <span className="text-xs text-ink-muted">
                          {variant.name} · {variant.sku}
                        </span>
                      </span>
                      <span
                        className={`shrink-0 font-semibold tabular-nums ${variant.stock_quantity === 0 ? "text-wine" : ""}`}
                      >
                        {variant.stock_quantity === 0 ? "Esgotado" : `${variant.stock_quantity} un.`}
                      </span>
                    </Link>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="text-sm text-ink-muted">Nenhuma variante com estoque baixo.</p>
            )}
          </Panel>
        </div>
      </div>
    </>
  );
}
