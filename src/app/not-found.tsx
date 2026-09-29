import { LogoSymbol } from "@/components/brand/logo";
import { ButtonLink } from "@/components/ui/button";

export default function NotFound() {
  return (
    <div className="container-page flex flex-1 flex-col items-center justify-center gap-6 py-24 text-center">
      <LogoSymbol className="h-20 w-auto text-wine/15" />
      <div className="space-y-2">
        <h1 className="text-3xl font-semibold tracking-tight text-ink">Página não encontrada</h1>
        <p className="text-ink-muted">O link pode estar desatualizado ou o produto saiu do catálogo.</p>
      </div>
      <ButtonLink href="/produtos">Ver produtos</ButtonLink>
    </div>
  );
}
