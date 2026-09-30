import { createBrowserClient, parseCookieHeader, serializeCookieHeader } from "@supabase/ssr";

import { publicEnv } from "@/lib/env/public";

import { authCookieOptions, capCookieOptions } from "./cookies";
import type { Database } from "./database.types";

export function createClient() {
  return createBrowserClient<Database>(
    publicEnv.NEXT_PUBLIC_SUPABASE_URL,
    publicEnv.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY,
    {
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
    },
  );
}
