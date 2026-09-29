import type { Metadata, Viewport } from "next";
import { Manrope, Syncopate } from "next/font/google";
import { connection } from "next/server";

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
    default: "Rufino Clinical — Fisioterapia dermatofuncional",
    template: "%s · Rufino Clinical",
  },
  description: "Tapes, bandagens e produtos para fisioterapia dermatofuncional.",
  // Keep the store out of search engines until launch.
  robots: { index: false, follow: false },
};

export const viewport: Viewport = {
  themeColor: "#6e0b1e",
};

export default async function RootLayout({ children }: LayoutProps<"/">) {
  // Every page renders per request so Next.js can apply the CSP nonce from src/proxy.ts.
  await connection();

  return (
    <html lang="pt-BR" className={`${manrope.variable} ${syncopate.variable} h-full antialiased`}>
      <body className="flex min-h-full flex-col font-sans">{children}</body>
    </html>
  );
}
