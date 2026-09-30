"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";

import { adminClient } from "@/lib/auth/admin";
import { SLUG_PATTERN, slugify } from "@/lib/catalog/slug";
import { fieldErrors, type FormState } from "@/lib/forms";
import { parseBRL } from "@/lib/money";

// Every action re-checks the admin session (row in admin_users + MFA); RLS and column grants
// are the second barrier. Stock only changes through adjust_stock, which writes the ledger.

const DENIED: FormState = { status: "error", message: "Acesso negado. Entre de novo no painel." };
const uuid = z.uuid();

const optional = (max: number) =>
  z
    .string()
    .trim()
    .max(max, `Use no máximo ${max} caracteres.`)
    .transform((value) => value || null);

const slug = (max: number) =>
  z
    .string()
    .trim()
    .max(max, `Use no máximo ${max} caracteres.`)
    .regex(SLUG_PATTERN, "Use só letras minúsculas sem acento, números e hífens.");

const position = z.coerce
  .number({ error: "Use um número inteiro." })
  .int("Use um número inteiro.")
  .min(0, "Use 0 ou mais.")
  .max(9999, "Use até 9999.");

const cents = (message: string) =>
  z.string().transform((value, ctx) => {
    const parsed = parseBRL(value);
    if (parsed === null) {
      ctx.issues.push({ code: "custom", message, input: value });
      return z.NEVER;
    }
    return parsed;
  });

// Package dimensions in cm, one decimal (numeric(5,1) in the database).
const dimension = z
  .string()
  .trim()
  .transform((value) => Math.round(Number(value.replace(",", ".")) * 10) / 10)
  .refine((value) => Number.isFinite(value) && value > 0 && value <= 100, "Informe de 0,1 a 100 cm.");

const text = (formData: FormData, name: string) => String(formData.get(name) ?? "");
const checked = (formData: FormData, name: string) => formData.get(name) === "on";

/** Postgres error code from a PostgREST response. */
const isUniqueViolation = (error: { code?: string } | null) => error?.code === "23505";

type Client = NonNullable<Awaited<ReturnType<typeof adminClient>>>;

/** Deletes photo files after their rows are gone. A leftover file is harmless but logged. */
async function removeFiles(supabase: Client, paths: string[]) {
  if (!paths.length) return;
  const { data } = await supabase.storage.from("product-images").remove(paths);
  if ((data?.length ?? 0) < paths.length) console.error("product image files left in storage", { paths });
}

function refreshProduct(productId?: string) {
  revalidatePath("/admin/produtos");
  if (productId) revalidatePath(`/admin/produtos/${productId}`);
  revalidatePath("/admin");
}

// Products ------------------------------------------------------------------------------------

const productBase = z.object({
  name: z.string().trim().min(2, "Informe o nome (mínimo de 2 letras).").max(120, "Use no máximo 120 caracteres."),
  slug: slug(120),
  category_id: z.union([uuid, z.literal("")]).transform((value) => value || null),
  brand: optional(80),
  short_description: optional(300),
});

const productSchema = productBase.extend({
  description: optional(10000),
  usage_instructions: optional(5000),
  indications: optional(5000),
  anvisa_registration: optional(40),
  seo_title: optional(70),
  seo_description: optional(160),
  position,
  is_featured: z.boolean(),
  is_active: z.boolean(),
});

function productInput(formData: FormData) {
  const name = text(formData, "name");
  return {
    name,
    // Blank address: generated from the name.
    slug: text(formData, "slug").trim() || slugify(name),
    category_id: text(formData, "category_id"),
    brand: text(formData, "brand"),
    short_description: text(formData, "short_description"),
    description: text(formData, "description"),
    usage_instructions: text(formData, "usage_instructions"),
    indications: text(formData, "indications"),
    anvisa_registration: text(formData, "anvisa_registration"),
    seo_title: text(formData, "seo_title"),
    seo_description: text(formData, "seo_description"),
    position: text(formData, "position") || "0",
    is_featured: checked(formData, "is_featured"),
    is_active: checked(formData, "is_active"),
  };
}

const SLUG_TAKEN: FormState = {
  status: "error",
  fieldErrors: { slug: "Já existe um produto com este endereço. Escolha outro." },
};

