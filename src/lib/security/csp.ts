type CspOptions = {
  nonce: string;
  isDev: boolean;
  supabaseUrl: string;
};

// Mercado Pago card form (Card Payment Brick). Its scripts need no host entry: our nonced code
// loads the SDK and 'strict-dynamic' extends trust to what it loads. Allowed site-wide because a
// client-side navigation keeps the CSP of the page where the visit started.
const MP_CONNECT = [
  "https://api.mercadopago.com",
  "https://api-static.mercadopago.com",
  "https://secure-fields.mercadopago.com",
  "https://api.mercadolibre.com",
];
const MP_FRAMES = ["https://secure-fields.mercadopago.com", "https://api-static.mercadopago.com"];
const MP_ASSETS = "https://http2.mlstatic.com";
// Device fingerprint the SDK sends to Mercado Pago's anti-fraud (blocking it lowers card approval).
const MP_DEVICE = ["https://www.mercadolibre.com", "https://www.mercadolivre.com"];

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
    "img-src": ["'self'", "blob:", "data:", supabaseHttp, MP_ASSETS, ...MP_DEVICE],
    "font-src": ["'self'"],
    "connect-src": ["'self'", supabaseHttp, supabaseWs, ...MP_CONNECT, MP_ASSETS, ...MP_DEVICE],
    "frame-src": ["'self'", ...MP_FRAMES],
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
