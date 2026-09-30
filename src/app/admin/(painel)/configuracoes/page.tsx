import type { Metadata } from "next";

import { DeliveryForm, SettingsForm, ShippingForm } from "@/components/admin/settings-forms";
import { AdminHeader, Panel } from "@/components/admin/ui";
import { requireAdmin } from "@/lib/auth/admin";
import { formatDateTime } from "@/lib/dates";

export const metadata: Metadata = { title: "Configurações" };

export default async function AdminSettingsPage() {
  const { supabase } = await requireAdmin();
  const [{ data: settings }, { data: rates }] = await Promise.all([
    supabase
      .from("store_settings")
      .select(
        `pix_discount_percent, max_installments, interest_free_installments, min_installment_cents,
         free_shipping_threshold_cents, origin_zip, local_delivery_enabled, local_delivery_radius_km,
         local_delivery_price_cents, local_delivery_cutoff, pickup_enabled, pickup_address, pickup_hours, updated_at`,
      )
      .single(),
    supabase.from("shipping_rates").select("region, price_cents, min_days, max_days"),
  ]);

  return (
    <>
      <AdminHeader
        title="Configurações"
        lead="Regras que o banco usa ao calcular cada pedido. Mudanças valem na hora para os próximos pedidos."
      />
      <div className="grid grid-cols-1 gap-6 xl:grid-cols-2">
        <Panel title="Pagamento e frete grátis">
          {settings ? (
            <>
              <p className="mb-5 text-xs text-ink-muted">Atualizado em {formatDateTime(settings.updated_at)}</p>
              <SettingsForm settings={settings} />
            </>
          ) : (
            <p className="text-sm text-ink-muted">Não foi possível carregar as configurações.</p>
          )}
        </Panel>
        <Panel title="Frete por região">
          <p className="mb-5 text-sm text-ink-muted">Preço fixo e prazo de entrega mostrados no checkout, por região do CEP.</p>
          <ShippingForm rates={rates ?? []} />
        </Panel>
        <Panel title="Entrega local e retirada">
          {settings ? (
            <DeliveryForm delivery={{ ...settings, local_delivery_radius_km: Number(settings.local_delivery_radius_km) }} />
          ) : (
            <p className="text-sm text-ink-muted">Não foi possível carregar as configurações.</p>
          )}
        </Panel>
      </div>
    </>
  );
}
