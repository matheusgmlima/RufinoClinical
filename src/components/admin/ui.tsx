import type { ReactNode } from "react";

import { ORDER_STATUS_LABEL } from "@/lib/orders/status";
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

// Orders that need someone's action stand out; finished ones fade.
const STATUS_TONE: Record<Enums<"order_status">, string> = {
  pending_payment: "bg-line text-ink",
  paid: "bg-wine text-cream",
  preparing: "bg-nude text-ink",
  shipped: "bg-blush text-wine",
  delivered: "bg-blush text-ink-muted",
  canceled: "bg-line/60 text-ink-muted",
  refunded: "bg-line/60 text-ink-muted",
};

export function StatusBadge({ status }: { status: Enums<"order_status"> }) {
  return (
    <span className={`inline-flex rounded-full px-3 py-1 text-xs font-semibold ${STATUS_TONE[status]}`}>
      {ORDER_STATUS_LABEL[status]}
    </span>
  );
}

/** Catalog visibility: live in the store or a draft only the team sees. */
export function ActiveBadge({ active }: { active: boolean }) {
  return (
    <span
      className={`inline-flex rounded-full px-3 py-1 text-xs font-semibold ${active ? "bg-blush text-wine" : "bg-line/60 text-ink-muted"}`}
    >
      {active ? "Na loja" : "Rascunho"}
    </span>
  );
}

export function Panel({ title, children, action }: { title: string; children: ReactNode; action?: ReactNode }) {
  return (
    <section className="rounded-3xl border border-line bg-white/70 p-5 lg:p-6">
      <div className="mb-4 flex items-center justify-between gap-3">
        <h2 className="text-lg font-semibold text-ink">{title}</h2>
        {action}
      </div>
      {children}
    </section>
  );
}
