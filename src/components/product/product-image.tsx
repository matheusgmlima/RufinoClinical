import Image from "next/image";

import { LogoSymbol } from "@/components/brand/logo";
import type { ProductImage as ProductImageType } from "@/lib/catalog/queries";

type Props = {
  image: ProductImageType | null;
  sizes: string;
  priority?: boolean;
  className?: string;
};

/** Product photo, or a branded placeholder while the product has no photo yet. */
export function ProductImage({ image, sizes, priority, className }: Props) {
  return (
    <div className={`relative overflow-hidden rounded-2xl bg-blush ${className ?? ""}`}>
      {image ? (
        <Image src={image.url} alt={image.alt} fill sizes={sizes} priority={priority} className="object-cover" />
      ) : (
        <div className="absolute inset-0 flex items-center justify-center">
          <LogoSymbol className="h-2/5 w-auto text-wine/10" />
          <span className="sr-only">Foto do produto em breve</span>
        </div>
      )}
    </div>
  );
}
