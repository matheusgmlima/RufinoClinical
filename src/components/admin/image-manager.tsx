"use client";

import Image from "next/image";
import { useRef, useState, useTransition } from "react";

import { addImage, deleteImage, updateImage } from "@/app/actions/admin/catalog";
import { Button } from "@/components/ui/button";
import { Field, FormAlert, Input } from "@/components/ui/field";
import type { FormState } from "@/lib/forms";
import { createClient } from "@/lib/supabase/client";

import { FormMessage, SelectField } from "./fields";
import { useAdminForm } from "./use-admin-form";

export type AdminImage = { id: string; url: string; alt: string; position: number; variant_id: string | null };
type Variant = { id: string; name: string };

// Same limits as the product-images bucket.
const MAX_BYTES = 5 * 1024 * 1024;
const EXTENSIONS: Record<string, string> = {
  "image/jpeg": "jpg",
  "image/png": "png",
  "image/webp": "webp",
  "image/avif": "avif",
};

/**
 * Photos go straight from the browser to Storage (the bucket only accepts admins), then a server
 * action registers them on the product. Nothing passes through our server but the path.
 */
export function ImageUpload({ productId, defaultAlt }: { productId: string; defaultAlt: string }) {
  const input = useRef<HTMLInputElement>(null);
  const [pending, start] = useTransition();
  const [result, setResult] = useState<FormState>({ status: "idle" });

  function upload(files: File[]) {
    setResult({ status: "idle" });
    start(async () => {
      const supabase = createClient();
      const failed: string[] = [];
      for (const file of files) {
        const ext = EXTENSIONS[file.type];
        if (!ext || file.size > MAX_BYTES) {
          failed.push(`${file.name} (use JPG, PNG, WebP ou AVIF de até 5 MB)`);
          continue;
        }
        const path = `products/${productId}/${crypto.randomUUID()}.${ext}`;
        const { error } = await supabase.storage
          .from("product-images")
          .upload(path, file, { contentType: file.type, cacheControl: "31536000", upsert: false });
        const saved = error ? null : await addImage(productId, { path, alt: defaultAlt }).catch(() => null);
        if (!saved || saved.status !== "ok") {
          if (!error) await supabase.storage.from("product-images").remove([path]);
          failed.push(file.name);
        }
      }
      if (input.current) input.current.value = "";
      setResult(
        failed.length
          ? { status: "error", message: `Não foi possível enviar: ${failed.join(", ")}.` }
          : { status: "ok", message: files.length > 1 ? "Fotos adicionadas." : "Foto adicionada." },
      );
    });
  }

  return (
    <div className="grid gap-3">
      <FormMessage state={result} />
      <label
        htmlFor="upload"
        className={`flex cursor-pointer flex-col items-center gap-1 rounded-2xl border border-dashed border-wine/30 px-4 py-6 text-center text-sm hover:border-wine hover:bg-wine/5 ${pending ? "pointer-events-none opacity-60" : ""}`}
      >
        <span className="font-semibold text-wine">{pending ? "Enviando..." : "Escolher fotos"}</span>
        <span className="text-xs text-ink-muted">JPG, PNG, WebP ou AVIF, até 5 MB cada. Fundo claro e quadradas ficam melhor.</span>
      </label>
      <input
        ref={input}
        id="upload"
        type="file"
        accept={Object.keys(EXTENSIONS).join(",")}
        multiple
        disabled={pending}
        className="sr-only"
        onChange={(event) => {
          const files = Array.from(event.currentTarget.files ?? []);
          if (files.length) upload(files);
        }}
      />
    </div>
  );
}

/** One photo: preview, description, order, linked variant and delete. */
export function ImageCard({ productId, image, variants }: { productId: string; image: AdminImage; variants: Variant[] }) {
  const { state, errors, onSubmit, pending } = useAdminForm(updateImage.bind(null, productId, image.id));
  const [removing, startRemove] = useTransition();
  const [confirming, setConfirming] = useState(false);
  const [removeError, setRemoveError] = useState<string>();
  const p = `img-${image.id}`;

  function remove() {
    startRemove(async () => {
      const result = await deleteImage(productId, image.id).catch(() => null);
      if (result?.status !== "ok") setRemoveError(result?.message ?? "Sem conexão. Tente de novo.");
    });
  }

  return (
    <li className="grid gap-4 rounded-2xl border border-line p-4">
      <div className="relative size-28 overflow-hidden rounded-xl bg-blush">
        <Image src={image.url} alt="" fill sizes="7rem" className="object-cover" />
      </div>
      <form onSubmit={onSubmit} className="grid min-w-0 gap-3" noValidate>
        <FormMessage state={state} />
        {removeError ? <FormAlert>{removeError}</FormAlert> : null}
        <Field id={`${p}-alt`} label="Descrição da foto" error={errors.alt} hint="Para quem usa leitor de tela.">
          <Input id={`${p}-alt`} name="alt" defaultValue={image.alt} maxLength={200} hint error={errors.alt} />
        </Field>
        <div className="grid grid-cols-[5.5rem_1fr] gap-3">
          <Field id={`${p}-position`} label="Ordem" error={errors.position}>
            <Input
              id={`${p}-position`}
              name="position"
              type="number"
              inputMode="numeric"
              min={0}
              max={9999}
              defaultValue={image.position}
              error={errors.position}
            />
          </Field>
          <SelectField
            id={`${p}-variant`}
            name="variant_id"
            label="Variante"
            defaultValue={image.variant_id ?? ""}
            error={errors.variant_id}
          >
            <option value="">Todas</option>
            {variants.map((variant) => (
              <option key={variant.id} value={variant.id}>
                {variant.name}
              </option>
            ))}
          </SelectField>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button type="submit" variant="secondary" disabled={pending || removing}>
            {pending ? "Salvando..." : "Salvar foto"}
          </Button>
          {confirming ? (
            <>
              <Button onClick={remove} disabled={removing}>
                {removing ? "Excluindo..." : "Sim, excluir"}
              </Button>
              <Button variant="ghost" onClick={() => setConfirming(false)} disabled={removing}>
                Voltar
              </Button>
            </>
          ) : (
            <Button variant="ghost" onClick={() => setConfirming(true)}>
              Excluir
            </Button>
          )}
        </div>
      </form>
    </li>
  );
}
