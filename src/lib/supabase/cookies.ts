import type { CookieOptions, CookieOptionsWithName } from "@supabase/ssr";

// Auth cookies: HTTPS-only in production and not sent on cross-site POSTs (lax). They cannot be
// httpOnly because the browser client reads the session; the strict CSP is what protects them
// from XSS.
export const authCookieOptions: CookieOptionsWithName = {
  path: "/",
  sameSite: "lax",
  secure: process.env.NODE_ENV === "production",
};

/** A session idle for this long must sign in again (the cookie is rewritten on every refresh). */
export const AUTH_COOKIE_MAX_AGE = 60 * 60 * 24 * 30;

/**
 * @supabase/ssr always writes auth cookies with a 400-day maxAge and ignores cookieOptions.maxAge,
 * so every cookie writer (server, proxy, browser) passes its options through this cap.
 */
export function capCookieOptions(options: CookieOptions = {}): CookieOptions {
  if (options.maxAge === 0) return options; // deletion
  return { ...options, maxAge: Math.min(options.maxAge ?? AUTH_COOKIE_MAX_AGE, AUTH_COOKIE_MAX_AGE) };
}
