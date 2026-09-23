// Cloudflare Turnstile configuration.
// The site key is public; the secret key must only live in env (server).

export const CAPTCHA_CONFIG = {
  // Public site key (NEXT_PUBLIC_TURNSTILE_SITE_KEY). Empty = verification disabled (dev).
  siteKey: process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY ?? "",
  // Widget script source.
  scriptUrl: "https://challenges.cloudflare.com/turnstile/v0/api.js",
  // Cookie + token lifetime in seconds (server enforces, client mirrors for UX).
  ttlSeconds: 2 * 60 * 60,
  // Cookie name holding the verified flag (HttpOnly, set by /api/verify-turnstile).
  cookieName: "gtu_tv",
} as const;
