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
});

export const serverEnv = schema.parse({
  SUPABASE_SECRET_KEY: process.env.SUPABASE_SECRET_KEY,
  MP_ACCESS_TOKEN: process.env.MP_ACCESS_TOKEN,
  MP_WEBHOOK_SECRET: process.env.MP_WEBHOOK_SECRET,
});
