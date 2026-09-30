import { Plus } from "@phosphor-icons/react/ssr";

import type { StoreSettings } from "@/lib/catalog/queries";

// "Sem juros" only up to the installments whose interest the store pays (see CardTerms).
function cardTerms({ maxInstallments: max, interestFreeInstallments: free }: StoreSettings) {
  if (max <= 1) return "cartão de crédito";
  if (free <= 1) return `cartão de crédito em até ${max}x`;
  return `cartão de crédito em até ${max}x${free < max ? ` (até ${free}x sem juros)` : " sem juros"}`;
}

export function Faq({ settings }: { settings: StoreSettings }) {
  const items = [
    {
      q: "Quais formas de pagamento vocês aceitam?",
      a: `Pix com ${settings.pixDiscountPercent}% de desconto, ${cardTerms(settings)} e boleto.`,
    },
    {
      q: "Qual é o prazo de entrega?",
      a: "O frete e o prazo são calculados a partir do seu CEP antes do pagamento. Enviamos para todo o Brasil.",
    },
    {
      q: "Posso desistir da compra?",
      a: "Sim. Você pode desistir em até 7 dias após o recebimento, conforme o Código de Defesa do Consumidor.",
    },
    {
      q: "Preciso de prescrição para comprar?",
      a: "Não. Mesmo assim, recomendamos usar os produtos com orientação de um fisioterapeuta ou médico, principalmente no pós-operatório.",
    },
    {
      q: "Clínicas e profissionais podem comprar?",
      a: "Sim. Profissionais e clínicas compram pelo mesmo site, com os mesmos preços.",
    },
  ];

  return (
    <section id="duvidas" className="container-page scroll-mt-24 py-14 lg:py-28">
      <div className="grid gap-6 lg:grid-cols-12 lg:gap-10">
        <h2 className="text-3xl font-semibold tracking-tight text-ink md:text-4xl lg:col-span-4">Dúvidas frequentes</h2>
        <div className="divide-y divide-line border-y border-line lg:col-span-8">
          {items.map(({ q, a }) => (
            <details key={q} className="group py-2">
              <summary className="flex cursor-pointer items-center justify-between gap-6 rounded-xl py-4 text-base font-semibold text-ink hover:text-wine">
                {q}
                <Plus size={18} weight="bold" className="shrink-0 transition group-open:rotate-45" aria-hidden="true" />
              </summary>
              <p className="max-w-2xl pb-5 text-ink-muted leading-relaxed">{a}</p>
            </details>
          ))}
        </div>
      </div>
    </section>
  );
}
