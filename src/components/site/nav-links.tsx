"use client";

import Link from "next/link";
import { usePathname, useSearchParams } from "next/navigation";

import type { Category } from "@/lib/catalog/queries";

type Props = { categories: Category[]; static?: boolean };

export function NavLinks(props: Props) {
  return props.static ? <Links categories={props.categories} active={null} /> : <ActiveLinks {...props} />;
}

function ActiveLinks({ categories }: Props) {
  const pathname = usePathname();
  const category = useSearchParams().get("categoria");
  const active = pathname === "/produtos" ? (category ?? "all") : null;
  return <Links categories={categories} active={active} />;
}

function Links({ categories, active }: { categories: Category[]; active: string | null }) {
  const items = [{ key: "all", href: "/produtos", label: "Todos os produtos" }].concat(
    categories.map((c) => ({ key: c.slug, href: `/produtos?categoria=${c.slug}`, label: c.name })),
  );
  return (
    <nav aria-label="Principal" className="hidden h-full items-stretch gap-8 text-sm font-medium lg:flex">
      {items.map((item) => {
        const current = item.key === active;
        return (
          <Link
            key={item.key}
            href={item.href}
            aria-current={current ? "page" : undefined}
            className={`relative flex items-center transition-colors hover:text-wine after:absolute after:inset-x-0 after:bottom-0 after:h-[3px] after:rounded-full after:bg-wine after:transition-opacity ${
              current ? "text-wine after:opacity-100" : "text-ink-muted after:opacity-0"
            }`}
          >
            {item.label}
          </Link>
        );
      })}
    </nav>
  );
}
