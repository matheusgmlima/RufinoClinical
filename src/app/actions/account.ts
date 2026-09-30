"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";

import { getSessionUser } from "@/lib/auth/session";
import { fieldErrors, type FormState } from "@/lib/forms";
import { createClient } from "@/lib/supabase/server";
import { isValidDocument, isValidPhone, onlyDigits } from "@/lib/validation/br";

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

const deleteSchema = z.object({
  confirm: z.string().trim().toUpperCase().pipe(z.literal("EXCLUIR", { error: "Digite EXCLUIR para confirmar." })),
});

/**
 * LGPD: deletes the signed-in customer's account (see delete_my_account in SQL). Orders stay as
 * legal records without the link to the account; everything else about the person goes.
 */
export async function deleteAccount(_prev: FormState, formData: FormData): Promise<FormState> {
  const user = await getSessionUser();
  if (!user) return { status: "error", message: "Sua sessão expirou. Entre novamente." };
  const parsed = deleteSchema.safeParse({ confirm: formData.get("confirm") ?? "" });
  if (!parsed.success) return { status: "error", fieldErrors: fieldErrors(parsed.error) };

  const supabase = await createClient();
  const { error } = await supabase.rpc("delete_my_account");
  if (error?.message.includes("orders_in_progress")) {
    return {
      status: "error",
      message: "Você tem um pedido em andamento. A exclusão fica disponível depois que ele for entregue ou cancelado.",
    };
  }
  if (error?.message.includes("admin_account")) {
    return { status: "error", message: "Contas da equipe não podem ser excluídas por aqui." };
  }
  if (error) return { status: "error", message: "Não foi possível excluir agora. Tente de novo em instantes." };

  // The user no longer exists; this only clears the session cookies in this browser.
  await supabase.auth.signOut({ scope: "local" });
  redirect("/conta-excluida");
}
