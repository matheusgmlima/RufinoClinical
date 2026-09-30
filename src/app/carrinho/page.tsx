import type { Metadata } from "next";

import { CartContents } from "@/components/cart/cart-contents";

export const metadata: Metadata = { title: "Carrinho" };

export default function CartPage() {
  return (
    <div className="container-page flex min-h-svh flex-1 flex-col py-12 lg:py-16">
      <h1 className="text-4xl font-semibold tracking-tight text-ink md:text-5xl">Carrinho</h1>
      <div className="mt-10 flex flex-1 flex-col">
        <CartContents variant="page" />
      </div>
    </div>
  );
}
