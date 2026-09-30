"use client";

import { useEffect, useRef } from "react";

import { saveCategory } from "@/app/actions/admin/catalog";
import { Button } from "@/components/ui/button";
import { Field, Input } from "@/components/ui/field";

import { Checkbox, FormMessage, TextAreaField } from "./fields";
import { useAdminForm } from "./use-admin-form";

type Category = {
  id: string;
  name: string;
  slug: string;
  description: string | null;
  position: number;
  is_active: boolean;
};

/** Adds a category (no `category`) or edits one. */
export function CategoryForm({ category }: { category?: Category }) {
  const { state, errors, onSubmit, pending } = useAdminForm(saveCategory.bind(null, category?.id ?? null));
  const form = useRef<HTMLFormElement>(null);
  const p = category ? `c-${category.id}` : "c-new";

  useEffect(() => {
    if (!category && state.status === "ok") form.current?.reset();
  }, [state, category]);

  return (
    <form ref={form} onSubmit={onSubmit} className="grid gap-5" noValidate>
      <FormMessage state={state} />
      <div className="grid gap-5 sm:grid-cols-2">
        <Field id={`${p}-name`} label="Nome" error={errors.name}>
          <Input id={`${p}-name`} name="name" defaultValue={category?.name} maxLength={80} error={errors.name} />
        </Field>
        <Field
          id={`${p}-slug`}
          label="Endereço na loja"
          error={errors.slug}
          hint="Em branco, gera pelo nome."
        >
          <Input
            id={`${p}-slug`}
            name="slug"
            defaultValue={category?.slug}
            maxLength={80}
            autoComplete="off"
            hint
            error={errors.slug}
          />
        </Field>
      </div>
      <TextAreaField
        id={`${p}-description`}
        name="description"
        label="Descrição"
        rows={2}
        defaultValue={category?.description ?? ""}
        maxLength={500}
        error={errors.description}
        optional
      />
      <div className="flex flex-wrap items-end gap-5">
        <Field id={`${p}-position`} label="Ordem" error={errors.position}>
          <Input
            id={`${p}-position`}
            name="position"
            type="number"
            inputMode="numeric"
            min={0}
            max={9999}
            defaultValue={category?.position ?? 0}
            className="max-w-32"
            error={errors.position}
          />
        </Field>
        <div className="pb-3">
          <Checkbox id={`${p}-active`} name="is_active" label="Mostrar na loja" defaultChecked={category?.is_active ?? true} />
        </div>
      </div>
      <Button type="submit" variant={category ? "secondary" : "primary"} disabled={pending} className="justify-self-start">
        {pending ? "Salvando..." : category ? "Salvar categoria" : "Criar categoria"}
      </Button>
    </form>
  );
}
