"use client";

import { Check, Copy } from "@phosphor-icons/react";
import { useRouter } from "next/navigation";
import { useEffect, useState, useTransition } from "react";

import { cancelOrder, generatePayment } from "@/app/actions/payments";
import { Button } from "@/components/ui/button";
import { FormAlert } from "@/components/ui/field";

const OFFLINE = "Sem conexão com a loja. Confira sua internet e tente de novo.";

/** Shows a Pix "copia e cola" or boleto line with a copy button. */
export function CopyCode({ code, label }: { code: string; label: string }) {
  const [copied, setCopied] = useState(false);

  async function copy() {
    try {
      await navigator.clipboard.writeText(code);
      setCopied(true);
      setTimeout(() => setCopied(false), 2500);
    } catch {
      // Clipboard blocked: the code stays selectable on screen.
    }
  }

  return (
    <div className="space-y-3">
      <p className="select-all break-all rounded-xl border border-line bg-white/70 px-4 py-3 font-mono text-xs leading-relaxed text-ink">
        {code}
      </p>
      <Button variant="secondary" onClick={copy}>
        {copied ? <Check size={18} weight="bold" aria-hidden="true" /> : <Copy size={18} aria-hidden="true" />}
        {copied ? "Copiado" : label}
      </Button>
      <span role="status" className="sr-only">
        {copied ? "Código copiado" : ""}
      </span>
    </div>
  );
}

/** Refreshes the page while a Pix is pending, so the confirmation shows up without a reload. */
export function AutoRefresh({ seconds }: { seconds: number }) {
  const router = useRouter();
  useEffect(() => {
    const timer = setInterval(() => {
      if (document.visibilityState === "visible") router.refresh();
    }, seconds * 1000);
    return () => clearInterval(timer);
  }, [router, seconds]);
  return null;
}

/** Generates the Pix code or boleto again when the gateway failed the first time. */
export function RetryPayment({ orderId, label }: { orderId: string; label: string }) {
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();
  return (
    <div className="space-y-4">
      <p className="text-sm text-ink-muted">Não conseguimos gerar o pagamento agora.</p>
      {error ? <FormAlert>{error}</FormAlert> : null}
      <Button
        disabled={pending}
        onClick={() =>
          start(async () => {
            const result = await generatePayment(orderId).catch(() => ({ error: OFFLINE }));
            setError(result.error ?? null);
          })
        }
      >
        {pending ? "Gerando..." : label}
      </Button>
    </div>
  );
}

export function CancelOrder({ orderId }: { orderId: string }) {
  const [confirming, setConfirming] = useState(false);
  const [pending, start] = useTransition();
  if (!confirming) {
    return (
      <Button variant="ghost" onClick={() => setConfirming(true)} className="text-ink-muted">
        Cancelar pedido
      </Button>
    );
  }
  return (
    <div className="flex flex-wrap items-center gap-2">
      <span className="text-sm text-ink">Cancelar este pedido?</span>
      <Button disabled={pending} onClick={() => start(() => cancelOrder(orderId).catch(() => setConfirming(false)))}>
        Sim, cancelar
      </Button>
      <Button variant="ghost" onClick={() => setConfirming(false)}>
        Voltar
      </Button>
    </div>
  );
}
