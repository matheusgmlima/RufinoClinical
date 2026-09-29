import type { NextConfig } from "next";

const supabaseHost = process.env.NEXT_PUBLIC_SUPABASE_URL
  ? new URL(process.env.NEXT_PUBLIC_SUPABASE_URL).hostname
  : undefined;

// Static security headers for every response. The CSP is per-request (nonce) and set in src/proxy.ts.
const securityHeaders = [
  { key: "Strict-Transport-Security", value: "max-age=63072000; includeSubDomains; preload" },
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "X-Frame-Options", value: "DENY" },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  { key: "Cross-Origin-Opener-Policy", value: "same-origin" },
  { key: "X-Permitted-Cross-Domain-Policies", value: "none" },
  {
    key: "Permissions-Policy",
    value: "camera=(), microphone=(), geolocation=(), browsing-topics=(), payment=(self)",
  },
];

const svgCsp = "default-src 'none'; style-src 'unsafe-inline'; sandbox";

const nextConfig: NextConfig = {
  poweredByHeader: false,
  async headers() {
    return [
      { source: "/:path*", headers: securityHeaders },
      // Static SVGs skip the proxy; lock them down so an SVG can never run script.
      { source: "/brand/:path*", headers: [{ key: "Content-Security-Policy", value: svgCsp }] },
      { source: "/icon.svg", headers: [{ key: "Content-Security-Policy", value: svgCsp }] },
    ];
  },
  images: {
    remotePatterns: supabaseHost
      ? [{ protocol: "https", hostname: supabaseHost, pathname: "/storage/v1/object/public/product-images/**" }]
      : [],
  },
};

export default nextConfig;
