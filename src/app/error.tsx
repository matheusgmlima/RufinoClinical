"use client";

import { LogoSymbol } from "@/components/brand/logo";
import { Button, ButtonLink } from "@/components/ui/button";

// Shown when a page fails to render (for example, the catalog is briefly unreachable).
// Error details stay on the server; the digest lets us find them in the logs.
export default function ErrorPage({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return (
    <div className="container-page flex flex-1 flex-col items-center justify-center gap-6 py-24 text-center">
      <LogoSymbol className="h-20 w-auto text-wine/15" />
      <div className="space-y-2">
        <h1 className="text-3xl font-semibold tracking-tight text-ink">Não foi possível carregar esta página</h1>
        <p className="text-ink-muted">Tente de novo em alguns instantes. Seu carrinho continua salvo.</p>
        {error.digest ? <p className="text-xs text-ink-muted">Código do erro: {error.digest}</p> : null}
      </div>
      <div className="flex flex-wrap justify-center gap-3">
        <Button onClick={reset}>Tentar de novo</Button>
        <ButtonLink href="/" variant="secondary">
          Voltar ao início
        </ButtonLink>
      </div>
    </div>
  );
}
