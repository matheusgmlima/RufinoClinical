import { ProductGridSkeleton } from "@/components/product/product-card";

export default function Loading() {
  return (
    <div className="container-page py-12 lg:py-16" aria-busy="true" aria-label="Carregando produtos">
      <div className="h-11 w-56 animate-pulse rounded-full bg-blush" />
      <div className="mt-4 h-4 w-80 max-w-full animate-pulse rounded-full bg-blush" />
      <div className="mt-20">
        <ProductGridSkeleton />
      </div>
    </div>
  );
}
