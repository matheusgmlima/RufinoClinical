import type { Metadata, Viewport } from "next";
import { Manrope, Syncopate } from "next/font/google";
import { connection } from "next/server";

import { CartDrawer } from "@/components/cart/cart-drawer";
import { CartProvider } from "@/components/cart/cart-provider";
import { Footer } from "@/components/site/footer";
import { Header } from "@/components/site/header";
import { getCategories, type Category } from "@/lib/catalog/queries";
import { publicEnv } from "@/lib/env/public";

import "./globals.css";

const manrope = Manrope({
  variable: "--font-manrope",
  subsets: ["latin"],
  display: "swap",
});

const syncopate = Syncopate({
  variable: "--font-syncopate",
  subsets: ["latin"],
  weight: ["400", "700"],
  display: "swap",
});

export const metadata: Metadata = {
  metadataBase: new URL(publicEnv.NEXT_PUBLIC_SITE_URL),
  title: {
    default: "Rufino Clinical | Fisioterapia dermatofuncional",
    template: "%s | Rufino Clinical",
  },
  description: "Tapes, compressão e materiais de pós-operatório para fisioterapia dermatofuncional.",
  // Keep the store out of search engines until launch.
  robots: { index: false, follow: false },
};

export const viewport: Viewport = {
  themeColor: "#fbf7f4",
};

async function loadCategories(): Promise<Category[]> {
  try {
    return await getCategories();
  } catch {
    // Navigation degrades to "Todos os produtos" if the catalog is briefly unavailable.
    return [];
  }
}

export default async function RootLayout({ children }: LayoutProps<"/">) {
  // Every page renders per request so Next.js can apply the CSP nonce from src/proxy.ts.
  await connection();
  const categories = await loadCategories();

  return (
    <html lang="pt-BR" className={`${manrope.variable} ${syncopate.variable} h-full antialiased`}>
      <body className="flex min-h-full flex-col font-sans">
        <CartProvider>
          <a
            href="#conteudo"
            className="sr-only focus:not-sr-only focus:fixed focus:left-4 focus:top-4 focus:z-50 focus:rounded-full focus:bg-wine focus:px-4 focus:py-2 focus:text-cream"
          >
            Pular para o conteúdo
          </a>
          <Header categories={categories} />
          <main id="conteudo" className="flex flex-1 flex-col">
            {children}
          </main>
          <Footer categories={categories} />
          <CartDrawer />
        </CartProvider>
      </body>
    </html>
  );
}
