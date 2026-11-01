// Next.js config: security headers. No captcha / third-party scripts.
// Nothing secret here — secrets only enter via environment variables.

import type { NextConfig } from "next";
import { DOWNLOAD_CONFIG } from "./src/config/download.config";

const isProduction = process.env.NODE_ENV === "production";

// The browser fetches papers straight from GTU, so that origin must stay in
// connect-src. Everything else is same-origin. 'unsafe-inline' is required by
// Next's bootstrap scripts and the no-flash theme script; a nonce-based CSP
// would force every page to render dynamically, which this app does not need.
const CSP = [
  "default-src 'self'",
  `script-src 'self' 'unsafe-inline'${isProduction ? "" : " 'unsafe-eval'"}`,
  "style-src 'self' 'unsafe-inline'",
  "img-src 'self' data: blob:",
  "font-src 'self'",
  "media-src 'self'",
  "worker-src 'self' blob:",
  `connect-src 'self' ${new URL(DOWNLOAD_CONFIG.gtuBaseUrl).origin}${isProduction ? "" : " ws: wss:"}`,
  "frame-src 'self' blob:",
  "frame-ancestors 'none'",
  "base-uri 'self'",
  "form-action 'self'",
  "object-src 'self' blob:",
  "manifest-src 'self'",
].join("; ");

const SECURITY_HEADERS = [
  { key: "Content-Security-Policy", value: CSP },
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "X-Frame-Options", value: "DENY" },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  {
    key: "Permissions-Policy",
    value: "camera=(), microphone=(), geolocation=()",
  },
  { key: "Cross-Origin-Opener-Policy", value: "same-origin" },
  ...(isProduction
    ? [
        {
          key: "Strict-Transport-Security",
          value: "max-age=31536000; includeSubDomains",
        },
      ]
    : []),
];

const nextConfig: NextConfig = {
  // NEXT_OUTPUT=standalone builds a self-contained server (node server.js)
  // for a plain Node box; Vercel ignores this and uses its own output.
  ...(process.env.NEXT_OUTPUT === "standalone" ? { output: "standalone" as const } : {}),
  // Hides the floating dev-mode badge so the UI looks production-clean
  // even while running `next dev`.
  devIndicators: false,
  async headers() {
    return [{ source: "/:path*", headers: SECURITY_HEADERS }];
  },
};

export default nextConfig;
