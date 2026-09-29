import Link from "next/link";

import { Logo } from "@/components/brand/logo";
import { CartButton } from "@/components/cart/cart-drawer";
import type { Category } from "@/lib/catalog/queries";

import { MobileMenu } from "./mobile-menu";

export function Header({ categories }: { categories: Category[] }) {
  return (
    <header className="sticky top-0 z-30 border-b border-line/70 bg-cream/90 backdrop-blur-md">
      <div className="container-page flex h-16 items-center gap-10">
        <Link href="/" aria-label="Rufino Clinical, página inicial" className="rounded-full text-wine">
          <Logo />
        </Link>
        <nav aria-label="Principal" className="hidden items-center gap-7 text-sm font-medium text-ink-muted lg:flex">
          <Link href="/produtos" className="hover:text-wine">
            Todos os produtos
          </Link>
          {categories.map((c) => (
            <Link key={c.slug} href={`/produtos?categoria=${c.slug}`} className="hover:text-wine">
              {c.name}
            </Link>
          ))}
        </nav>
        <div className="ml-auto flex items-center gap-1">
          <CartButton />
          <MobileMenu categories={categories} />
        </div>
      </div>
    </header>
  );
}
