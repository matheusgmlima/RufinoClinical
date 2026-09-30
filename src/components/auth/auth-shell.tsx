import { LogoSymbol } from "@/components/brand/logo";

export function AuthShell({ title, lead, children }: { title: string; lead?: string; children: React.ReactNode }) {
  return (
    <div className="container-page grid flex-1 gap-12 py-12 lg:grid-cols-12 lg:py-16">
      <div className="lg:col-span-5 lg:col-start-2">
        <h1 className="text-3xl font-semibold tracking-tight text-ink md:text-4xl">{title}</h1>
        {lead ? <p className="mt-3 text-ink-muted">{lead}</p> : null}
        <div className="mt-8">{children}</div>
      </div>
      <div
        aria-hidden="true"
        className="relative hidden overflow-hidden rounded-[28px] bg-wine lg:col-span-5 lg:col-start-8 lg:block"
      >
        <LogoSymbol className="absolute -bottom-10 -right-10 h-[90%] w-auto text-cream/[0.08]" />
        <div className="absolute -left-16 top-1/3 h-12 w-3/4 -rotate-12 rounded-full bg-nude/80" />
      </div>
    </div>
  );
}
