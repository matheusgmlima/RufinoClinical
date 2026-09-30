"use client";

import {
  ClockCounterClockwise,
  Gear,
  Package,
  Receipt,
  SquaresFour,
  Tag,
  Ticket,
  type Icon,
} from "@phosphor-icons/react";
import Link from "next/link";
import { usePathname } from "next/navigation";

const LINKS: { href: string; label: string; icon: Icon }[] = [
  { href: "/admin", label: "Visão geral", icon: SquaresFour },
  { href: "/admin/pedidos", label: "Pedidos", icon: Receipt },
  { href: "/admin/produtos", label: "Produtos", icon: Package },
  { href: "/admin/categorias", label: "Categorias", icon: Tag },
  { href: "/admin/cupons", label: "Cupons", icon: Ticket },
  { href: "/admin/configuracoes", label: "Configurações", icon: Gear },
  { href: "/admin/auditoria", label: "Auditoria", icon: ClockCounterClockwise },
];

export function AdminNav() {
  const pathname = usePathname();
  return (
    <nav aria-label="Painel" className="-mx-4 overflow-x-auto px-4 lg:mx-0 lg:px-0">
      <ul className="flex gap-1 lg:flex-col">
        {LINKS.map(({ href, label, icon: Icon }) => {
          const current = href === "/admin" ? pathname === href : pathname.startsWith(href);
          return (
            <li key={href}>
              <Link
                href={href}
                aria-current={current ? "page" : undefined}
                className={`flex h-10 items-center gap-3 whitespace-nowrap rounded-full px-4 text-sm font-medium transition ${
                  current ? "bg-wine text-cream" : "text-ink hover:bg-blush"
                }`}
              >
                <Icon size={18} aria-hidden="true" />
                {label}
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
