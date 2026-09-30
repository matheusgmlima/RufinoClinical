"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";

import { getSessionUser } from "@/lib/auth/session";
import { fieldErrors, type FormState } from "@/lib/forms";
import { createClient } from "@/lib/supabase/server";
import { onlyDigits, UFS } from "@/lib/validation/br";

const text = (min: number, max: number, message: string) => z.string().trim().min(min, message).max(max, message);

const addressSchema = z.object({
  id: z.union([z.uuid(), z.literal("")]),
  label: z.string().trim().max(40, "Máximo de 40 caracteres."),
  recipient_name: text(2, 120, "Informe quem vai receber."),
  zip_code: z.string().transform(onlyDigits).refine((v) => v.length === 8, "CEP inválido."),
  street: text(2, 160, "Informe a rua."),
  number: text(1, 20, "Informe o número (ou S/N)."),
  complement: z.string().trim().max(80, "Máximo de 80 caracteres."),
  district: text(2, 80, "Informe o bairro."),
  city: text(2, 80, "Informe a cidade."),
  state: z.enum(UFS, { error: "Selecione o estado." }),
  is_default: z.boolean(),
});

export async function saveAddress(_prev: FormState, formData: FormData): Promise<FormState> {
  const user = await getSessionUser();
  if (!user) return { status: "error", message: "Sua sessão expirou. Entre novamente." };

  const parsed = addressSchema.safeParse({
    id: formData.get("id") ?? "",
    label: formData.get("label") ?? "",
    recipient_name: formData.get("recipient_name") ?? "",
    zip_code: formData.get("zip_code") ?? "",
    street: formData.get("street") ?? "",
    number: formData.get("number") ?? "",
    complement: formData.get("complement") ?? "",
    district: formData.get("district") ?? "",
    city: formData.get("city") ?? "",
    state: formData.get("state") ?? "",
    is_default: formData.get("is_default") === "on",
  });
  if (!parsed.success) {
    return { status: "error", fieldErrors: fieldErrors(parsed.error) };
  }

  const { id, ...fields } = parsed.data;
  const values = { ...fields, label: fields.label || null, complement: fields.complement || null };
  const supabase = await createClient();

  // Only one default per user (unique index): clear the current one first.
  if (values.is_default) {
    await supabase.from("addresses").update({ is_default: false }).eq("user_id", user.id).eq("is_default", true);
  }

  const { error } = id
    ? await supabase.from("addresses").update(values).eq("id", id)
    : await supabase.from("addresses").insert(values);
  if (error) {
    const limit = error.message.includes("address limit");
    return {
      status: "error",
      message: limit ? "Você chegou ao limite de 10 endereços. Remova um para adicionar outro." : "Não foi possível salvar o endereço.",
    };
  }

  revalidatePath("/conta/enderecos");
  return { status: "ok", message: "Endereço salvo." };
}

export async function deleteAddress(id: string): Promise<void> {
  if (!z.uuid().safeParse(id).success || !(await getSessionUser())) return;
  const supabase = await createClient();
  await supabase.from("addresses").delete().eq("id", id); // RLS: own rows only
  revalidatePath("/conta/enderecos");
}

export async function setDefaultAddress(id: string): Promise<void> {
  const user = await getSessionUser();
  if (!z.uuid().safeParse(id).success || !user) return;
  const supabase = await createClient();
  await supabase.from("addresses").update({ is_default: false }).eq("user_id", user.id).eq("is_default", true);
  await supabase.from("addresses").update({ is_default: true }).eq("id", id);
  revalidatePath("/conta/enderecos");
}

const viaCepSchema = z.object({
  logradouro: z.string(),
  bairro: z.string(),
  localidade: z.string(),
  uf: z.enum(UFS),
});

export type CepResult = { street: string; district: string; city: string; state: (typeof UFS)[number] } | null;

/** Address lookup by CEP (ViaCEP), server-side so the browser never talks to third parties. */
export async function lookupCep(cep: string): Promise<CepResult> {
  const digits = onlyDigits(String(cep));
  if (digits.length !== 8 || !(await getSessionUser())) return null;
  try {
    const res = await fetch(`https://viacep.com.br/ws/${digits}/json/`, {
      signal: AbortSignal.timeout(4000),
      cache: "force-cache",
    });
    if (!res.ok) return null;
    const parsed = viaCepSchema.safeParse(await res.json());
    if (!parsed.success) return null;
    const { logradouro, bairro, localidade, uf } = parsed.data;
    return { street: logradouro, district: bairro, city: localidade, state: uf };
  } catch {
    return null;
  }
}
