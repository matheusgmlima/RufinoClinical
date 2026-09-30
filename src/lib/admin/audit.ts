import { formatDateTime } from "@/lib/dates";
import { formatBRL } from "@/lib/money";
import { ORDER_STATUS_LABEL, PAYMENT_METHOD_LABEL } from "@/lib/orders/status";
import { SHIPPING_METHOD_LABEL } from "@/lib/shipping/options";
import { REGION_LABEL } from "@/lib/shipping/regions";

// Turns audit_log rows (full old/new row snapshots written by private.audit_row) into what changed,
// in words the team understands.

type Data = Record<string, unknown> | null;

export const AUDIT_TABLES = {
  orders: "Pedidos",
  order_notes: "Observações",
  products: "Produtos",
  product_variants: "Variantes",
  product_images: "Fotos",
  categories: "Categorias",
  coupons: "Cupons",
  store_settings: "Configurações",
  shipping_rates: "Frete",
} as const;
export type AuditTable = keyof typeof AUDIT_TABLES;

const ENTITY: Record<string, string> = {
  orders: "pedido",
  order_notes: "observação do pedido",
  products: "produto",
  product_variants: "variante",
  product_images: "foto",
  categories: "categoria",
  coupons: "cupom",
  store_settings: "configurações",
  shipping_rates: "frete",
};

const FIELD: Record<string, string> = {
  name: "Nome",
  slug: "Endereço",
  status: "Status",
  notes: "Observações",
  is_active: "Ativo",
  is_featured: "Destaque",
  position: "Ordem",
  price_cents: "Preço",
  compare_at_price_cents: "Preço “de”",
  stock_quantity: "Estoque",
  sku: "SKU",
  alt: "Descrição da foto",
  code: "Código",
  discount_value: "Desconto",
  discount_type: "Tipo de desconto",
  min_subtotal_cents: "Pedido mínimo",
  max_redemptions: "Limite de usos",
  redemptions_count: "Usos",
  starts_at: "Início",
  ends_at: "Fim",
  pix_discount_percent: "Desconto no Pix (%)",
  max_installments: "Máximo de parcelas",
  interest_free_installments: "Parcelas sem juros",
  min_installment_cents: "Parcela mínima",
  free_shipping_threshold_cents: "Frete grátis a partir de",
  origin_zip: "CEP do estoque",
  local_delivery_enabled: "Entrega no mesmo dia",
  local_delivery_radius_km: "Raio da entrega (km)",
  local_delivery_price_cents: "Preço da entrega local",
  local_delivery_cutoff: "Entrega local: pago até",
  pickup_enabled: "Retirada na loja",
  pickup_address: "Endereço de retirada",
  pickup_hours: "Horário de retirada",
  shipping_method: "Entrega",
  min_days: "Prazo mínimo",
  max_days: "Prazo máximo",
  shipping_tracking_code: "Rastreio",
  description: "Descrição",
  short_description: "Resumo",
  category_id: "Categoria",
  variant_id: "Variante",
  payment_method: "Pagamento",
};

// Noise: timestamps that move with every write and values already shown elsewhere.
const IGNORED = new Set(["updated_at", "created_at", "id"]);

export function entityLabel(table: string) {
  return ENTITY[table] ?? table;
}

export function fieldLabel(field: string) {
  return FIELD[field] ?? field;
}

const ISO_TIMESTAMP = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}/;

// Enum columns shown with the labels used across the panel.
const ENUM_LABEL: Record<string, Record<string, string>> = {
  status: ORDER_STATUS_LABEL,
  payment_method: PAYMENT_METHOD_LABEL,
  shipping_method: SHIPPING_METHOD_LABEL,
  discount_type: { percent: "Porcentagem", fixed: "Valor fixo" },
};

/** A column value as text: money in reais, yes/no, dates in São Paulo time. */
export function formatValue(field: string, value: unknown): string {
  if (value === null || value === undefined || value === "") return "—";
  if (typeof value === "string" && ENUM_LABEL[field]?.[value]) return ENUM_LABEL[field][value];
  if (typeof value === "boolean") return value ? "Sim" : "Não";
  if (typeof value === "number" && field.endsWith("_cents")) return formatBRL(value);
  if (typeof value === "string" && ISO_TIMESTAMP.test(value)) return formatDateTime(value);
  const text = typeof value === "object" ? JSON.stringify(value) : String(value);
  return text.length > 120 ? `${text.slice(0, 117)}...` : text;
}

export type Change = { field: string; before: string; after: string };

/** Fields that differ between two snapshots (an UPDATE), skipping timestamps. */
export function auditChanges(before: Data, after: Data): Change[] {
  if (!before || !after) return [];
  const fields = new Set([...Object.keys(before), ...Object.keys(after)]);
  return [...fields]
    .filter((field) => !IGNORED.has(field) && JSON.stringify(before[field]) !== JSON.stringify(after[field]))
    .map((field) => ({ field, before: formatValue(field, before[field]), after: formatValue(field, after[field]) }));
}

/** Short name of the row: product name, "#1034", coupon code, region... */
export function auditSubject(table: string, before: Data, after: Data): string | null {
  const row = after ?? before;
  if (!row) return null;
  if (table === "orders" && row.number) return `#${row.number}`;
  if (table === "shipping_rates" && typeof row.region === "string") {
    return REGION_LABEL[row.region as keyof typeof REGION_LABEL] ?? row.region;
  }
  for (const key of ["name", "code", "sku", "region", "alt"]) {
    if (typeof row[key] === "string" && row[key]) return String(row[key]);
  }
  return null;
}

/** Admin page where the row can be seen, when there is one. */
export function auditHref(table: string, rowId: string | null, before: Data, after: Data): string | null {
  const row = after ?? before;
  switch (table) {
    case "orders":
      return rowId ? `/admin/pedidos/${rowId}` : null;
    case "order_notes":
      return typeof row?.order_id === "string" ? `/admin/pedidos/${row.order_id}` : null;
    case "products":
      return rowId && after ? `/admin/produtos/${rowId}` : null;
    case "product_variants":
    case "product_images":
      return typeof row?.product_id === "string" ? `/admin/produtos/${row.product_id}` : null;
    case "categories":
      return "/admin/categorias";
    case "coupons":
      return "/admin/cupons";
    case "store_settings":
    case "shipping_rates":
      return "/admin/configuracoes";
    default:
      return null;
  }
}
