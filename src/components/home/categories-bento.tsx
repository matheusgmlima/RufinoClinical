import { ArrowRight } from "@phosphor-icons/react/ssr";
import Link from "next/link";

import { LogoSymbol } from "@/components/brand/logo";
import type { Category } from "@/lib/catalog/queries";

// Four cells with distinct surfaces. Any other category count falls back to an even grid.
const cells = [
  "bg-wine text-cream lg:row-span-2 min-h-52 lg:min-h-full",
  "bg-blush text-ink lg:col-span-2 min-h-44 lg:min-h-56",
  "bg-nude/45 text-ink min-h-44 lg:min-h-56",
  "bg-cream text-ink border border-line min-h-44 lg:min-h-56",
];

export function CategoriesBento({ categories }: { categories: Category[] }) {
  if (categories.length === 0) return null;
  const bento = categories.length === 4;

  return (
    <section className="container-page py-14 lg:py-28">
      <h2 className="text-3xl font-semibold tracking-tight text-ink md:text-4xl">Compre por necessidade</h2>
      <div className={`mt-8 grid gap-3 lg:mt-10 lg:gap-4 ${bento ? "lg:grid-cols-3 lg:grid-rows-2" : "sm:grid-cols-2 lg:grid-cols-3"}`}>
        {categories.map((category, i) => {
          const surface = bento ? cells[i] : "bg-blush text-ink min-h-56";
          const dark = surface.includes("bg-wine");
          const tinted = surface.includes("bg-nude");
          return (
            <Link
              key={category.slug}
              href={`/produtos?categoria=${category.slug}`}
              className={`group relative flex flex-col justify-end overflow-hidden rounded-2xl p-6 lg:p-7 transition hover:-translate-y-0.5 ${surface}`}
            >
              {i === 0 && bento ? (
                <LogoSymbol className="absolute -right-10 -top-8 h-[85%] w-auto text-cream/[0.08]" />
              ) : null}
              {i === 1 && bento ? (
                <div className="absolute -right-16 top-8 h-12 w-2/3 -rotate-12 rounded-full bg-nude/70" />
              ) : null}
              <div className="relative">
                <h3 className="text-xl font-semibold tracking-tight">{category.name}</h3>
                {category.description ? (
                  <p
                    className={`mt-2 max-w-xs text-sm leading-relaxed ${dark ? "text-cream/75" : tinted ? "text-ink/80" : "text-ink-muted"}`}
                  >
                    {category.description}
                  </p>
                ) : null}
                <span className={`mt-5 inline-flex items-center gap-2 text-sm font-semibold ${dark ? "text-cream" : "text-wine"}`}>
                  Ver produtos
                  <ArrowRight size={16} weight="bold" className="transition group-hover:translate-x-1" aria-hidden="true" />
                </span>
              </div>
            </Link>
          );
        })}
      </div>
    </section>
  );
}
