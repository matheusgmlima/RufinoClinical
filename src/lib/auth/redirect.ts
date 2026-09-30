/**
 * Only same-site paths are allowed as a post-login destination, so a crafted link like
 * /entrar?next=https://evil.example cannot bounce the user off-site (open redirect).
 */
export function safeNext(value: string | null | undefined, fallback = "/conta"): string {
  if (!value || typeof value !== "string") return fallback;
  if (!value.startsWith("/") || value.startsWith("//") || value.startsWith("/\\")) return fallback;
  if (/[\u0000-\u001f]/.test(value) || value.includes("\\")) return fallback;
  try {
    const url = new URL(value, "https://site.invalid");
    if (url.origin !== "https://site.invalid") return fallback;
    return url.pathname + url.search;
  } catch {
    return fallback;
  }
}
