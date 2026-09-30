// Asserts the security posture of a running instance.
// Usage: node scripts/check-security.mjs [baseUrl]   (default http://localhost:3000)
// Exits non-zero on any failure, so CI blocks the merge.
const base = (process.argv[2] ?? "http://localhost:3000").replace(/\/$/, "");
const failures = [];
const check = (ok, message) => {
  console.log(`${ok ? "✓" : "✗"} ${message}`);
  if (!ok) failures.push(message);
};

async function get(path) {
  const res = await fetch(base + path, { redirect: "manual" });
  return { res, body: await res.text() };
}

const directive = (csp, name) =>
  csp
    .split(";")
    .map((d) => d.trim())
    .find((d) => d.startsWith(`${name} `)) ?? "";

// Page: headers
const { res, body } = await get("/");
const h = (name) => res.headers.get(name) ?? "";
check(res.status === 200, `GET / returns 200 (got ${res.status})`);
check(/max-age=\d{8,}/.test(h("strict-transport-security")), "HSTS with long max-age");
check(h("x-content-type-options") === "nosniff", "X-Content-Type-Options: nosniff");
check(h("x-frame-options") === "DENY", "X-Frame-Options: DENY");
check(h("referrer-policy") === "strict-origin-when-cross-origin", "Referrer-Policy strict-origin-when-cross-origin");
check(h("cross-origin-opener-policy") === "same-origin", "Cross-Origin-Opener-Policy: same-origin");
check(h("permissions-policy").includes("camera=()"), "Permissions-Policy disables camera/mic/geolocation");
check(!res.headers.has("x-powered-by"), "No X-Powered-By header");
check(/no-store|private/.test(h("cache-control")), "Dynamic HTML is not publicly cacheable");

// Page: CSP
const csp = h("content-security-policy");
const nonce = csp.match(/'nonce-([^']+)'/)?.[1];
check(Boolean(nonce), "CSP carries a per-request nonce");
check(directive(csp, "script-src").includes("'strict-dynamic'"), "script-src uses 'strict-dynamic'");
check(!directive(csp, "script-src").includes("'unsafe-inline'"), "script-src has no 'unsafe-inline'");
check(!csp.includes("'unsafe-eval'"), "CSP has no 'unsafe-eval' (production)");
check(directive(csp, "frame-ancestors") === "frame-ancestors 'none'", "frame-ancestors 'none'");
check(directive(csp, "object-src") === "object-src 'none'", "object-src 'none'");
check(directive(csp, "base-uri") === "base-uri 'self'", "base-uri 'self'");
check(directive(csp, "form-action") === "form-action 'self'", "form-action 'self'");
check(directive(csp, "default-src") === "default-src 'self'", "default-src 'self'");

// Page: every script tag carries the nonce from the header
const scripts = [...body.matchAll(/<script\b[^>]*>/g)].map((m) => m[0]);
const unsigned = scripts.filter((tag) => !tag.includes(`nonce="${nonce}"`));
check(scripts.length > 0 && unsigned.length === 0, `All ${scripts.length} <script> tags carry the response nonce`);

// Nonce is fresh per request
const second = await get("/");
const nonce2 = (second.res.headers.get("content-security-policy") ?? "").match(/'nonce-([^']+)'/)?.[1];
check(Boolean(nonce2) && nonce2 !== nonce, "Nonce changes on every request");

// A forged CSP request header must not leak into the response
const forged = await fetch(base + "/", {
  headers: { "content-security-policy": "script-src *", "x-nonce": "attacker" },
});
const forgedCsp = forged.headers.get("content-security-policy") ?? "";
check(!forgedCsp.includes("script-src *") && !forgedCsp.includes("nonce-attacker"), "Forged CSP/nonce request headers are ignored");

// Static SVG assets cannot execute script
const svg = await get("/brand/simbolo.svg");
const svgCsp = svg.res.headers.get("content-security-policy") ?? "";
check(svgCsp.includes("default-src 'none'") && svgCsp.includes("sandbox"), "Static SVGs served with sandboxed CSP");

// The payment webhook refuses unsigned notifications (401, or 503 while not configured)
const webhook = await fetch(`${base}/api/webhooks/mercadopago?data.id=ORD1&type=order`, { method: "POST", body: "{}" });
check([401, 503].includes(webhook.status), `Unsigned payment webhook is rejected (got ${webhook.status})`);

// Checkout and order pages require a session
const checkout = await get("/checkout");
check(checkout.res.status === 307 && (checkout.res.headers.get("location") ?? "").includes("/entrar"), "Checkout redirects anonymous visitors to login");

// The personal data export needs a session
const exportData = await get("/conta/exportar");
check(
  exportData.res.status === 303 && (exportData.res.headers.get("location") ?? "").includes("/entrar"),
  "Personal data export redirects anonymous visitors to login",
);

// Every admin page sends anonymous visitors to login (each page checks, not only the layout)
const adminPages = ["/admin", "/admin/pedidos", "/admin/produtos", "/admin/produtos/novo", "/admin/categorias", "/admin/cupons", "/admin/configuracoes", "/admin/auditoria", "/admin/verificar"];
const adminResults = await Promise.all(adminPages.map((path) => get(path)));
const leaked = adminPages.filter((_, i) => {
  const { res } = adminResults[i];
  return !(res.status === 307 && (res.headers.get("location") ?? "").includes("/entrar"));
});
check(!leaked.length, `Admin pages redirect anonymous visitors to login${leaked.length ? ` (not: ${leaked.join(", ")})` : ""}`);
const adminHtml = adminResults.map(({ body }) => body).join("");
check(!/data-admin-shell/.test(adminHtml), "Admin shell never renders for anonymous visitors");

// Unknown routes do not leak stack traces
const missing = await get("/__does-not-exist__");
check(missing.res.status === 404, "Unknown route returns 404");
check(!/at\s+\S+\s+\(.*:\d+:\d+\)/.test(missing.body), "404 page has no stack trace");

if (failures.length) {
  console.error(`\n${failures.length} security check(s) failed.`);
  process.exit(1);
}
console.log("\nAll security checks passed.");
