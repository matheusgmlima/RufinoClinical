"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";

import { getSessionUser } from "@/lib/auth/session";
import { createClient } from "@/lib/supabase/server";
import { isValidDocument, isValidPhone, onlyDigits } from "@/lib/validation/br";

export type FormState = {
  status: "idle" | "ok" | "error";
  message?: string;
  fieldErrors?: Record<string, string>;
};

const profileSchema = z.object({
  full_name: z.string().trim().min(2, "Informe seu nome.").max(120, "Nome muito longo."),
  phone: z
    .string()
    .transform(onlyDigits)
    .refine((v) => v === "" || isValidPhone(v), "Telefone inválido. Use DDD + número."),
  document: z
    .string()
    .transform(onlyDigits)
    .refine((v) => v === "" || isValidDocument(v), "CPF ou CNPJ inválido."),
  marketing_opt_in: z.boolean(),
});

function fieldErrors(error: z.ZodError) {
  return Object.fromEntries(error.issues.map((issue) => [String(issue.path[0]), issue.message]));
}

export async function updateProfile(_prev: FormState, formData: FormData): Promise<FormState> {
  const user = await getSessionUser();
  if (!user) return { status: "error", message: "Sua sessão expirou. Entre novamente." };

  const parsed = profileSchema.safeParse({
    full_name: formData.get("full_name") ?? "",
    phone: formData.get("phone") ?? "",
    document: formData.get("document") ?? "",
    marketing_opt_in: formData.get("marketing_opt_in") === "on",
  });
  if (!parsed.success) return { status: "error", fieldErrors: fieldErrors(parsed.error) };

  const { full_name, phone, document, marketing_opt_in } = parsed.data;
  const supabase = await createClient();
  // RLS limits the update to the caller's own row; column grants limit it to these fields.
  const { error } = await supabase
    .from("profiles")
    .update({ full_name, phone: phone || null, document: document || null, marketing_opt_in })
    .eq("id", user.id);
  if (error) return { status: "error", message: "Não foi possível salvar. Tente de novo." };

  revalidatePath("/conta", "layout");
  return { status: "ok", message: "Dados salvos." };
}
