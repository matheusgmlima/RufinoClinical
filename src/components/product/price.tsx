import type { StoreSettings } from "@/lib/catalog/queries";
import { formatBRL, installmentPlan, pixPriceCents } from "@/lib/money";

type Props = {
  priceCents: number;
  compareAtPriceCents: number | null;
  settings: StoreSettings;
  size?: "sm" | "lg";
  prefix?: string;
};

export function Price({ priceCents, compareAtPriceCents, settings, size = "sm", prefix }: Props) {
  const pix = pixPriceCents(priceCents, settings.pixDiscountPercent);
  const plan = installmentPlan(priceCents, settings.maxInstallments, settings.minInstallmentCents);
  const large = size === "lg";

  return (
    <div className={large ? "space-y-1.5" : "space-y-0.5"}>
      <p className="flex flex-wrap items-baseline gap-x-2">
        {compareAtPriceCents ? (
          <s className={`text-ink-muted ${large ? "text-base" : "text-xs"}`}>{formatBRL(compareAtPriceCents)}</s>
        ) : null}
        <span className={`font-semibold tracking-tight text-ink tabular-nums ${large ? "text-3xl" : "text-base"}`}>
          {prefix ? <span className="mr-1 text-sm font-medium text-ink-muted">{prefix}</span> : null}
          {formatBRL(priceCents)}
        </span>
      </p>
      {plan.count > 1 ? (
        <p className={`text-ink-muted ${large ? "text-sm" : "text-xs"}`}>
          ou {plan.count}x de {formatBRL(plan.amountCents)} sem juros
        </p>
      ) : null}
      {settings.pixDiscountPercent > 0 ? (
        <p className={`font-semibold text-wine tabular-nums ${large ? "text-base" : "text-xs"}`}>
          {formatBRL(pix)} no Pix
          <span className="font-medium text-ink-muted"> ({settings.pixDiscountPercent}% off)</span>
        </p>
      ) : null}
    </div>
  );
}
