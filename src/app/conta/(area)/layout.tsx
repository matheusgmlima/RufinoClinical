import { SignOut } from "@phosphor-icons/react/ssr";

import { AccountNav } from "@/components/account/account-nav";
import { signOut } from "@/app/actions/auth";
import { requireUser } from "@/lib/auth/session";
import { createClient } from "@/lib/supabase/server";

export default async function AccountLayout({ children }: LayoutProps<"/conta">) {
  const user = await requireUser("/conta");
  const supabase = await createClient();
  const { data: profile } = await supabase.from("profiles").select("full_name").eq("id", user.id).maybeSingle();
  const firstName = profile?.full_name?.split(" ")[0] ?? "";

  return (
    <div className="container-page grid flex-1 gap-8 py-10 lg:grid-cols-12 lg:gap-12 lg:py-16">
      <aside className="space-y-6 lg:col-span-3">
        <div>
          <p className="text-sm text-ink-muted">Minha conta</p>
          <p className="mt-1 truncate text-xl font-semibold text-ink">{firstName ? `Olá, ${firstName}` : user.email}</p>
        </div>
        <AccountNav />
        <form action={signOut} className="hidden lg:block">
          <button
            type="submit"
            className="inline-flex h-10 items-center gap-2 rounded-full px-5 text-sm font-medium text-ink-muted hover:bg-blush hover:text-wine"
          >
            <SignOut size={18} aria-hidden="true" />
            Sair
          </button>
        </form>
      </aside>
      <div className="min-w-0 lg:col-span-9">
        {children}
        <form action={signOut} className="mt-12 border-t border-line pt-6 lg:hidden">
          <button type="submit" className="inline-flex items-center gap-2 text-sm font-medium text-ink-muted">
            <SignOut size={18} aria-hidden="true" />
            Sair da conta
          </button>
        </form>
      </div>
    </div>
  );
}
