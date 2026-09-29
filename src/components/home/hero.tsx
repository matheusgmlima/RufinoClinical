import Link from "next/link";

import { LogoSymbol } from "@/components/brand/logo";
import { ProductImage } from "@/components/product/product-image";
import { ButtonLink } from "@/components/ui/button";
import type { ProductSummary, StoreSettings } from "@/lib/catalog/queries";
import { formatBRL, pixPriceCents } from "@/lib/money";

export function Hero({ spotlight, settings }: { spotlight: ProductSummary | null; settings: StoreSettings }) {
  return (
    <section className="container-page grid items-center gap-8 pb-12 pt-8 lg:grid-cols-12 lg:gap-16 lg:pb-24 lg:pt-16">
      <div className="lg:col-span-6">
        <h1 className="rise-in max-w-xl text-4xl font-semibold leading-[1.05] tracking-tight text-ink text-balance md:text-5xl lg:text-6xl">
          Do consultório para a sua recuperação
        </h1>
        <p
          className="rise-in mt-5 max-w-md text-base leading-relaxed sm:text-lg text-ink-muted text-pretty"
          style={{ "--i": 1 } as React.CSSProperties}
        >
          Tapes, compressão e pós-operatório para fisioterapia dermatofuncional, escolhidos por fisioterapeuta.{" "}
          {settings.pixDiscountPercent}% off no Pix.
        </p>
        <div className="rise-in mt-7 flex flex-wrap gap-3 sm:mt-9" style={{ "--i": 2 } as React.CSSProperties}>
          <ButtonLink href="/produtos" size="lg">
            Ver produtos
          </ButtonLink>
        </div>
      </div>

      {/* Brand panel. TODO: replace with a lifestyle photo (4:5) once the client sends it. */}
      <div className="relative lg:col-span-6">
        <div className="relative aspect-[16/11] overflow-hidden rounded-[28px] bg-wine sm:aspect-[4/3] lg:aspect-[4/5]">
          <LogoSymbol className="absolute -right-[12%] -top-[6%] h-[118%] w-auto text-cream/[0.07]" />
          <div className="absolute -left-[20%] top-[34%] h-14 w-[95%] -rotate-[18deg] rounded-full bg-nude/90 sm:h-16" />
          <div className="absolute -left-[10%] top-[52%] h-10 w-[80%] rotate-[9deg] rounded-full bg-blush/25 sm:h-12" />

          {spotlight ? (
            <Link
              href={`/produtos/${spotlight.slug}`}
              className="absolute inset-x-4 bottom-4 flex items-center gap-4 rounded-2xl bg-cream p-3 pr-5 shadow-[0_20px_50px_-20px_rgb(63_6_17/0.6)] transition hover:-translate-y-0.5 sm:inset-x-auto sm:left-6 sm:bottom-6 sm:w-80"
            >
              <ProductImage image={spotlight.image} sizes="72px" className="size-18 shrink-0" />
              <div className="min-w-0">
                <p className="text-xs font-medium text-ink-muted">Destaque</p>
                <p className="truncate text-sm font-semibold text-ink">{spotlight.name}</p>
                <p className="text-sm font-semibold text-wine tabular-nums">
                  {formatBRL(pixPriceCents(spotlight.priceCents, settings.pixDiscountPercent))} no Pix
                </p>
              </div>
            </Link>
          ) : null}
        </div>
      </div>
    </section>
  );
}
