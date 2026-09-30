import { createBrowserClient, parseCookieHeader, serializeCookieHeader } from "@supabase/ssr";

import { authCookieOptions, capCookieOptions } from "./cookies";
import type { Database } from "./database.types";

// Inlined at build time and already validated on the server (src/lib/env/public.ts), so the
// browser bundle does not need zod.
const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const SUPABASE_KEY = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!;

export function createClient() {
  return createBrowserClient<Database>(SUPABASE_URL, SUPABASE_KEY, {
    cookieOptions: authCookieOptions,
    cookies: {
      getAll() {
        return parseCookieHeader(document.cookie).map(({ name, value }) => ({ name, value: value ?? "" }));
      },
      setAll(cookiesToSet) {
        cookiesToSet.forEach(({ name, value, options }) => {
          document.cookie = serializeCookieHeader(name, value, capCookieOptions(options));
        });
      },
    },
  });
}
