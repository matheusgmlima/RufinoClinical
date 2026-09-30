import type { Metadata } from "next";
import Link from "next/link";

import { AdminHeader } from "@/components/admin/ui";
import {
  AUDIT_TABLES,
  auditChanges,
  auditHref,
  auditSubject,
  entityLabel,
  fieldLabel,
  type AuditTable,
} from "@/lib/admin/audit";
import { requireAdmin } from "@/lib/auth/admin";
import { formatDateTime } from "@/lib/dates";

export const metadata: Metadata = { title: "Auditoria" };

const PAGE_SIZE = 30;
const VERB: Record<string, string> = { INSERT: "criou", UPDATE: "alterou", DELETE: "excluiu" };
type Data = Record<string, unknown> | null;

function href({ tabela, pagina }: { tabela?: AuditTable; pagina?: number }) {
  const params = new URLSearchParams();
  if (tabela) params.set("tabela", tabela);
  if (pagina && pagina > 1) params.set("pagina", String(pagina));
  const query = params.toString();
  return query ? `/admin/auditoria?${query}` : "/admin/auditoria";
}

export default async function AdminAuditPage({ searchParams }: PageProps<"/admin/auditoria">) {
  const { supabase } = await requireAdmin();
  const params = await searchParams;
  const tabela = (Object.keys(AUDIT_TABLES) as AuditTable[]).find((key) => key === params.tabela);
  const page = Math.min(Math.max(1, Number(params.pagina) || 1), 500);

  let query = supabase
    .from("audit_log")
    .select("id, actor_id, action, table_name, row_id, old_data, new_data, created_at", { count: "exact" })
    .order("id", { ascending: false })
    .range((page - 1) * PAGE_SIZE, page * PAGE_SIZE - 1);
  query = tabela ? query.eq("table_name", tabela) : query.in("table_name", Object.keys(AUDIT_TABLES));
  const { data: entries, count } = await query;
  const pages = Math.max(1, Math.ceil((count ?? 0) / PAGE_SIZE));

  // Who did it: the person's name from their profile (admins can read profiles).
  const actorIds = [...new Set((entries ?? []).map((entry) => entry.actor_id).filter((id): id is string => !!id))];
  const { data: people } = actorIds.length
    ? await supabase.from("profiles").select("id, full_name").in("id", actorIds)
    : { data: [] };
  const names = new Map((people ?? []).map((person) => [person.id, person.full_name]));

  return (
    <>
      <AdminHeader title="Auditoria" lead="Tudo que muda na loja fica registrado aqui e não pode ser apagado." />

      <nav aria-label="Filtrar por área" className="-mx-4 mb-6 overflow-x-auto px-4 lg:mx-0 lg:px-0">
        <ul className="flex gap-2">
          {([undefined, ...Object.keys(AUDIT_TABLES)] as (AuditTable | undefined)[]).map((value) => (
            <li key={value ?? "all"}>
              <Link
                href={href({ tabela: value })}
                aria-current={value === tabela ? "page" : undefined}
                className={`inline-flex h-9 items-center whitespace-nowrap rounded-full px-4 text-sm font-medium ${
                  value === tabela ? "bg-wine text-cream" : "border border-line text-ink hover:border-wine/40"
                }`}
              >
                {value ? AUDIT_TABLES[value] : "Tudo"}
              </Link>
            </li>
          ))}
        </ul>
      </nav>

      {entries?.length ? (
        <ol className="divide-y divide-line rounded-3xl border border-line bg-white/70 px-5">
          {entries.map((entry) => {
            const before = entry.old_data as Data;
            const after = entry.new_data as Data;
            const changes = entry.action === "UPDATE" ? auditChanges(before, after) : [];
            const subject = auditSubject(entry.table_name, before, after);
            const link = auditHref(entry.table_name, entry.row_id, before, after);
            const actor = entry.actor_id ? (names.get(entry.actor_id) ?? "Usuário sem nome") : "Sistema";
            return (
              <li key={entry.id} className="py-4">
                <p className="text-sm">
                  <span className="font-semibold">{actor}</span> {VERB[entry.action] ?? entry.action}{" "}
                  {entityLabel(entry.table_name)}{" "}
                  {subject ? (
                    link ? (
                      <Link href={link} className="font-semibold text-wine hover:underline">
                        {subject}
                      </Link>
                    ) : (
                      <span className="font-semibold">{subject}</span>
                    )
                  ) : null}
                </p>
                <p className="text-xs text-ink-muted">{formatDateTime(entry.created_at)}</p>
                {changes.length ? (
                  <ul className="mt-2 grid gap-1 text-xs">
                    {changes.map((change) => (
                      <li key={change.field} className="break-words">
                        <span className="text-ink-muted">{fieldLabel(change.field)}:</span> {change.before} →{" "}
                        <span className="font-semibold">{change.after}</span>
                      </li>
                    ))}
                  </ul>
                ) : null}
              </li>
            );
          })}
        </ol>
      ) : (
        <p className="rounded-3xl border border-line bg-white/70 p-8 text-center text-ink-muted">Nenhum registro.</p>
      )}

      {pages > 1 ? (
        <nav aria-label="Páginas" className="mt-6 flex items-center justify-between gap-4 text-sm">
          {page > 1 ? (
            <Link href={href({ tabela, pagina: page - 1 })} className="font-semibold text-wine hover:underline">
              ← Mais recentes
            </Link>
          ) : (
            <span />
          )}
          <span className="text-ink-muted">
            Página {page} de {pages}
          </span>
          {page < pages ? (
            <Link href={href({ tabela, pagina: page + 1 })} className="font-semibold text-wine hover:underline">
              Mais antigos →
            </Link>
          ) : (
            <span />
          )}
        </nav>
      ) : null}
    </>
  );
}
