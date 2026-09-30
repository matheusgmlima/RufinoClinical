import type { ReactNode } from "react";

import { ORDER_STATUS_TONE, orderStatusLabel } from "@/lib/orders/status";
import type { Enums } from "@/lib/supabase/database.types";

export function AdminHeader({ title, lead, action }: { title: string; lead?: string; action?: ReactNode }) {
  return (
    <div className="mb-8 flex flex-wrap items-end justify-between gap-4">
      <div>
        <h1 className="text-3xl font-semibold tracking-tight text-ink">{title}</h1>
        {lead ? <p className="mt-2 text-ink-muted">{lead}</p> : null}
      </div>
      {action}
    </div>
  );
}

export function StatusBadge({ status, method }: { status: Enums<"order_status">; method?: Enums<"shipping_method"> }) {
  return (
    <span className={`inline-flex rounded-full px-3 py-1 text-xs font-semibold ${ORDER_STATUS_TONE[status]}`}>
      {orderStatusLabel(status, method)}
    </span>
  );
}

/** Catalog visibility: live in the store or a draft only the team sees. */
export function ActiveBadge({ active }: { active: boolean }) {
  return (
    <span
      className={`inline-flex rounded-full px-3 py-1 text-xs font-semibold ${active ? "bg-sage text-sage-ink" : "bg-line text-ink"}`}
    >
      {active ? "Na loja" : "Rascunho"}
    </span>
  );
}

export function Panel({ title, children, action }: { title: string; children: ReactNode; action?: ReactNode }) {
  return (
    <section className="surface p-5 lg:p-6">
      <div className="mb-4 flex items-center justify-between gap-3">
        <h2 className="text-lg font-semibold text-ink">{title}</h2>
        {action}
      </div>
      {children}
    </section>
  );
}
