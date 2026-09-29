import { Barcode, CreditCard, PixLogo } from "@phosphor-icons/react/ssr";
import Link from "next/link";

import { Logo } from "@/components/brand/logo";
import type { Category } from "@/lib/catalog/queries";

export function Footer({ categories }: { categories: Category[] }) {
  return (
    <footer className="mt-auto border-t border-line bg-blush/60">
      <div className="container-page grid grid-cols-2 gap-x-6 gap-y-10 py-14 md:grid-cols-12 md:gap-12">
        <div className="col-span-2 space-y-4 md:col-span-4">
          <Logo className="h-9 w-auto" />
          <p className="max-w-xs text-sm leading-relaxed text-ink-muted">
            Materiais para fisioterapia dermatofuncional, escolhidos por quem usa na prática clínica.
          </p>
        </div>

        <nav aria-label="Loja" className="md:col-span-3">
          <p className="text-sm font-semibold text-ink">Loja</p>
          <ul className="mt-4 space-y-2.5 text-sm text-ink-muted">
            <li>
              <Link href="/produtos" className="hover:text-wine">
                Todos os produtos
              </Link>
            </li>
            {categories.map((c) => (
              <li key={c.slug}>
                <Link href={`/produtos?categoria=${c.slug}`} className="hover:text-wine">
                  {c.name}
                </Link>
              </li>
            ))}
          </ul>
        </nav>

        <nav aria-label="Ajuda" className="md:col-span-2">
          <p className="text-sm font-semibold text-ink">Ajuda</p>
          <ul className="mt-4 space-y-2.5 text-sm text-ink-muted">
            <li>
              <Link href="/#duvidas" className="hover:text-wine">
                Dúvidas frequentes
              </Link>
            </li>
            <li>
              <Link href="/carrinho" className="hover:text-wine">
                Carrinho
              </Link>
            </li>
          </ul>
        </nav>

        <div className="col-span-2 md:col-span-3">
          <p className="text-sm font-semibold text-ink">Formas de pagamento</p>
          <ul className="mt-4 flex flex-wrap gap-x-6 gap-y-2.5 text-sm text-ink-muted md:flex-col">
            <li className="flex items-center gap-2.5">
              <PixLogo size={18} className="text-wine" aria-hidden="true" /> Pix
            </li>
            <li className="flex items-center gap-2.5">
              <CreditCard size={18} className="text-wine" aria-hidden="true" /> Cartão de crédito
            </li>
            <li className="flex items-center gap-2.5">
              <Barcode size={18} className="text-wine" aria-hidden="true" /> Boleto
            </li>
          </ul>
        </div>
      </div>
      <div className="border-t border-line">
        <div className="container-page flex flex-col gap-2 py-6 text-xs text-ink-muted sm:flex-row sm:justify-between">
          <p>© {new Date().getFullYear()} Rufino Clinical</p>
          <p>Produtos para saúde. Use com orientação de um profissional.</p>
        </div>
      </div>
    </footer>
  );
}
