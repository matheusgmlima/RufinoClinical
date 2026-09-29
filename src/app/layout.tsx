import type { Metadata, Viewport } from "next";
import { Manrope } from "next/font/google";
import { connection } from "next/server";

import { CartDrawer } from "@/components/cart/cart-drawer";
import { CartProvider } from "@/components/cart/cart-provider";
import { Footer } from "@/components/site/footer";
import { Header } from "@/components/site/header";
import { getCategories, getStoreSettings, type Category, type StoreSettings } from "@/lib/catalog/queries";
import { publicEnv } from "@/lib/env/public";

import "./globals.css";

const manrope = Manrope({
  variable: "--font-manrope",
  subsets: ["latin"],
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

async function loadShell(): Promise<{ categories: Category[]; settings: StoreSettings | null }> {
  try {
    const [categories, settings] = await Promise.all([getCategories(), getStoreSettings()]);
    return { categories, settings };
  } catch {
    // The shell degrades to "Todos os produtos" and no promo bar if the catalog is briefly unavailable.
    return { categories: [], settings: null };
  }
}

export default async function RootLayout({ children }: LayoutProps<"/">) {
  // Every page renders per request so Next.js can apply the CSP nonce from src/proxy.ts.
  await connection();
  const { categories, settings } = await loadShell();

  return (
    <html lang="pt-BR" className={`${manrope.variable} h-full antialiased`}>
      <body className="flex min-h-full flex-col font-sans">
        <CartProvider>
          <a
            href="#conteudo"
            className="sr-only focus:not-sr-only focus:fixed focus:left-4 focus:top-4 focus:z-50 focus:rounded-full focus:bg-wine focus:px-4 focus:py-2 focus:text-cream"
          >
            Pular para o conteúdo
          </a>
          <Header categories={categories} settings={settings} />
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
