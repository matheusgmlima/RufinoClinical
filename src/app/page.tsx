import { ArrowRight } from "@phosphor-icons/react/ssr";
import Link from "next/link";

import { Benefits } from "@/components/home/benefits";
import { CategoriesBento } from "@/components/home/categories-bento";
import { Faq } from "@/components/home/faq";
import { Hero } from "@/components/home/hero";
import { Statement } from "@/components/home/statement";
import { ProductCard } from "@/components/product/product-card";
import { getCategories, getProducts, getStoreSettings } from "@/lib/catalog/queries";

export default async function Home() {
  const [settings, featured, categories] = await Promise.all([
    getStoreSettings(),
    getProducts({ featured: true }),
    getCategories(),
  ]);
  const spotlight = featured.find((p) => p.inStock) ?? null;

  return (
    <>
      <Hero spotlight={spotlight} settings={settings} />
      <Benefits settings={settings} />

      {featured.length > 0 ? (
        <section className="container-page py-20 lg:py-28">
          <div className="flex items-end justify-between gap-6">
            <h2 className="text-3xl font-semibold tracking-tight text-ink md:text-4xl">Mais procurados</h2>
            <Link href="/produtos" className="group inline-flex items-center gap-2 text-sm font-semibold text-wine">
              Ver todos
              <ArrowRight size={16} weight="bold" className="transition group-hover:translate-x-1" aria-hidden="true" />
            </Link>
          </div>
          <div className="mt-10 grid grid-cols-2 gap-x-5 gap-y-12 lg:grid-cols-4">
            {featured.slice(0, 4).map((product) => (
              <ProductCard key={product.id} product={product} settings={settings} />
            ))}
          </div>
        </section>
      ) : null}

      <Statement />
      <CategoriesBento categories={categories} />
      <Faq settings={settings} />
    </>
  );
}
