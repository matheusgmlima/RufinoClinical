import { MagnifyingGlass } from "@phosphor-icons/react/ssr";
import type { Metadata } from "next";
import Form from "next/form";
import Link from "next/link";

import { AdminHeader, StatusBadge } from "@/components/admin/ui";
import { buttonClass } from "@/components/ui/button";
import { inputClass } from "@/components/ui/field";
import { requireAdmin } from "@/lib/auth/admin";
import { formatDateTime } from "@/lib/dates";
import { formatBRL } from "@/lib/money";
import { ORDER_STATUS_LABEL, PAYMENT_METHOD_LABEL } from "@/lib/orders/status";
import type { Enums } from "@/lib/supabase/database.types";

export const metadata: Metadata = { title: "Pedidos" };

const PAGE_SIZE = 20;
const STATUSES = Object.keys(ORDER_STATUS_LABEL) as Enums<"order_status">[];

type Filters = { status?: Enums<"order_status">; q?: string; pagina?: number };

function href({ status, q, pagina }: Filters) {
  const params = new URLSearchParams();
  if (status) params.set("status", status);
  if (q) params.set("q", q);
  if (pagina && pagina > 1) params.set("pagina", String(pagina));
  const query = params.toString();
  return query ? `/admin/pedidos?${query}` : "/admin/pedidos";
}

export default async function AdminOrdersPage({ searchParams }: PageProps<"/admin/pedidos">) {
  const { supabase } = await requireAdmin();
  const params = await searchParams;
  const status = STATUSES.find((value) => value === params.status);
  // Only letters, digits and e-mail characters reach the PostgREST filter below.
  const q =
    typeof params.q === "string"
      ? params.q
          .replace(/[^\p{L}\p{N}@._ -]/gu, "")
          .trim()
          .slice(0, 80)
      : "";
  const page = Math.min(Math.max(1, Number(params.pagina) || 1), 500);

  let query = supabase
    .from("orders")
    .select("id, number, status, customer_name, customer_email, total_cents, payment_method, created_at", {
      count: "exact",
    })
    .order("created_at", { ascending: false })
    .range((page - 1) * PAGE_SIZE, page * PAGE_SIZE - 1);
  if (status) query = query.eq("status", status);
  if (/^\d{1,12}$/.test(q)) query = query.eq("number", Number(q));
  else if (q) query = query.or(`customer_name.ilike."%${q}%",customer_email.ilike."%${q}%"`);
  const { data: orders, count } = await query;
  const pages = Math.max(1, Math.ceil((count ?? 0) / PAGE_SIZE));

  return (
    <>
      <AdminHeader title="Pedidos" lead={`${count ?? 0} ${count === 1 ? "pedido" : "pedidos"}`} />

      <nav aria-label="Filtrar por status" className="-mx-4 mb-4 overflow-x-auto px-4 lg:mx-0 lg:px-0">
        <ul className="flex gap-2">
          {[undefined, ...STATUSES].map((value) => (
            <li key={value ?? "all"}>
              <Link
                href={href({ status: value, q })}
                aria-current={value === status ? "page" : undefined}
                className={`inline-flex h-9 items-center whitespace-nowrap rounded-full px-4 text-sm font-medium ${
                  value === status ? "bg-wine text-cream" : "border border-line bg-white text-ink hover:border-wine/40"
                }`}
              >
                {value ? ORDER_STATUS_LABEL[value] : "Todos"}
              </Link>
            </li>
          ))}
        </ul>
      </nav>

      <Form action="/admin/pedidos" className="mb-6 flex max-w-xl gap-2" role="search">
        {status ? <input type="hidden" name="status" value={status} /> : null}
        <label htmlFor="q" className="sr-only">
          Buscar por número, nome ou e-mail
        </label>
        <input
          id="q"
          name="q"
          type="search"
          defaultValue={q}
          placeholder="Número, nome ou e-mail"
          className={inputClass}
        />
        <button type="submit" className={buttonClass({ variant: "secondary", className: "h-12 shrink-0" })}>
          <MagnifyingGlass size={18} aria-hidden="true" />
          Buscar
        </button>
      </Form>

      {orders?.length ? (
        <ul className="divide-y divide-line surface px-5">
          {orders.map((order) => (
            <li key={order.id}>
              <Link
                href={`/admin/pedidos/${order.id}`}
                className="grid gap-x-4 gap-y-1 py-4 hover:text-wine sm:grid-cols-[1fr_auto] sm:items-center"
              >
                <span className="min-w-0">
                  <span className="font-semibold">#{order.number}</span>{" "}
                  <span className="text-ink-muted">· {order.customer_name}</span>
                  <span className="block truncate text-xs text-ink-muted">
                    {formatDateTime(order.created_at)} · {order.customer_email}
                    {order.payment_method ? ` · ${PAYMENT_METHOD_LABEL[order.payment_method]}` : ""}
                  </span>
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
        <p className="surface p-8 text-center text-ink-muted">
          Nenhum pedido encontrado.
        </p>
      )}

      {pages > 1 ? (
        <nav aria-label="Páginas" className="mt-6 flex items-center justify-between gap-4 text-sm">
          {page > 1 ? (
            <Link href={href({ status, q, pagina: page - 1 })} className="font-semibold text-wine hover:underline">
              ← Anteriores
            </Link>
          ) : (
            <span />
          )}
          <span className="text-ink-muted">
            Página {page} de {pages}
          </span>
          {page < pages ? (
            <Link href={href({ status, q, pagina: page + 1 })} className="font-semibold text-wine hover:underline">
              Próximos →
            </Link>
          ) : (
            <span />
          )}
        </nav>
      ) : null}
    </>
  );
}
