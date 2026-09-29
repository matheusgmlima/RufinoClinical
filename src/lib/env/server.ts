import "server-only";
import { z } from "zod";

// Secrets live only on the server. `server-only` makes any client import a build error.
const schema = z.object({
  // Bypasses RLS. Only for trusted server code (webhooks, order creation).
  SUPABASE_SECRET_KEY: z.string().startsWith("sb_secret_").optional(),
});

export const serverEnv = schema.parse({
  SUPABASE_SECRET_KEY: process.env.SUPABASE_SECRET_KEY,
});
