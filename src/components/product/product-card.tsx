import Link from "next/link";

import type { ProductSummary, StoreSettings } from "@/lib/catalog/queries";

import { Price } from "./price";
import { ProductImage } from "./product-image";

export function ProductCard({ product, settings }: { product: ProductSummary; settings: StoreSettings }) {
  return (
    <Link href={`/produtos/${product.slug}`} className="group flex flex-col gap-4 rounded-2xl outline-offset-4">
      <div className="relative">
        <ProductImage
          image={product.image}
          sizes="(min-width: 1024px) 22vw, 45vw"
          className="aspect-[4/5] transition duration-500 ease-out group-hover:-translate-y-1"
        />
        {!product.inStock ? (
          <span className="absolute left-3 top-3 rounded-full bg-cream px-3 py-1 text-xs font-semibold text-ink">
            Esgotado
          </span>
        ) : null}
      </div>
      <div className="space-y-2 px-1">
        {product.category ? <p className="text-xs font-medium text-ink-muted">{product.category.name}</p> : null}
        <h3 className="text-[0.95rem] font-semibold leading-snug text-ink text-balance group-hover:text-wine">
          {product.name}
        </h3>
        <Price
          priceCents={product.priceCents}
          compareAtPriceCents={product.compareAtPriceCents}
          settings={settings}
          prefix={product.hasPriceRange ? "a partir de" : undefined}
        />
      </div>
    </Link>
  );
}

export function ProductGridSkeleton({ count = 8 }: { count?: number }) {
  return (
    <div className="grid grid-cols-2 gap-x-5 gap-y-10 lg:grid-cols-4" aria-hidden="true">
      {Array.from({ length: count }, (_, i) => (
        <div key={i} className="flex flex-col gap-4">
          <div className="aspect-[4/5] animate-pulse rounded-2xl bg-blush" />
          <div className="space-y-2 px-1">
            <div className="h-3 w-1/3 animate-pulse rounded-full bg-blush" />
            <div className="h-4 w-4/5 animate-pulse rounded-full bg-blush" />
            <div className="h-4 w-1/2 animate-pulse rounded-full bg-blush" />
          </div>
        </div>
      ))}
    </div>
  );
}
