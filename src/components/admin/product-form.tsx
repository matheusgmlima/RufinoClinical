"use client";

import { createProduct, updateProduct } from "@/app/actions/admin/catalog";
import { Button } from "@/components/ui/button";
import { Field, Input } from "@/components/ui/field";
import type { Tables } from "@/lib/supabase/database.types";

import { Checkbox, FormMessage, SelectField, TextAreaField } from "./fields";
import { useAdminForm } from "./use-admin-form";

type Product = Omit<Tables<"products">, "created_at" | "updated_at">;
type Category = { id: string; name: string };

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <fieldset className="grid gap-5 border-t border-line pt-5 first:border-t-0 first:pt-0">
      <legend className="float-left mb-1 text-sm font-semibold uppercase tracking-wide text-ink-muted">{title}</legend>
      {children}
    </fieldset>
  );
}

/** New product (name, address, category) or the full edit form. */
export function ProductForm({ product, categories }: { product?: Product; categories: Category[] }) {
  const action = product ? updateProduct.bind(null, product.id) : createProduct;
  const { state, errors, onSubmit, pending } = useAdminForm(action);

  return (
    <form onSubmit={onSubmit} className="grid gap-6" noValidate>
      <FormMessage state={state} />

      <Section title="Identificação">
        <Field id="name" label="Nome do produto" error={errors.name}>
          <Input id="name" defaultValue={product?.name} maxLength={120} required error={errors.name} />
        </Field>
        <Field
          id="slug"
          label="Endereço na loja"
          error={errors.slug}
          hint="Aparece no link: /produtos/endereco. Deixe em branco para gerar pelo nome."
        >
          <Input id="slug" defaultValue={product?.slug} maxLength={120} autoComplete="off" hint error={errors.slug} />
        </Field>
        <div className="grid gap-5 sm:grid-cols-2">
          <SelectField id="category_id" label="Categoria" defaultValue={product?.category_id ?? ""} error={errors.category_id}>
            <option value="">Sem categoria</option>
            {categories.map((category) => (
              <option key={category.id} value={category.id}>
                {category.name}
              </option>
            ))}
          </SelectField>
          <Field id="brand" label="Marca" error={errors.brand} optional>
            <Input id="brand" defaultValue={product?.brand ?? ""} maxLength={80} error={errors.brand} />
          </Field>
        </div>
        <TextAreaField
          id="short_description"
          label="Resumo"
          hint="Uma ou duas frases. Aparece no card do produto."
          defaultValue={product?.short_description ?? ""}
          maxLength={300}
          error={errors.short_description}
          optional
        />
      </Section>

      {product ? (
        <>
          <Section title="Página do produto">
            <TextAreaField
              id="description"
              label="Descrição"
              rows={6}
              defaultValue={product.description ?? ""}
              maxLength={10000}
              error={errors.description}
              optional
            />
            <TextAreaField
              id="indications"
              label="Indicações"
              rows={4}
              defaultValue={product.indications ?? ""}
              maxLength={5000}
              error={errors.indications}
              optional
            />
            <TextAreaField
              id="usage_instructions"
              label="Modo de uso"
              rows={4}
              defaultValue={product.usage_instructions ?? ""}
              maxLength={5000}
              error={errors.usage_instructions}
              optional
            />
            <Field id="anvisa_registration" label="Registro na Anvisa" error={errors.anvisa_registration} optional>
              <Input
                id="anvisa_registration"
                defaultValue={product.anvisa_registration ?? ""}
                maxLength={40}
                error={errors.anvisa_registration}
              />
            </Field>
          </Section>

          <Section title="Busca no Google">
            <Field
              id="seo_title"
              label="Título"
              error={errors.seo_title}
              hint="Até 70 caracteres. Em branco, usa o nome."
              optional
            >
              <Input id="seo_title" defaultValue={product.seo_title ?? ""} maxLength={70} hint error={errors.seo_title} />
            </Field>
            <TextAreaField
              id="seo_description"
              label="Descrição"
              hint="Até 160 caracteres. Em branco, usa o resumo."
              rows={2}
              defaultValue={product.seo_description ?? ""}
              maxLength={160}
              error={errors.seo_description}
              optional
            />
          </Section>

          <Section title="Vitrine">
            <Field id="position" label="Ordem na lista" error={errors.position} hint="Menor aparece primeiro.">
              <Input
                id="position"
                type="number"
                inputMode="numeric"
                min={0}
                max={9999}
                defaultValue={product.position}
                className="max-w-32"
                hint
                error={errors.position}
              />
            </Field>
            <Checkbox
              id="is_featured"
              label="Destacar na página inicial"
              defaultChecked={product.is_featured}
              error={errors.is_featured}
            />
            <Checkbox
              id="is_active"
              label="Mostrar na loja"
              hint="Desmarcado, o produto fica como rascunho e só a equipe vê."
              defaultChecked={product.is_active}
              error={errors.is_active}
            />
          </Section>
        </>
      ) : null}

      <Button type="submit" disabled={pending} className="justify-self-start">
        {pending ? "Salvando..." : product ? "Salvar produto" : "Criar produto"}
      </Button>
    </form>
  );
}