/** Creates a draft (hidden from the store) and opens it for the rest of the details. */
export async function createProduct(_prev: FormState, formData: FormData): Promise<FormState> {
  const supabase = await adminClient();
  if (!supabase) return DENIED;
  const parsed = productBase.safeParse(productInput(formData));
  if (!parsed.success) return { status: "error", fieldErrors: fieldErrors(parsed.error) };

  const { data, error } = await supabase
    .from("products")
    .insert({ ...parsed.data, is_active: false })
    .select("id")
    .single();
  if (isUniqueViolation(error)) return SLUG_TAKEN;
  if (error || !data) return { status: "error", message: "Não foi possível criar o produto. Tente de novo." };

  refreshProduct();
  redirect(`/admin/produtos/${data.id}`);
}

export async function updateProduct(productId: string, _prev: FormState, formData: FormData): Promise<FormState> {
  const supabase = await adminClient();
  if (!supabase || !uuid.safeParse(productId).success) return DENIED;
  const parsed = productSchema.safeParse(productInput(formData));
  if (!parsed.success) return { status: "error", fieldErrors: fieldErrors(parsed.error) };

  if (parsed.data.is_active) {
    const { count } = await supabase
      .from("product_variants")
      .select("id", { count: "exact", head: true })
      .eq("product_id", productId)
      .eq("is_active", true);
    if (!count) {
      return {
        status: "error",
        fieldErrors: { is_active: "Cadastre uma variante ativa antes de mostrar o produto na loja." },
      };
    }
  }

  const { data, error } = await supabase.from("products").update(parsed.data).eq("id", productId).select("id");
  if (isUniqueViolation(error)) return SLUG_TAKEN;
  if (error || !data?.length) return { status: "error", message: "Não foi possível salvar. Atualize a página." };

  refreshProduct(productId);
  return { status: "ok", message: parsed.data.is_active ? "Produto salvo e visível na loja." : "Produto salvo." };
}

/**
 * Only products that never moved stock (no sales, no adjustments) can be deleted; the ledger
 * keeps the history of the others, which are deactivated instead.
 */
export async function deleteProduct(productId: string): Promise<FormState> {
  const supabase = await adminClient();
  if (!supabase || !uuid.safeParse(productId).success) return DENIED;

  const { data: images } = await supabase.from("product_images").select("storage_path").eq("product_id", productId);
  const { data, error } = await supabase.from("products").delete().eq("id", productId).select("id");
  if (error?.code === "23503") {
    return {
      status: "error",
      message: "Este produto já teve vendas ou movimentação de estoque. Desmarque “Mostrar na loja” para escondê-lo.",
    };
  }
  if (error || !data?.length) return { status: "error", message: "Não foi possível excluir. Atualize a página." };

  await removeFiles(supabase, images?.map((image) => image.storage_path) ?? []);
  refreshProduct();
  redirect("/admin/produtos");
}

// Variants and stock -------------------------------------------------------------------------

const variantSchema = z
  .object({
    sku: z
      .string()
      .trim()
      .toUpperCase()
      .regex(/^[A-Z0-9-]{3,40}$/, "Use de 3 a 40 letras, números ou hífens."),
    name: z.string().trim().min(1, "Informe o nome da variante.").max(80, "Use no máximo 80 caracteres."),
    price_cents: cents("Preço inválido. Exemplo: 49,90."),
    compare_at_price_cents: z.union([z.literal(""), cents("Preço inválido. Exemplo: 59,90.")]).transform(
      (value) => (value === "" ? null : value),
    ),
    weight_grams: z.coerce
      .number({ error: "Informe o peso em gramas." })
      .int("Informe o peso em gramas, sem vírgula.")
      .min(1, "Informe o peso em gramas.")
      .max(30000, "Máximo de 30.000 g."),
    length_cm: dimension,
    width_cm: dimension,
    height_cm: dimension,
    position,
    is_active: z.boolean(),
    initial_stock: z.coerce
      .number({ error: "Use um número inteiro." })
      .int("Use um número inteiro.")
      .min(0, "Use 0 ou mais.")
      .max(100000, "Máximo de 100.000."),
  })
  .refine((v) => v.compare_at_price_cents === null || v.compare_at_price_cents > v.price_cents, {
    path: ["compare_at_price_cents"],
    message: "O preço “de” precisa ser maior que o preço de venda.",
  });

