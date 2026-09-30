"use client";

import { useRouter } from "next/navigation";
import Script from "next/script";
import { useEffect, useState } from "react";

import { payWithCard } from "@/app/actions/payments";
import { FormAlert } from "@/components/ui/field";

type Brick = { unmount: () => void };
type MercadoPagoSdk = new (
  publicKey: string,
  options: { locale: string },
) => {
  bricks: () => { create: (brick: "cardPayment", containerId: string, settings: object) => Promise<Brick> };
};
declare global {
  interface Window {
    MercadoPago?: MercadoPagoSdk;
  }
}

type Props = {
  orderId: string;
  /** Why the previous card was declined, shown until the next attempt. */
  lastDecline: string | null;
  amountCents: number;
  email: string;
  document: string;
  maxInstallments: number;
  publicKey: string;
};

// Brand tokens from DESIGN.md applied to the Mercado Pago form.
const STYLE = {
  theme: "default",
  customVariables: {
    baseColor: "#6e0b1e",
    baseColorFirstVariant: "#3f0611",
    baseColorSecondVariant: "#e2bba9",
    textPrimaryColor: "#1f1a1b",
    textSecondaryColor: "#6f615f",
    outlinePrimaryColor: "#e8ddd8",
    formBackgroundColor: "#fbf7f4",
    inputBackgroundColor: "#ffffff",
    buttonTextColor: "#fbf7f4",
    borderRadiusMedium: "12px",
    borderRadiusLarge: "16px",
    borderRadiusFull: "9999px",
  },
};

const LOAD_ERROR = "O formulário do cartão não carregou. Atualize a página ou faça um novo pedido com Pix.";

/**
 * Mercado Pago Card Payment Brick. The card is typed into Mercado Pago iframes and turned into
 * a single-use token: this page and our server only ever see the token.
 */
export function CardPayment({ orderId, lastDecline, amountCents, email, document, maxInstallments, publicKey }: Props) {
  const router = useRouter();
  const [sdkReady, setSdkReady] = useState(false);
  const [formReady, setFormReady] = useState(false);
  const [message, setMessage] = useState(lastDecline);

  // A blocked script or a gateway outage must not leave an empty box behind.
  useEffect(() => {
    if (formReady) return;
    const timer = setTimeout(() => setMessage(LOAD_ERROR), 20_000);
    return () => clearTimeout(timer);
  }, [formReady]);

  useEffect(() => {
    if (!sdkReady || !window.MercadoPago) return;
    let brick: Brick | undefined;
    let active = true;
    new window.MercadoPago(publicKey, { locale: "pt-BR" })
      .bricks()
      .create("cardPayment", "card-payment", {
        initialization: {
          amount: amountCents / 100,
          payer: { email, identification: { type: document.length === 14 ? "CNPJ" : "CPF", number: document } },
        },
        customization: {
          paymentMethods: { maxInstallments, types: { included: ["credit_card"] } },
          visual: { hideFormTitle: true, style: STYLE },
        },
        callbacks: {
          onReady: () => setFormReady(true),
          onError: (error: { type?: string }) => {
            if (error.type === "critical") setMessage(LOAD_ERROR);
          },
          onSubmit: async (card: unknown) => {
            setMessage(null);
            const result = await payWithCard(orderId, card).catch(() => ({
              approved: false,
              message: "Sem conexão com a loja. Confira sua internet antes de tentar de novo.",
            }));
            if (result.approved) router.refresh();
            else setMessage(result.message ?? null);
          },
        },
      })
      .then((created) => (active ? (brick = created) : created.unmount()))
      .catch(() => setMessage(LOAD_ERROR));
    return () => {
      active = false;
      brick?.unmount();
    };
  }, [sdkReady, orderId, amountCents, email, document, maxInstallments, publicKey, router]);

  return (
    <div className="space-y-4">
      <Script src="https://sdk.mercadopago.com/js/v2" onReady={() => setSdkReady(true)} />
      {message ? <FormAlert>{message}</FormAlert> : null}
      {!formReady && !message ? (
        <p role="status" className="text-sm text-ink-muted">
          Carregando o formulário seguro do Mercado Pago...
        </p>
      ) : null}
      <div id="card-payment" className="min-h-80" />
    </div>
  );
}
