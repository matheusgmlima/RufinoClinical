type CspOptions = {
  nonce: string;
  isDev: boolean;
  supabaseUrl: string;
};

/**
 * Strict, nonce-based Content Security Policy.
 * Scripts only run with the per-request nonce ('strict-dynamic' lets them load their own deps).
 * Styles allow 'unsafe-inline' because React/Next emit style attributes; CSS injection is low risk
 * compared with script injection, which stays fully locked down.
 */
export function buildCsp({ nonce, isDev, supabaseUrl }: CspOptions): string {
  const supabase = new URL(supabaseUrl);
  const supabaseHttp = supabase.origin;
  const supabaseWs = `wss://${supabase.host}`;

  const directives: Record<string, string[]> = {
    "default-src": ["'self'"],
    "script-src": ["'self'", `'nonce-${nonce}'`, "'strict-dynamic'", ...(isDev ? ["'unsafe-eval'"] : [])],
    "style-src": ["'self'", "'unsafe-inline'"],
    "img-src": ["'self'", "blob:", "data:", supabaseHttp],
    "font-src": ["'self'"],
    "connect-src": ["'self'", supabaseHttp, supabaseWs],
    "frame-src": ["'self'"],
    "worker-src": ["'self'", "blob:"],
    "object-src": ["'none'"],
    "base-uri": ["'self'"],
    "form-action": ["'self'"],
    "frame-ancestors": ["'none'"],
  };

  const policy = Object.entries(directives).map(([name, values]) => `${name} ${values.join(" ")}`);
  if (!isDev) policy.push("upgrade-insecure-requests");
  return policy.join("; ");
}

export function createNonce(): string {
  const bytes = new Uint8Array(16);
  crypto.getRandomValues(bytes);
  return btoa(String.fromCharCode(...bytes));
}