/** Adds a variant (variantId null) or edits one. New variants may start with stock. */
export async function saveVariant(
  productId: string,
  variantId: string | null,
  _prev: FormState,
  formData: FormData,
): Promise<FormState> {
  const supabase = await adminClient();
  if (!supabase || !uuid.safeParse(productId).success || (variantId && !uuid.safeParse(variantId).success)) {
    return DENIED;
  }
  const parsed = variantSchema.safeParse({
    sku: text(formData, "sku"),
    name: text(formData, "name"),
    price_cents: text(formData, "price"),
    compare_at_price_cents: text(formData, "compare_at_price").trim(),
    weight_grams: text(formData, "weight_grams"),
    length_cm: text(formData, "length_cm"),
    width_cm: text(formData, "width_cm"),
    height_cm: text(formData, "height_cm"),
    position: text(formData, "position") || "0",
    is_active: checked(formData, "is_active"),
    initial_stock: variantId ? "0" : text(formData, "initial_stock") || "0",
  });
  if (!parsed.success) {
    const errors = fieldErrors(parsed.error);
    // Form field names differ from the columns for the prices.
    errors.price ??= errors.price_cents;
    errors.compare_at_price ??= errors.compare_at_price_cents;
    return { status: "error", fieldErrors: errors };
  }

  const { initial_stock, ...values } = parsed.data;
  const result = variantId
    ? await supabase.from("product_variants").update(values).eq("id", variantId).eq("product_id", productId).select("id")
    : await supabase
        .from("product_variants")
        .insert({ ...values, product_id: productId })
        .select("id");
  if (isUniqueViolation(result.error)) {
    return { status: "error", fieldErrors: { sku: "Este SKU já está em uso em outra variante." } };
  }
  const saved = result.data?.[0];
  if (result.error || !saved) return { status: "error", message: "Não foi possível salvar a variante." };

  if (initial_stock > 0) {
    const { error } = await supabase.rpc("adjust_stock", { p_variant_id: saved.id, p_delta: initial_stock });
    if (error) {
      refreshProduct(productId);
      return { status: "error", message: "Variante criada, mas o estoque inicial não entrou. Ajuste o estoque." };
    }
  }
  refreshProduct(productId);
  return { status: "ok", message: variantId ? "Variante salva." : "Variante adicionada." };
}

const STOCK_KINDS = {
  entrada: { sign: 1, reason: "admin_adjustment" },
  saida: { sign: -1, reason: "admin_adjustment" },
  devolucao: { sign: 1, reason: "return" },
} as const;

const stockSchema = z.object({
  kind: z.enum(Object.keys(STOCK_KINDS) as [keyof typeof STOCK_KINDS], { error: "Escolha o tipo de ajuste." }),
  quantity: z.coerce
    .number({ error: "Informe a quantidade." })
    .int("Use um número inteiro.")
    .min(1, "Informe a quantidade.")
    .max(100000, "Máximo de 100.000."),
});

/** Stock entry, exit/loss or customer return. The ledger records who did it and why. */
export async function adjustStock(
  productId: string,
  variantId: string,
  _prev: FormState,
  formData: FormData,
): Promise<FormState> {
  const supabase = await adminClient();
  if (!supabase || !uuid.safeParse(productId).success || !uuid.safeParse(variantId).success) return DENIED;
  const parsed = stockSchema.safeParse({ kind: text(formData, "kind"), quantity: text(formData, "quantity") });
  if (!parsed.success) return { status: "error", fieldErrors: fieldErrors(parsed.error) };

  const { sign, reason } = STOCK_KINDS[parsed.data.kind];
  const { data, error } = await supabase.rpc("adjust_stock", {
    p_variant_id: variantId,
    p_delta: sign * parsed.data.quantity,
    p_reason: reason,
  });
  if (error?.code === "23514") {
    return { status: "error", fieldErrors: { quantity: "A saída é maior que o estoque atual." } };
  }
  if (error || data === null) return { status: "error", message: "Não foi possível ajustar o estoque." };

  refreshProduct(productId);
  return { status: "ok", message: `Estoque atualizado: ${data} ${data === 1 ? "unidade" : "unidades"}.` };
}

// Images ----------------------------------------------------------------------------------------

const alt = z.string().trim().min(1, "Descreva a foto (para quem usa leitor de tela).").max(200, "Use no máximo 200 caracteres.");
const variantRef = z.union([uuid, z.literal("")]).transform((value) => value || null);

/**
 * Registers a photo the browser already uploaded to Storage (the bucket only accepts admins,
 * images up to 5 MB, under products/). The path must sit in this product's folder.
 */
