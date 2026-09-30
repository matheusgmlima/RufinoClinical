"use client";

import { Storefront } from "@phosphor-icons/react";
import Link from "next/link";
import { usePathname } from "next/navigation";

const links = [
  { href: "/conta", label: "Pedidos" },
  { href: "/conta/dados", label: "Meus dados" },
  { href: "/conta/enderecos", label: "Endereços" },
];

/** Account sections; the team also gets a way into the store panel (it asks for the 2FA code). */
export function AccountNav({ admin = false }: { admin?: boolean }) {
  const pathname = usePathname();
  return (
    <nav aria-label="Minha conta" className="-mx-4 overflow-x-auto px-4 lg:mx-0 lg:px-0">
      <ul className="flex gap-2 lg:flex-col lg:gap-1">
        {links.map((link) => {
          const current = pathname === link.href;
          return (
            <li key={link.href}>
              <Link
                href={link.href}
                aria-current={current ? "page" : undefined}
                className={`inline-flex h-10 items-center whitespace-nowrap rounded-full px-5 text-sm font-medium transition lg:flex lg:w-full ${
                  current ? "bg-wine text-cream" : "text-ink hover:bg-white"
                }`}
              >
                {link.label}
              </Link>
            </li>
          );
        })}
        {admin ? (
          <li className="lg:mt-3 lg:border-t lg:border-wine/10 lg:pt-3">
            <Link
              href="/admin"
              className="inline-flex h-10 items-center gap-2 whitespace-nowrap rounded-full border border-wine/25 bg-white px-5 text-sm font-semibold text-wine transition hover:border-wine lg:flex lg:w-full"
            >
              <Storefront size={18} aria-hidden="true" />
              Painel da loja
            </Link>
          </li>
        ) : null}
      </ul>
    </nav>
  );
}
