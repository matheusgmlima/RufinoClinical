import { z } from "zod";

/** Treats an empty variable (`NAME=` in .env files) as not set. */
export const optional = <T extends z.ZodType>(schema: T) =>
  z.preprocess((value) => (value === "" ? undefined : value), schema.optional());

// NEXT_PUBLIC_* values are inlined at build time, so each one must be read with a static
// `process.env.NAME` expression (no dynamic lookup).
const schema = z.object({
  NEXT_PUBLIC_SITE_URL: z.url(),
  NEXT_PUBLIC_SUPABASE_URL: z.url(),
  NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: z.string().startsWith("sb_publishable_"),
  // Mercado Pago public key: only identifies the account to the card form (tokenization).
  NEXT_PUBLIC_MP_PUBLIC_KEY: optional(z.string().regex(/^(APP_USR|TEST)-[\w-]+$/)),
});

export const publicEnv = schema.parse({
  NEXT_PUBLIC_SITE_URL: process.env.NEXT_PUBLIC_SITE_URL,
  NEXT_PUBLIC_SUPABASE_URL: process.env.NEXT_PUBLIC_SUPABASE_URL,
  NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY,
  NEXT_PUBLIC_MP_PUBLIC_KEY: process.env.NEXT_PUBLIC_MP_PUBLIC_KEY,
});
