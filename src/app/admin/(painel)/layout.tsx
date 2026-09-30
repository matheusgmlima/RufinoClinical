import { ArrowSquareOut, SignOut } from "@phosphor-icons/react/ssr";
import type { Metadata } from "next";
import Link from "next/link";

import { signOut } from "@/app/actions/auth";
import { AdminNav } from "@/components/admin/admin-nav";
import { Logo } from "@/components/brand/logo";
import { requireAdmin } from "@/lib/auth/admin";

export const metadata: Metadata = {
  title: { default: "Painel", template: "%s | Painel Rufino Clinical" },
  robots: { index: false, follow: false },
};

export default async function AdminLayout({ children }: LayoutProps<"/admin">) {
  const { user } = await requireAdmin();
  return (
    <div data-admin-shell className="flex flex-1 flex-col lg:flex-row">
      <aside className="border-b border-line bg-white/60 lg:w-64 lg:shrink-0 lg:border-r lg:border-b-0">
        <div className="space-y-5 px-4 py-5 lg:sticky lg:top-0 lg:px-5 lg:py-8">
          <div className="flex items-center justify-between gap-3 lg:block">
            <Link href="/admin" aria-label="Painel, visão geral" className="inline-block rounded-md">
              <Logo className="h-7 w-auto" />
            </Link>
            <p className="min-w-0 truncate text-xs text-ink-muted lg:mt-3">{user.email}</p>
          </div>
          <AdminNav />
          <div className="flex gap-1 border-t border-line pt-3 lg:block lg:space-y-1 lg:pt-4">
            <Link
              href="/"
              className="flex h-10 items-center gap-3 rounded-full px-4 text-sm text-ink-muted hover:bg-blush"
            >
              <ArrowSquareOut size={18} aria-hidden="true" />
              Ver a loja
            </Link>
            <form action={signOut}>
              <button
                type="submit"
                className="flex h-10 w-full items-center gap-3 rounded-full px-4 text-sm text-ink-muted hover:bg-blush"
              >
                <SignOut size={18} aria-hidden="true" />
                Sair
              </button>
            </form>
          </div>
        </div>
      </aside>
      <div className="min-w-0 flex-1 px-4 py-8 lg:px-10 lg:py-10">{children}</div>
    </div>
  );
}
