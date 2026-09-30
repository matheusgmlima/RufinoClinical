import "server-only";
import { notFound, redirect } from "next/navigation";
import { cache } from "react";

import { createClient } from "@/lib/supabase/server";

import { getSessionUser, requireUser } from "./session";

type AdminStatus = "none" | "mfa_required" | "ok";

/** The caller's admin state (see public.admin_status in SQL). Non-admins cannot tell the panel exists. */
export const getAdminStatus = cache(async (): Promise<AdminStatus> => {
  if (!(await getSessionUser())) return "none";
  const { data } = await (await createClient()).rpc("admin_status");
  return data === "ok" || data === "mfa_required" ? data : "none";
});

/**
 * Guard for every admin page. Layouts do not protect pages, so each page calls this itself.
 * Signed out → login; admin without MFA this session → second factor; anyone else → 404.
 */
export async function requireAdmin() {
  const user = await requireUser("/admin");
  const status = await getAdminStatus();
  if (status === "mfa_required") redirect("/admin/verificar");
  if (status !== "ok") notFound();
  return { user, supabase: await createClient() };
}

/** Guard for admin server actions: null unless the caller is an admin with MFA. RLS checks again. */
export async function adminClient() {
  return (await getAdminStatus()) === "ok" ? createClient() : null;
}
