"use client";

import { useState } from "react";

import type { ProductImage as ProductImageType } from "@/lib/catalog/queries";

import { ProductImage } from "./product-image";
import { useProductView } from "./product-view";

export function ProductGallery({ images, productName }: { images: ProductImageType[]; productName: string }) {
  const { variantId } = useProductView();
  const [picked, setPicked] = useState<{ index: number; forVariant: string } | null>(null);

  // A photo tagged with the selected variant wins until the shopper picks another thumbnail.
  const variantIndex = images.findIndex((image) => image.variantId === variantId);
  const active =
    picked && picked.forVariant === variantId ? picked.index : variantIndex >= 0 ? variantIndex : 0;

  if (images.length === 0) {
    return <ProductImage image={null} sizes="(min-width: 1024px) 55vw, 100vw" className="aspect-square" />;
  }

  return (
    <div className="grid gap-4">
      <ProductImage image={images[active]} sizes="(min-width: 1024px) 55vw, 100vw" priority className="aspect-square" />
      {images.length > 1 ? (
        <ul className="grid grid-cols-5 gap-3" aria-label={`Fotos de ${productName}`}>
          {images.map((image, i) => (
            <li key={image.url}>
              <button
                type="button"
                onClick={() => setPicked({ index: i, forVariant: variantId })}
                aria-label={`Ver foto ${i + 1} de ${images.length}`}
                aria-current={i === active ? "true" : undefined}
                className={`block w-full rounded-2xl ring-offset-2 ring-offset-cream transition ${
                  i === active ? "ring-2 ring-wine" : "opacity-80 hover:opacity-100"
                }`}
              >
                <ProductImage image={image} sizes="12vw" className="aspect-square" />
              </button>
            </li>
          ))}
        </ul>
      ) : null}
    </div>
  );
}
