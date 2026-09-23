// Server-side Cloudflare Turnstile verification + signed cookie helpers.
// The secret key never leaves the server; the client only sees true/false.
// The cookie is HMAC-signed (timestamp + signature), so bots cannot forge
// or extend verification — a static flag value would offer no protection.

import { createHmac, timingSafeEqual } from "node:crypto";
import { CAPTCHA_CONFIG } from "@/config/captcha.config";

const VERIFY_ENDPOINT = "https://challenges.cloudflare.com/turnstile/v0/siteverify";
const TOKEN_MIN_LENGTH = 10;
const COOKIE_VERSION = "v1";

// Reads the secret from env at call time (supports runtime injection).
function secretKey(): string {
  return process.env.TURNSTILE_SECRET_KEY ?? "";
}

// True when enforcement is configured (both keys present).
export function turnstileEnforced(): boolean {
  return CAPTCHA_CONFIG.siteKey.length > 0 && secretKey().length > 0;
}

// Validates a widget token against Cloudflare's siteverify endpoint.
export async function verifyTurnstileToken(
  token: string,
  remoteIp?: string,
): Promise<boolean> {
  if (!turnstileEnforced()) return true;
  if (!token || token.length < TOKEN_MIN_LENGTH) return false;
  try {
    const response = await fetch(VERIFY_ENDPOINT, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        secret: secretKey(),
        response: token,
        ...(remoteIp ? { remoteip: remoteIp } : {}),
      }),
    });
    if (!response.ok) return false;
    const body = (await response.json()) as { success?: boolean };
    return body.success === true;
  } catch {
    return false;
  }
}

// Signs a timestamp into the cookie value: v1.<ms>.<hmac>.
function signTimestamp(timestamp: string): string {
  return createHmac("sha256", secretKey())
    .update(`${COOKIE_VERSION}.${timestamp}`)
    .digest("hex");
}

// Issues a fresh signed verification value for the Set-Cookie header.
export function issueVerificationValue(): string {
  const timestamp = Date.now().toString();
  return `${COOKIE_VERSION}.${timestamp}.${signTimestamp(timestamp)}`;
}

// Validates signature and age; rejects forged, tampered, or expired values.
export function isVerificationValueValid(value: string | undefined): boolean {
  if (!value) return false;
  const parts = value.split(".");
  if (parts.length !== 3 || parts[0] !== COOKIE_VERSION) return false;
  const timestamp = parts[1];
  const signature = parts[2];
  const age = Date.now() - Number(timestamp);
  if (
    !Number.isFinite(age) ||
    age < 0 ||
    age > CAPTCHA_CONFIG.ttlSeconds * 1000
  ) {
    return false;
  }
  const expected = signTimestamp(timestamp);
  if (signature.length !== expected.length) return false;
  return timingSafeEqual(Buffer.from(signature), Buffer.from(expected));
}

// Cookie attributes for the verified flag (HttpOnly, same-site, expiry).
export function verificationCookieHeader(): string {
  const maxAge = CAPTCHA_CONFIG.ttlSeconds;
  const secure = process.env.NODE_ENV === "production" ? "; Secure" : "";
  return `${CAPTCHA_CONFIG.cookieName}=${issueVerificationValue()}; Path=/; Max-Age=${maxAge}; HttpOnly; SameSite=Lax${secure}`;
}

// Clears the verification cookie (used when tokens are rejected).
export function clearVerificationCookieHeader(): string {
  return `${CAPTCHA_CONFIG.cookieName}=; Path=/; Max-Age=0; HttpOnly; SameSite=Lax`;
}
