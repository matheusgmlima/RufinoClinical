"use client";

import { unstable_rethrow } from "next/navigation";
import { useState, useTransition } from "react";

import { Button } from "@/components/ui/button";
import { FormAlert } from "@/components/ui/field";
import type { FormState } from "@/lib/forms";

/** Delete button with a confirmation step. The action may redirect when it succeeds. */
export function ConfirmDelete({
  label,
  question,
  action,
}: {
  label: string;
  question: string;
  action: () => Promise<FormState>;
}) {
  const [pending, start] = useTransition();
  const [confirming, setConfirming] = useState(false);
  const [error, setError] = useState<string>();

  function run() {
    setError(undefined);
    start(async () => {
      try {
        const result = await action();
        if (result.status === "error") setError(result.message);
      } catch (err) {
        unstable_rethrow(err);
        setError("Sem conexão com a loja. Tente de novo.");
      }
      setConfirming(false);
    });
  }

  return (
    <div className="grid gap-3">
      {error ? <FormAlert>{error}</FormAlert> : null}
      {confirming ? (
        <div className="grid gap-3 rounded-2xl bg-wine/5 p-4">
          <p className="text-sm text-ink">{question}</p>
          <div className="flex flex-wrap gap-2">
            <Button onClick={run} disabled={pending}>
              {pending ? "Excluindo..." : "Sim, excluir"}
            </Button>
            <Button variant="ghost" onClick={() => setConfirming(false)} disabled={pending}>
              Voltar
            </Button>
          </div>
        </div>
      ) : (
        <Button variant="ghost" onClick={() => setConfirming(true)} className="justify-self-start text-wine">
          {label}
        </Button>
      )}
    </div>
  );
}
