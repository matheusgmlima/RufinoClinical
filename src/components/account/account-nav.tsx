"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const links = [
  { href: "/conta", label: "Pedidos" },
  { href: "/conta/dados", label: "Meus dados" },
  { href: "/conta/enderecos", label: "Endereços" },
];

export function AccountNav() {
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
                  current ? "bg-wine text-cream" : "text-ink hover:bg-blush"
                }`}
              >
                {link.label}
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
