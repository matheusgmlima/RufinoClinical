import "server-only";
import { z } from "zod";

import { optional } from "./public";

// Secrets live only on the server. `server-only` makes any client import a build error.
const schema = z.object({
  // Bypasses RLS. Only for trusted server code (payment recording and webhooks).
  SUPABASE_SECRET_KEY: optional(z.string().startsWith("sb_secret_")),
  // Mercado Pago private credentials (Suas integrações → Credenciais / Webhooks).
  MP_ACCESS_TOKEN: optional(z.string().regex(/^(APP_USR|TEST)-[\w-]+$/)),
  MP_WEBHOOK_SECRET: optional(z.string().min(16)),
  // "true" only with test credentials: sends Mercado Pago's sandbox buyer instead of the real one.
  MP_TEST_MODE: optional(z.enum(["true", "false"])),
  // Resend (order e-mails). Sending needs a verified domain in Resend; unset, e-mails are skipped.
  RESEND_API_KEY: optional(z.string().regex(/^re_\w+$/)),
  // Sender with the verified domain, e.g. "Rufino Clinical <pedidos@dominio.com.br>".
  EMAIL_FROM: optional(z.string().regex(/^(.+ <[^\s@<>]+@[^\s@<>]+>|[^\s@<>]+@[^\s@<>]+)$/)),
  // Where customer replies go (the store's contact inbox).
  EMAIL_REPLY_TO: optional(z.email()),
});

export const serverEnv = schema.parse({
  SUPABASE_SECRET_KEY: process.env.SUPABASE_SECRET_KEY,
  MP_ACCESS_TOKEN: process.env.MP_ACCESS_TOKEN,
  MP_WEBHOOK_SECRET: process.env.MP_WEBHOOK_SECRET,
  MP_TEST_MODE: process.env.MP_TEST_MODE,
  RESEND_API_KEY: process.env.RESEND_API_KEY,
  EMAIL_FROM: process.env.EMAIL_FROM,
  EMAIL_REPLY_TO: process.env.EMAIL_REPLY_TO,
});
