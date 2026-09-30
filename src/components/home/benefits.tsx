import { CreditCard, PixLogo, ShieldCheck, Truck } from "@phosphor-icons/react/ssr";

import type { StoreSettings } from "@/lib/catalog/queries";
import { cardClaim } from "@/lib/money";

export function Benefits({ settings }: { settings: StoreSettings }) {
  const card = cardClaim(settings) ?? "cartão de crédito";
  const items = [
    { icon: PixLogo, title: `${settings.pixDiscountPercent}% off no Pix`, text: "Desconto aplicado no pagamento." },
    { icon: CreditCard, title: card[0].toUpperCase() + card.slice(1), text: "No cartão de crédito." },
    { icon: Truck, title: "Envio para todo o Brasil", text: "Frete calculado pelo CEP." },
    { icon: ShieldCheck, title: "Compra segura", text: "Dados protegidos e criptografados." },
  ];
  return (
    <section aria-label="Vantagens" className="border-y border-line">
      <ul className="container-page grid grid-cols-2 gap-x-6 gap-y-8 py-10 lg:grid-cols-4">
        {items.map(({ icon: Icon, title, text }) => (
          <li key={title} className="flex items-start gap-3">
            <Icon size={26} className="mt-0.5 shrink-0 text-wine" aria-hidden="true" />
            <div>
              <p className="text-sm font-semibold text-ink">{title}</p>
              <p className="mt-0.5 text-sm text-ink-muted">{text}</p>
            </div>
          </li>
        ))}
      </ul>
    </section>
  );
}
