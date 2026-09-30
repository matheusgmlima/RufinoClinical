import Link from "next/link";
import type { ReactNode } from "react";

import { POLICIES_UPDATED_AT } from "@/lib/legal/company";

// Plain, readable legal text: one column, numbered sections, links between the three documents.

const DOCUMENTS = [
  { href: "/termos", label: "Termos de uso" },
  { href: "/privacidade", label: "Política de privacidade" },
  { href: "/trocas-e-devolucoes", label: "Trocas e devoluções" },
] as const;

export function LegalPage({ title, lead, current, children }: { title: string; lead: string; current: string; children: ReactNode }) {
  return (
    <div className="container-page py-12 lg:py-20">
      <article className="mx-auto max-w-2xl">
        <p className="text-sm text-ink-muted">Atualizado em {POLICIES_UPDATED_AT}</p>
        <h1 className="mt-2 text-3xl font-semibold tracking-tight text-ink lg:text-4xl">{title}</h1>
        <p className="mt-4 text-lg leading-relaxed text-ink-muted">{lead}</p>
        <div className="mt-10 space-y-10">{children}</div>
        <nav aria-label="Documentos da loja" className="mt-14 border-t border-line pt-6">
          <ul className="flex flex-wrap gap-x-6 gap-y-2 text-sm">
            {DOCUMENTS.filter((doc) => doc.href !== current).map((doc) => (
              <li key={doc.href}>
                <Link href={doc.href} className="font-semibold text-wine hover:underline">
                  {doc.label}
                </Link>
              </li>
            ))}
          </ul>
        </nav>
      </article>
    </div>
  );
}

export function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="space-y-3">
      <h2 className="text-xl font-semibold text-ink">{title}</h2>
      <div className="space-y-3 leading-relaxed text-ink-muted [&_a]:font-semibold [&_a]:text-wine [&_a:hover]:underline [&_strong]:text-ink">
        {children}
      </div>
    </section>
  );
}

export function List({ children }: { children: ReactNode }) {
  return <ul className="list-disc space-y-2 pl-5 marker:text-wine">{children}</ul>;
}
