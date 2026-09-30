import { ArrowCounterClockwise, Info, Moped, PixLogo, Plus, Storefront, Truck } from "@phosphor-icons/react/ssr";
import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";

import { ProductCard } from "@/components/product/product-card";
import { ProductGallery } from "@/components/product/product-gallery";
import { ProductPurchase } from "@/components/product/product-purchase";
import { ProductView } from "@/components/product/product-view";
import { getDeliverySettings, getProductBySlug, getProducts, getStoreSettings } from "@/lib/catalog/queries";
import { formatBRL } from "@/lib/money";
import { formatCutoff } from "@/lib/shipping/options";

export async function generateMetadata({ params }: PageProps<"/produtos/[slug]">): Promise<Metadata> {
  const { slug } = await params;
  const product = await getProductBySlug(slug);
  if (!product) return { title: "Produto não encontrado" };
  return {
    title: product.seoTitle ?? product.name,
    description: product.seoDescription ?? product.shortDescription ?? undefined,
  };
}

export default async function ProductPage({ params }: PageProps<"/produtos/[slug]">) {
  const { slug } = await params;
  const [product, settings, delivery] = await Promise.all([
    getProductBySlug(slug),
    getStoreSettings(),
    getDeliverySettings(),
  ]);
  if (!product) notFound();

  const related = product.category
    ? (await getProducts({ categorySlug: product.category.slug })).filter((p) => p.id !== product.id).slice(0, 4)
    : [];
  const initialVariant = product.variants.find((v) => v.stock > 0) ?? product.variants[0];
  const healthNotice = (
    <p className="flex gap-3 text-sm text-ink-muted">
      <Info size={20} className="shrink-0 text-wine" aria-hidden="true" />
      Produto para saúde. Use com orientação de um fisioterapeuta ou médico.
    </p>
  );
  // On phones the long texts collapse into expandable rows.
  const details = [
    {
      title: "Descrição",
      body: product.description,
      extra: product.anvisaRegistration ? `Registro Anvisa: ${product.anvisaRegistration}` : null,
    },
    { title: "Modo de uso", body: product.usageInstructions, extra: null },
    { title: "Indicações", body: product.indications, extra: null },
  ].filter((d) => d.body);

  return (
    <>
      <div className="container-page pb-20 pt-8 lg:pt-10">
        <nav aria-label="Você está em" className="text-sm text-ink-muted">
          <ol className="flex flex-wrap items-center gap-2">
            <li>
              <Link href="/produtos" className="hover:text-wine">
                Produtos
              </Link>
            </li>
            {product.category ? (
              <>
                <li aria-hidden="true">/</li>
                <li>
                  <Link href={`/produtos?categoria=${product.category.slug}`} className="hover:text-wine">
                    {product.category.name}
                  </Link>
                </li>
              </>
            ) : null}
          </ol>
        </nav>

        <ProductView initialVariantId={initialVariant.id}>
          <div className="mt-6 grid gap-10 lg:grid-cols-12 lg:gap-16">
            <div className="lg:col-span-7">
              <ProductGallery images={product.images} productName={product.name} />
            </div>

            <div className="lg:col-span-5">
              <div className="lg:sticky lg:top-24">
                <h1 className="text-3xl font-semibold leading-tight tracking-tight text-ink text-balance md:text-4xl">
                  {product.name}
                </h1>
                {product.shortDescription ? (
                  <p className="mt-3 text-lg leading-relaxed text-ink-muted">{product.shortDescription}</p>
                ) : null}

                <div className="mt-8">
                  <ProductPurchase productName={product.name} variants={product.variants} settings={settings} />
                </div>

                <ul className="mt-9 space-y-3 border-t border-line pt-6 text-sm text-ink-muted">
                  <li className="flex items-center gap-3">
                    <PixLogo size={20} className="text-wine" aria-hidden="true" />
                    {settings.pixDiscountPercent}% de desconto pagando com Pix
                  </li>
                  {delivery.local ? (
                    <li className="flex items-center gap-3">
                      <Moped size={20} className="shrink-0 text-wine" aria-hidden="true" />
                      <span>
                        <strong className="font-semibold text-ink">
                          Entrega no mesmo dia em {delivery.local.city ?? "nossa cidade"} e região
                        </strong>{" "}
                        por {formatBRL(delivery.local.priceCents)}, pagando até {formatCutoff(delivery.local.cutoff)} em
                        dia útil
                      </span>
                    </li>
                  ) : null}
                  {delivery.pickup ? (
                    <li className="flex items-center gap-3">
                      <Storefront size={20} className="shrink-0 text-wine" aria-hidden="true" />
                      Retirada grátis na loja
                    </li>
                  ) : null}
                  <li className="flex items-center gap-3">
                    <Truck size={20} className="text-wine" aria-hidden="true" />
                    Frete para todo o Brasil, calculado pelo CEP
                  </li>
                  <li className="flex items-center gap-3">
                    <ArrowCounterClockwise size={20} className="text-wine" aria-hidden="true" />
                    7 dias para desistir após o recebimento
                  </li>
                </ul>
              </div>
            </div>
          </div>
        </ProductView>

        <section className="mt-10 lg:hidden" aria-label="Detalhes do produto">
          <div className="divide-y divide-line border-y border-line">
            {details.map((d) => (
              <details key={d.title} className="group">
                <summary className="flex cursor-pointer items-center justify-between gap-6 py-4 text-base font-semibold text-ink">
                  {d.title}
                  <Plus size={18} weight="bold" className="shrink-0 transition group-open:rotate-45" aria-hidden="true" />
                </summary>
                <div className="space-y-3 pb-5 text-sm leading-relaxed text-ink-muted">
                  <p>{d.body}</p>
                  {d.extra ? <p>{d.extra}</p> : null}
                </div>
              </details>
            ))}
          </div>
          <div className="mt-5">{healthNotice}</div>
        </section>

        <section className="mt-20 hidden gap-16 lg:grid lg:grid-cols-12" aria-labelledby="sobre-produto">
          <div className="lg:col-span-7">
            <h2 id="sobre-produto" className="text-2xl font-semibold tracking-tight text-ink">
              Sobre o produto
            </h2>
            {product.description ? (
              <p className="mt-4 max-w-[65ch] leading-relaxed text-ink-muted">{product.description}</p>
            ) : null}
            {product.anvisaRegistration ? (
              <p className="mt-4 text-sm text-ink-muted">Registro Anvisa: {product.anvisaRegistration}</p>
            ) : null}
          </div>
          <div className="grid gap-4 lg:col-span-5">
            {product.usageInstructions ? (
              <div className="rounded-2xl bg-blush p-6">
                <h3 className="font-semibold text-ink">Modo de uso</h3>
                <p className="mt-2 text-sm leading-relaxed text-ink-muted">{product.usageInstructions}</p>
              </div>
            ) : null}
            {product.indications ? (
              <div className="rounded-2xl border border-line p-6">
                <h3 className="font-semibold text-ink">Indicações</h3>
                <p className="mt-2 text-sm leading-relaxed text-ink-muted">{product.indications}</p>
              </div>
            ) : null}
            {healthNotice}
          </div>
        </section>
      </div>

      {related.length > 0 ? (
        <section className="border-t border-line bg-blush/50">
          <div className="container-page py-14 lg:py-20">
            <h2 className="text-2xl font-semibold tracking-tight text-ink md:text-3xl">Combina com</h2>
            <div className="mt-8 grid grid-cols-2 gap-x-4 gap-y-10 lg:mt-10 lg:grid-cols-4 lg:gap-x-5 lg:gap-y-12">
              {related.map((p) => (
                <ProductCard key={p.id} product={p} settings={settings} />
              ))}
            </div>
          </div>
        </section>
      ) : null}
    </>
  );
}
