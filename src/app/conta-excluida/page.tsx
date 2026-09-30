import type { Metadata } from "next";

import { ButtonLink } from "@/components/ui/button";

export const metadata: Metadata = { title: "Conta excluída", robots: { index: false } };

export default function AccountDeletedPage() {
  return (
    <div className="container-page flex flex-1 flex-col items-start justify-center gap-5 py-20">
      <h1 className="text-3xl font-semibold tracking-tight text-ink">Sua conta foi excluída</h1>
      <p className="max-w-xl text-ink-muted">
        Apagamos seu cadastro, endereços e acesso. Os pedidos já feitos ficam guardados pelo prazo exigido por lei, sem
        ligação com a conta. Agradecemos por ter comprado com a gente.
      </p>
      <ButtonLink href="/">Voltar para a loja</ButtonLink>
    </div>
  );
}
