"use client";

import { createContext, useContext, useState } from "react";

// Shares the selected variant between the gallery and the purchase panel.
const ProductViewContext = createContext<{ variantId: string; setVariantId: (id: string) => void } | null>(null);

export function ProductView({ initialVariantId, children }: { initialVariantId: string; children: React.ReactNode }) {
  const [variantId, setVariantId] = useState(initialVariantId);
  return <ProductViewContext.Provider value={{ variantId, setVariantId }}>{children}</ProductViewContext.Provider>;
}

export function useProductView() {
  const ctx = useContext(ProductViewContext);
  if (!ctx) throw new Error("useProductView must be used inside ProductView");
  return ctx;
}
