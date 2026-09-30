import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { z } from "zod";

import { deleteProduct } from "@/app/actions/admin/catalog";
import { ConfirmDelete } from "@/components/admin/confirm-delete";
import { ImageCard, ImageUpload } from "@/components/admin/image-manager";
import { ProductForm } from "@/components/admin/product-form";
import { ActiveBadge, AdminHeader, Panel } from "@/components/admin/ui";
import { StockForm, VariantForm } from "@/components/admin/variant-forms";
import { requireAdmin } from "@/lib/auth/admin";
import { productImageUrl } from "@/lib/catalog/images";
import { formatDateTime } from "@/lib/dates";
import { formatBRL } from "@/lib/money";

export const metadata: Metadata = { title: "Produto" };

const PRODUCT_FIELDS = `id, category_id, slug, name, brand, short_description, description, usage_instructions,
  indications, anvisa_registration, is_active, is_featured, position, seo_title, seo_description, updated_at,
  variants:product_variants(id, sku, name, price_cents, compare_at_price_cents, stock_quantity, weight_grams,
    length_cm, width_cm, height_cm, position, is_active),
  images:product_images(id, storage_path, alt, position, variant_id)`;

const MOVEMENT_LABEL: Record<string, string> = {
  order_reserved: "Pedido",
  order_released: "Pedido cancelado",
  admin_adjustment: "Ajuste manual",
  return: "Devolução",
};

export default async function AdminProductPage({ params }: PageProps<"/admin/produtos/[id]">) {
  const { id } = await params;
  if (!z.uuid().safeParse(id).success) notFound();
  const { supabase } = await requireAdmin();
  const [{ data: product }, { data: categories }, { data: movements }] = await Promise.all([
    supabase.from("products").select(PRODUCT_FIELDS).eq("id", id).maybeSingle(),
    supabase.from("categories").select("id, name").order("position").order("name"),
    supabase
      .from("stock_movements")
      .select("id, delta, reason, created_at, order:orders(id, number), variant:product_variants!inner(name, product_id)")
      .eq("variant.product_id", id)
      .order("created_at", { ascending: false })
      .limit(10),
  ]);
  if (!product) notFound();

  const { variants: variantRows, images: imageRows, ...fields } = product;
  const variants = variantRows.toSorted((a, b) => a.position - b.position || a.name.localeCompare(b.name));
  const images = imageRows
    .toSorted((a, b) => a.position - b.position)
    .map(({ storage_path, ...image }) => ({ ...image, url: productImageUrl(storage_path) }));

  return (
    <>
      <Link href="/admin/produtos" className="text-sm font-semibold text-wine hover:underline">
        ← Produtos
      </Link>
      <AdminHeader
        title={product.name}
        lead={`Atualizado em ${formatDateTime(product.updated_at)}`}
        action={
          <span className="flex items-center gap-3">
            {product.is_active ? (
              <Link href={`/produtos/${product.slug}`} className="text-sm font-semibold text-wine hover:underline">
                Ver na loja
              </Link>
            ) : null}
            <ActiveBadge active={product.is_active} />
          </span>
        }
      />

      <div className="grid grid-cols-1 gap-6 xl:grid-cols-5">
        <div className="grid content-start gap-6 xl:col-span-3">
          <Panel title="Variantes e estoque">
            {variants.length ? (
              <ul className="grid gap-4">
                {variants.map((variant) => (
                  <li key={variant.id} className="grid gap-4 rounded-2xl border border-line p-4">
                    <div className="flex flex-wrap items-start justify-between gap-3">
                      <div className="min-w-0">
                        <p className="font-semibold">
                          {variant.name}
                          {variant.is_active ? null : <span className="font-normal text-ink-muted"> · indisponível</span>}
                        </p>
                        <p className="text-xs text-ink-muted">SKU {variant.sku}</p>
                      </div>
                      <div className="text-right text-sm">
                        <p className="tabular-nums">
                          {variant.compare_at_price_cents ? (
                            <s className="mr-2 text-ink-muted">{formatBRL(variant.compare_at_price_cents)}</s>
                          ) : null}
                          {formatBRL(variant.price_cents)}
                        </p>
                        <p className={`tabular-nums ${variant.stock_quantity <= 5 ? "font-semibold text-wine" : "text-ink-muted"}`}>
                          {variant.stock_quantity} em estoque
                        </p>
                      </div>
                    </div>
                    <StockForm productId={product.id} variantId={variant.id} />
                    <details className="group border-t border-line pt-3">
                      <summary className="cursor-pointer text-sm font-semibold text-wine">Editar variante</summary>
                      <div className="pt-4">
                        <VariantForm productId={product.id} variant={variant} />
                      </div>
                    </details>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="text-sm text-ink-muted">
                Nenhuma variante ainda. Todo produto precisa de pelo menos uma (mesmo que seja “Único”) para ter preço e
                estoque.
              </p>
            )}
            <section aria-labelledby="new-variant" className="mt-5 rounded-2xl bg-cream/60 p-4">
              <h3 id="new-variant" className="mb-4 font-semibold text-ink">
                Adicionar variante
              </h3>
              <VariantForm productId={product.id} />
            </section>
          </Panel>

          <Panel title="Dados do produto">
            <ProductForm product={fields} categories={categories ?? []} />
          </Panel>
        </div>

        <div className="grid content-start gap-6 xl:col-span-2">
          <Panel title="Fotos">
            <div className="grid gap-4">
              <ImageUpload productId={product.id} defaultAlt={product.name} />
              {images.length ? (
                <ul className="grid gap-3">
                  {images.map((image) => (
                    <ImageCard
                      key={image.id}
                      productId={product.id}
                      image={image}
                      variants={variants.map(({ id: variantId, name }) => ({ id: variantId, name }))}
                    />
                  ))}
                </ul>
              ) : (
                <p className="text-sm text-ink-muted">Sem fotos. A primeira da ordem vira a capa.</p>
              )}
            </div>
          </Panel>

          <Panel title="Movimentações de estoque">
            {movements?.length ? (
              <ul className="divide-y divide-line text-sm">
                {movements.map((movement) => (
                  <li key={movement.id} className="flex items-center justify-between gap-3 py-2">
                    <span className="min-w-0">
                      <span className="block">
                        {MOVEMENT_LABEL[movement.reason] ?? movement.reason}
                        {movement.order ? (
                          <>
                            {" "}
                            <Link href={`/admin/pedidos/${movement.order.id}`} className="text-wine hover:underline">
                              #{movement.order.number}
                            </Link>
                          </>
                        ) : null}
                      </span>
                      <span className="block text-xs text-ink-muted">
                        {movement.variant.name} · {formatDateTime(movement.created_at)}
                      </span>
                    </span>
                    <span className={`tabular-nums font-semibold ${movement.delta > 0 ? "text-ink" : "text-wine"}`}>
                      {movement.delta > 0 ? `+${movement.delta}` : movement.delta}
                    </span>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="text-sm text-ink-muted">Nenhuma movimentação.</p>
            )}
          </Panel>

          <Panel title="Excluir produto">
            <p className="mb-3 text-sm text-ink-muted">
              Só produtos sem vendas nem movimentação de estoque. Os demais ficam guardados como rascunho.
            </p>
            <ConfirmDelete
              label="Excluir produto"
              question={`Excluir “${product.name}”, suas variantes e fotos? Isso não pode ser desfeito.`}
              action={deleteProduct.bind(null, product.id)}
            />
          </Panel>
        </div>
      </div>
    </>
  );
}
