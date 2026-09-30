import { MagnifyingGlass, Plus } from "@phosphor-icons/react/ssr";
import type { Metadata } from "next";
import Form from "next/form";
import Image from "next/image";
import Link from "next/link";

import { ActiveBadge, AdminHeader } from "@/components/admin/ui";
import { buttonClass, ButtonLink } from "@/components/ui/button";
import { inputClass } from "@/components/ui/field";
import { requireAdmin } from "@/lib/auth/admin";
import { productImageUrl } from "@/lib/catalog/images";
import { formatBRL } from "@/lib/money";

export const metadata: Metadata = { title: "Produtos" };

const PAGE_SIZE = 30;
const LOW_STOCK = 5;
const FILTERS = { loja: "Na loja", rascunho: "Rascunhos" } as const;
type Filter = keyof typeof FILTERS;

function href({ filtro, q, pagina }: { filtro?: Filter; q?: string; pagina?: number }) {
  const params = new URLSearchParams();
  if (filtro) params.set("filtro", filtro);
  if (q) params.set("q", q);
  if (pagina && pagina > 1) params.set("pagina", String(pagina));
  const query = params.toString();
  return query ? `/admin/produtos?${query}` : "/admin/produtos";
}

export default async function AdminProductsPage({ searchParams }: PageProps<"/admin/produtos">) {
  const { supabase } = await requireAdmin();
  const params = await searchParams;
  const filtro = (Object.keys(FILTERS) as Filter[]).find((key) => key === params.filtro);
  // Only letters, digits and spaces reach the PostgREST filter below.
  const q =
    typeof params.q === "string"
      ? params.q
          .replace(/[^\p{L}\p{N} -]/gu, "")
          .trim()
          .slice(0, 80)
      : "";
  const page = Math.min(Math.max(1, Number(params.pagina) || 1), 500);

  let query = supabase
    .from("products")
    .select(
      `id, name, is_active, is_featured, category:categories(name),
       variants:product_variants(price_cents, stock_quantity, is_active),
       images:product_images(storage_path, position)`,
      { count: "exact" },
    )
    .order("position")
    .order("name")
    .range((page - 1) * PAGE_SIZE, page * PAGE_SIZE - 1);
  if (filtro) query = query.eq("is_active", filtro === "loja");
  if (q) query = query.or(`name.ilike."%${q}%",brand.ilike."%${q}%",slug.ilike."%${q}%"`);
  const { data: products, count } = await query;
  const pages = Math.max(1, Math.ceil((count ?? 0) / PAGE_SIZE));

  return (
    <>
      <AdminHeader
        title="Produtos"
        lead={`${count ?? 0} ${count === 1 ? "produto" : "produtos"}`}
        action={
          <ButtonLink href="/admin/produtos/novo">
            <Plus size={18} aria-hidden="true" />
            Novo produto
          </ButtonLink>
        }
      />

      <nav aria-label="Filtrar produtos" className="mb-4">
        <ul className="flex flex-wrap gap-2">
          {([undefined, ...Object.keys(FILTERS)] as (Filter | undefined)[]).map((value) => (
            <li key={value ?? "all"}>
              <Link
                href={href({ filtro: value, q })}
                aria-current={value === filtro ? "page" : undefined}
                className={`inline-flex h-9 items-center whitespace-nowrap rounded-full px-4 text-sm font-medium ${
                  value === filtro ? "bg-wine text-cream" : "border border-line bg-white text-ink hover:border-wine/40"
                }`}
              >
                {value ? FILTERS[value] : "Todos"}
              </Link>
            </li>
          ))}
        </ul>
      </nav>

      <Form action="/admin/produtos" className="mb-6 flex max-w-xl gap-2" role="search">
        {filtro ? <input type="hidden" name="filtro" value={filtro} /> : null}
        <label htmlFor="q" className="sr-only">
          Buscar por nome ou marca
        </label>
        <input id="q" name="q" type="search" defaultValue={q} placeholder="Nome ou marca" className={inputClass} />
        <button type="submit" className={buttonClass({ variant: "secondary", className: "h-12 shrink-0" })}>
          <MagnifyingGlass size={18} aria-hidden="true" />
          Buscar
        </button>
      </Form>

      {products?.length ? (
        <ul className="divide-y divide-line surface px-5">
          {products.map((product) => {
            const cover = product.images.toSorted((a, b) => a.position - b.position)[0];
            const active = product.variants.filter((variant) => variant.is_active);
            const prices = active.map((variant) => variant.price_cents);
            const stock = active.reduce((sum, variant) => sum + variant.stock_quantity, 0);
            const low = active.some((variant) => variant.stock_quantity <= LOW_STOCK);
            return (
              <li key={product.id}>
                <Link
                  href={`/admin/produtos/${product.id}`}
                  className="grid grid-cols-[3rem_1fr] items-center gap-x-4 gap-y-2 py-4 hover:text-wine sm:grid-cols-[3rem_1fr_auto]"
                >
                  <span className="relative size-12 overflow-hidden rounded-xl bg-blush">
                    {cover ? (
                      <Image src={productImageUrl(cover.storage_path)} alt="" fill sizes="3rem" className="object-cover" />
                    ) : null}
                  </span>
                  <span className="min-w-0">
                    <span className="block truncate font-semibold">{product.name}</span>
                    <span className="block truncate text-xs text-ink-muted">
                      {product.category?.name ?? "Sem categoria"} · {active.length}{" "}
                      {active.length === 1 ? "variante" : "variantes"}
                      {product.is_featured ? " · Destaque" : ""}
                    </span>
                  </span>
                  <span className="col-start-2 flex flex-wrap items-center gap-3 text-sm sm:col-start-3">
                    <span className="tabular-nums">
                      {prices.length
                        ? Math.min(...prices) === Math.max(...prices)
                          ? formatBRL(prices[0])
                          : `${formatBRL(Math.min(...prices))} a ${formatBRL(Math.max(...prices))}`
                        : "Sem preço"}
                    </span>
                    <span className={`tabular-nums ${low ? "font-semibold text-wine" : "text-ink-muted"}`}>
                      {stock} em estoque
                    </span>
                    <ActiveBadge active={product.is_active} />
                  </span>
                </Link>
              </li>
            );
          })}
        </ul>
      ) : (
        <p className="surface p-8 text-center text-ink-muted">
          Nenhum produto encontrado.
        </p>
      )}

      {pages > 1 ? (
        <nav aria-label="Páginas" className="mt-6 flex items-center justify-between gap-4 text-sm">
          {page > 1 ? (
            <Link href={href({ filtro, q, pagina: page - 1 })} className="font-semibold text-wine hover:underline">
              ← Anteriores
            </Link>
          ) : (
            <span />
          )}
          <span className="text-ink-muted">
            Página {page} de {pages}
          </span>
          {page < pages ? (
            <Link href={href({ filtro, q, pagina: page + 1 })} className="font-semibold text-wine hover:underline">
              Próximos →
            </Link>
          ) : (
            <span />
          )}
        </nav>
      ) : null}
    </>
  );
}
