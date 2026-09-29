import Link from "next/link";
import { Suspense } from "react";

import { Logo } from "@/components/brand/logo";
import { CartButton } from "@/components/cart/cart-drawer";
import type { Category, StoreSettings } from "@/lib/catalog/queries";

import { MobileMenu } from "./mobile-menu";
import { NavLinks } from "./nav-links";

export function Header({ categories, settings }: { categories: Category[]; settings: StoreSettings | null }) {
  return (
    <>
      {settings ? (
        <aside aria-label="Condições de pagamento" className="bg-wine text-cream">
          <p className="container-page flex h-9 items-center justify-center text-center text-xs font-medium tracking-wide">
            {settings.pixDiscountPercent}% off no Pix e até {settings.maxInstallments}x sem juros
          </p>
        </aside>
      ) : null}
      <header className="sticky top-0 z-30 border-b border-line/70 bg-cream/90 backdrop-blur-md">
        <div className="container-page flex h-16 items-center gap-12 lg:h-[4.5rem]">
          <Link href="/" aria-label="Rufino Clinical, página inicial" className="shrink-0 rounded-md">
            <Logo priority className="h-8 w-auto lg:h-9" />
          </Link>
          <Suspense fallback={<NavLinks categories={categories} static />}>
            <NavLinks categories={categories} />
          </Suspense>
          <div className="ml-auto flex items-center gap-1">
            <CartButton />
            <MobileMenu categories={categories} />
          </div>
        </div>
      </header>
    </>
  );
}
