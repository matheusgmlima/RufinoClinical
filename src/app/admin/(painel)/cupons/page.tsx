import type { Metadata } from "next";

import { deleteCoupon } from "@/app/actions/admin/coupons";
import { ConfirmDelete } from "@/components/admin/confirm-delete";
import { CouponForm } from "@/components/admin/coupon-form";
import { AdminHeader, Panel } from "@/components/admin/ui";
import { requireAdmin } from "@/lib/auth/admin";
import { formatDayMonth } from "@/lib/dates";
import { formatBRL } from "@/lib/money";

export const metadata: Metadata = { title: "Cupons" };

type Coupon = {
  discount_type: "percent" | "fixed";
  discount_value: number;
  starts_at: string | null;
  ends_at: string | null;
  max_redemptions: number | null;
  redemptions_count: number;
  is_active: boolean;
};

/** Whether the checkout accepts the coupon right now, and why not. */
function couponState(coupon: Coupon, now = Date.now()): { label: string; tone: string } {
  const ended = "bg-line text-ink";
  if (!coupon.is_active) return { label: "Inativo", tone: ended };
  if (coupon.starts_at && Date.parse(coupon.starts_at) > now) return { label: "Agendado", tone: "bg-mist text-mist-ink" };
  if (coupon.ends_at && Date.parse(coupon.ends_at) <= now) return { label: "Encerrado", tone: ended };
  if (coupon.max_redemptions !== null && coupon.redemptions_count >= coupon.max_redemptions) {
    return { label: "Esgotado", tone: ended };
  }
  return { label: "Valendo", tone: "bg-sage text-sage-ink" };
}

export default async function AdminCouponsPage() {
  const { supabase } = await requireAdmin();
  const { data: coupons } = await supabase
    .from("coupons")
    .select(
      "id, code, discount_type, discount_value, min_subtotal_cents, starts_at, ends_at, max_redemptions, redemptions_count, is_active",
    )
    .order("created_at", { ascending: false });

  return (
    <>
      <AdminHeader title="Cupons" lead="O desconto vale sobre os produtos, antes do frete e do desconto do Pix." />
      <div className="grid grid-cols-1 gap-6 xl:grid-cols-5">
        <div className="xl:col-span-3">
          {coupons?.length ? (
            <ul className="grid gap-4">
              {coupons.map(({ redemptions_count, ...coupon }) => {
                const state = couponState({ ...coupon, redemptions_count });
                return (
                  <li key={coupon.id} className="surface p-5">
                    <div className="flex flex-wrap items-start justify-between gap-3">
                      <div className="min-w-0">
                        <h2 className="font-semibold tracking-wide">{coupon.code}</h2>
                        <p className="text-sm text-ink-muted">
                          {coupon.discount_type === "percent"
                            ? `${coupon.discount_value}% de desconto`
                            : `${formatBRL(coupon.discount_value)} de desconto`}
                          {coupon.min_subtotal_cents ? ` · pedido mínimo ${formatBRL(coupon.min_subtotal_cents)}` : ""}
                        </p>
                        <p className="text-xs text-ink-muted">
                          {redemptions_count} {redemptions_count === 1 ? "uso" : "usos"}
                          {coupon.max_redemptions ? ` de ${coupon.max_redemptions}` : ""}
                          {coupon.starts_at ? ` · de ${formatDayMonth(coupon.starts_at)}` : ""}
                          {coupon.ends_at ? ` · até ${formatDayMonth(new Date(Date.parse(coupon.ends_at) - 1))}` : ""}
                        </p>
                      </div>
                      <span
                        className={`inline-flex rounded-full px-3 py-1 text-xs font-semibold ${state.tone}`}
                      >
                        {state.label}
                      </span>
                    </div>
                    <details className="mt-3 border-t border-line pt-3">
                      <summary className="cursor-pointer text-sm font-semibold text-wine">Editar cupom</summary>
                      <div className="grid gap-5 pt-4">
                        <CouponForm coupon={coupon} />
                        {redemptions_count === 0 ? (
                          <ConfirmDelete
                            label="Excluir cupom"
                            question={`Excluir o cupom ${coupon.code}?`}
                            action={deleteCoupon.bind(null, coupon.id)}
                          />
                        ) : (
                          <p className="text-xs text-ink-muted">
                            Cupom já usado: fica guardado no histórico. Para encerrar, desmarque “Ativo”.
                          </p>
                        )}
                      </div>
                    </details>
                  </li>
                );
              })}
            </ul>
          ) : (
            <p className="surface p-8 text-center text-ink-muted">
              Nenhum cupom ainda.
            </p>
          )}
        </div>
        <div className="xl:col-span-2">
          <Panel title="Novo cupom">
            <CouponForm />
          </Panel>
        </div>
      </div>
    </>
  );
}
