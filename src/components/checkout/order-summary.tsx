import { formatBRL } from "@/lib/money";

// Same shape for a checkout quote (quote_order) and a saved order, straight from the database.
type Line = { product_name: string; variant_name: string; quantity: number; total_cents: number };
type Totals = {
  subtotal_cents: number;
  discount_cents: number;
  coupon_code: string | null;
  payment_discount_cents: number;
  /** null while no delivery address is chosen */
  shipping_cents: number | null;
  total_cents: number;
};

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex justify-between gap-4 text-ink-muted">
      <dt>{label}</dt>
      <dd className="tabular-nums">{value}</dd>
    </div>
  );
}

/** Items and amounts of a quote or an order. Amounts always come from the database. */
export function OrderSummary({ lines, totals }: { lines: Line[]; totals: Totals }) {
  const shipping = totals.shipping_cents;
  return (
    <div className="space-y-5">
      <ul className="divide-y divide-line">
        {lines.map((line) => (
          <li key={`${line.product_name}-${line.variant_name}`} className="flex justify-between gap-4 py-3 text-sm">
            <div className="min-w-0">
              <p className="font-semibold text-ink">{line.product_name}</p>
              <p className="text-ink-muted">
                {line.variant_name} · {line.quantity} {line.quantity === 1 ? "unidade" : "unidades"}
              </p>
            </div>
            <p className="font-semibold text-ink tabular-nums">{formatBRL(line.total_cents)}</p>
          </li>
        ))}
      </ul>
      <dl className="space-y-2 text-sm">
        <Row label="Subtotal" value={formatBRL(totals.subtotal_cents)} />
        {totals.discount_cents > 0 ? (
          <Row label={`Cupom ${totals.coupon_code ?? ""}`} value={`− ${formatBRL(totals.discount_cents)}`} />
        ) : null}
        {totals.payment_discount_cents > 0 ? (
          <Row label="Desconto no Pix" value={`− ${formatBRL(totals.payment_discount_cents)}`} />
        ) : null}
        <Row
          label="Frete"
          value={shipping === null ? "Escolha o endereço" : shipping === 0 ? "Grátis" : formatBRL(shipping)}
        />
        <div className="flex items-baseline justify-between border-t border-line pt-3 text-ink">
          <dt className="font-semibold">Total</dt>
          <dd className="text-xl font-semibold tabular-nums text-wine">{formatBRL(totals.total_cents)}</dd>
        </div>
      </dl>
    </div>
  );
}
