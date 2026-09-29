import type { CookieOptionsWithName } from "@supabase/ssr";

// Auth cookies: HTTPS-only in production, not sent on cross-site POSTs (lax), 30-day lifetime
// instead of the library's 400-day default. They cannot be httpOnly because the browser client
// reads the session; the strict CSP is what protects them from XSS.
export const authCookieOptions: CookieOptionsWithName = {
  path: "/",
  sameSite: "lax",
  secure: process.env.NODE_ENV === "production",
  maxAge: 60 * 60 * 24 * 30,
};
