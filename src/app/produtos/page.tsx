import type { Metadata } from "next";
import Link from "next/link";

import { LogoSymbol } from "@/components/brand/logo";
import { ProductCard } from "@/components/product/product-card";
import { ButtonLink } from "@/components/ui/button";
import { getCategories, getProducts, getStoreSettings } from "@/lib/catalog/queries";

export const metadata: Metadata = { title: "Produtos" };

export default async function ProductsPage({ searchParams }: PageProps<"/produtos">) {
  const { categoria } = await searchParams;
  const slug = typeof categoria === "string" ? categoria : undefined;

  const [settings, categories] = await Promise.all([getStoreSettings(), getCategories()]);
  const current = categories.find((c) => c.slug === slug);
  const products = await getProducts({ categorySlug: current?.slug });

  const pill = (active: boolean) =>
    `inline-flex h-10 items-center rounded-full border px-5 text-sm font-medium whitespace-nowrap transition ${
      active ? "border-wine bg-wine text-cream" : "border-line text-ink hover:border-wine/50"
    }`;

  return (
    <div className="container-page py-12 lg:py-16">
      <h1 className="text-4xl font-semibold tracking-tight text-ink md:text-5xl">{current?.name ?? "Produtos"}</h1>
      <p className="mt-3 max-w-xl text-ink-muted">
        {current?.description ?? "Tapes, compressão e materiais de pós-operatório para fisioterapia dermatofuncional."}
      </p>

      <nav aria-label="Categorias" className="-mx-4 mt-8 overflow-x-auto px-4 sm:mx-0 sm:px-0">
        <ul className="flex gap-2">
          <li>
            <Link href="/produtos" className={pill(!current)} aria-current={!current ? "page" : undefined}>
              Todos
            </Link>
          </li>
          {categories.map((c) => (
            <li key={c.slug}>
              <Link
                href={`/produtos?categoria=${c.slug}`}
                className={pill(c.slug === current?.slug)}
                aria-current={c.slug === current?.slug ? "page" : undefined}
              >
                {c.name}
              </Link>
            </li>
          ))}
        </ul>
      </nav>

      <h2 className="sr-only">Lista de produtos</h2>
      {products.length > 0 ? (
        <div className="mt-12 grid grid-cols-2 gap-x-5 gap-y-12 lg:grid-cols-4">
          {products.map((product) => (
            <ProductCard key={product.id} product={product} settings={settings} />
          ))}
        </div>
      ) : (
        <div className="mt-12 flex flex-col items-center gap-5 rounded-2xl bg-blush px-6 py-20 text-center">
          <LogoSymbol className="h-14 w-auto text-wine/20" />
          <div className="space-y-1.5">
            <p className="text-lg font-semibold text-ink">Nenhum produto nesta categoria ainda</p>
            <p className="text-sm text-ink-muted">Novidades chegam em breve. Veja o que já está disponível.</p>
          </div>
          <ButtonLink href="/produtos" variant="secondary">
            Ver todos os produtos
          </ButtonLink>
        </div>
      )}
    </div>
  );
}