export async function addImage(productId: string, input: { path: string; alt: string }): Promise<FormState> {
  const supabase = await adminClient();
  if (!supabase || !uuid.safeParse(productId).success) return DENIED;
  const pathPattern = new RegExp(`^products/${productId}/[A-Za-z0-9_-]{1,64}\\.(jpg|jpeg|png|webp|avif)$`);
  const parsed = z.object({ path: z.string().regex(pathPattern), alt }).safeParse(input);
  if (!parsed.success) return { status: "error", message: "Arquivo inválido. Envie a foto de novo." };

  const { data: last } = await supabase
    .from("product_images")
    .select("position")
    .eq("product_id", productId)
    .order("position", { ascending: false })
    .limit(1)
    .maybeSingle();
  const { error } = await supabase.from("product_images").insert({
    product_id: productId,
    storage_path: parsed.data.path,
    alt: parsed.data.alt,
    position: (last?.position ?? -1) + 1,
  });
  if (error) return { status: "error", message: "Não foi possível salvar a foto." };

  refreshProduct(productId);
  return { status: "ok", message: "Foto adicionada." };
}

export async function updateImage(
  productId: string,
  imageId: string,
  _prev: FormState,
  formData: FormData,
): Promise<FormState> {
  const supabase = await adminClient();
  if (!supabase || !uuid.safeParse(productId).success || !uuid.safeParse(imageId).success) return DENIED;
  const parsed = z
    .object({ alt, position, variant_id: variantRef })
    .safeParse({
      alt: text(formData, "alt"),
      position: text(formData, "position") || "0",
      variant_id: text(formData, "variant_id"),
    });
  if (!parsed.success) return { status: "error", fieldErrors: fieldErrors(parsed.error) };

  const { data, error } = await supabase
    .from("product_images")
    .update(parsed.data)
    .eq("id", imageId)
    .eq("product_id", productId)
    .select("id");
  if (error || !data?.length) return { status: "error", message: "Não foi possível salvar a foto." };

  refreshProduct(productId);
  return { status: "ok", message: "Foto salva." };
}

export async function deleteImage(productId: string, imageId: string): Promise<FormState> {
  const supabase = await adminClient();
  if (!supabase || !uuid.safeParse(productId).success || !uuid.safeParse(imageId).success) return DENIED;

  const { data, error } = await supabase
    .from("product_images")
    .delete()
    .eq("id", imageId)
    .eq("product_id", productId)
    .select("storage_path");
  const removed = data?.[0];
  if (error || !removed) return { status: "error", message: "Não foi possível excluir a foto." };

  await removeFiles(supabase, [removed.storage_path]);
  refreshProduct(productId);
  return { status: "ok", message: "Foto excluída." };
}

// Categories ------------------------------------------------------------------------------------

const categorySchema = z.object({
  name: z.string().trim().min(2, "Informe o nome (mínimo de 2 letras).").max(80, "Use no máximo 80 caracteres."),
  slug: slug(80),
  description: optional(500),
  position,
  is_active: z.boolean(),
});

function refreshCategories() {
  revalidatePath("/admin/categorias");
  revalidatePath("/admin/produtos", "layout");
}

/** Adds a category (categoryId null) or edits one. */
export async function saveCategory(categoryId: string | null, _prev: FormState, formData: FormData): Promise<FormState> {
  const supabase = await adminClient();
  if (!supabase || (categoryId && !uuid.safeParse(categoryId).success)) return DENIED;
  const name = text(formData, "name");
  const parsed = categorySchema.safeParse({
    name,
    slug: text(formData, "slug").trim() || slugify(name, 80),
    description: text(formData, "description"),
    position: text(formData, "position") || "0",
    is_active: checked(formData, "is_active"),
  });
  if (!parsed.success) return { status: "error", fieldErrors: fieldErrors(parsed.error) };

  const { data, error } = categoryId
    ? await supabase.from("categories").update(parsed.data).eq("id", categoryId).select("id")
    : await supabase.from("categories").insert(parsed.data).select("id");
  if (isUniqueViolation(error)) {
    return { status: "error", fieldErrors: { slug: "Já existe uma categoria com este endereço." } };
  }
  if (error || !data?.length) return { status: "error", message: "Não foi possível salvar a categoria." };

  refreshCategories();
  return { status: "ok", message: categoryId ? "Categoria salva." : "Categoria criada." };
}

/** Products in the category stay, just without a category. */
export async function deleteCategory(categoryId: string): Promise<FormState> {
  const supabase = await adminClient();
  if (!supabase || !uuid.safeParse(categoryId).success) return DENIED;
  const { data, error } = await supabase.from("categories").delete().eq("id", categoryId).select("id");
  if (error || !data?.length) return { status: "error", message: "Não foi possível excluir a categoria." };
  refreshCategories();
  return { status: "ok", message: "Categoria excluída." };
}
