"use client";

import { useState, useTransition, type FormEvent } from "react";

import { advanceOrder, refundOrder, saveOrderNotes, type ActionResult } from "@/app/actions/admin/orders";
import { Button } from "@/components/ui/button";
import { Field, FormAlert, Input, inputClass } from "@/components/ui/field";
import type { Enums } from "@/lib/supabase/database.types";

type Props = {
  orderId: string;
  status: Enums<"order_status">;
  shippingMethod: Enums<"shipping_method">;
  notes: string | null;
  refundable: boolean;
  total: string;
};

const OFFLINE: ActionResult = { error: "Sem conexão com a loja. Confira a internet e tente de novo." };

/** Next fulfilment step, cancel (unpaid only), refund (paid) and internal notes for one order. */
export function OrderActions({ orderId, status, shippingMethod, notes, refundable, total }: Props) {
  const [pending, start] = useTransition();
  const [result, setResult] = useState<ActionResult>({});
  const [confirming, setConfirming] = useState<"cancel" | "refund" | null>(null);

  function run(action: () => Promise<ActionResult>) {
    setResult({});
    start(async () => {
      setResult(await action().catch(() => OFFLINE));
      setConfirming(null);
    });
  }

  function ship(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const code = String(new FormData(event.currentTarget).get("tracking") ?? "");
    run(() => advanceOrder(orderId, { to: "shipped", tracking: code }));
  }

  function save(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const text = String(new FormData(event.currentTarget).get("notes") ?? "");
    run(() => saveOrderNotes(orderId, text));
  }

  return (
    <div className="grid gap-6">
      {result.error ? <FormAlert>{result.error}</FormAlert> : null}
      {result.notice ? <FormAlert tone="success">{result.notice}</FormAlert> : null}

      {status === "paid" ? (
        <Button onClick={() => run(() => advanceOrder(orderId, { to: "preparing" }))} disabled={pending}>
          Iniciar separação
        </Button>
      ) : null}
      {status === "preparing" && shippingMethod !== "standard" ? (
        <Button onClick={() => run(() => advanceOrder(orderId, { to: "shipped" }))} disabled={pending}>
          {shippingMethod === "local" ? "Saiu para entrega" : "Pronto para retirada"}
        </Button>
      ) : null}
      {status === "preparing" && shippingMethod === "standard" ? (
        <form onSubmit={ship} className="grid gap-3">
          <Field id="tracking" label="Código de rastreio">
            <Input id="tracking" required maxLength={40} autoComplete="off" className="uppercase" />
          </Field>
          <Button type="submit" disabled={pending}>
            Marcar como enviado
          </Button>
        </form>
      ) : null}
      {status === "shipped" ? (
        <Button onClick={() => run(() => advanceOrder(orderId, { to: "delivered" }))} disabled={pending}>
          {shippingMethod === "pickup" ? "Marcar como retirado" : "Marcar como entregue"}
        </Button>
      ) : null}

      {status === "pending_payment" || refundable ? (
        confirming ? (
          <div className="grid gap-3 rounded-2xl bg-wine/5 p-4">
            <p className="text-sm text-ink">
              {confirming === "cancel"
                ? "Cancelar este pedido? O estoque volta e o Pix ou boleto em aberto é anulado."
                : `Reembolsar ${total} ao cliente? Isso não pode ser desfeito.`}
            </p>
            <div className="flex flex-wrap gap-2">
              <Button
                disabled={pending}
                onClick={() =>
                  run(() =>
                    confirming === "cancel" ? advanceOrder(orderId, { to: "canceled" }) : refundOrder(orderId),
                  )
                }
              >
                {pending ? "Aguarde..." : confirming === "cancel" ? "Sim, cancelar" : "Sim, reembolsar"}
              </Button>
              <Button variant="ghost" onClick={() => setConfirming(null)} disabled={pending}>
                Voltar
              </Button>
            </div>
          </div>
        ) : (
          <Button variant="secondary" onClick={() => setConfirming(refundable ? "refund" : "cancel")}>
            {refundable ? "Reembolsar pedido" : "Cancelar pedido"}
          </Button>
        )
      ) : null}

      <form onSubmit={save} className="grid gap-3 border-t border-line pt-5">
        <Field id="notes" label="Observações internas" hint="Só a equipe vê.">
          <textarea
            id="notes"
            name="notes"
            defaultValue={notes ?? ""}
            maxLength={500}
            rows={3}
            aria-describedby="notes-hint"
            className={`${inputClass} h-auto py-3`}
          />
        </Field>
        <Button type="submit" variant="secondary" disabled={pending}>
          Salvar observações
        </Button>
      </form>
    </div>
  );
}
