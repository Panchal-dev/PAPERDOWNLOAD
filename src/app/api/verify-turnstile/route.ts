// Turnstile verification API: status check + token exchange.
// GET reports cookie validity; POST validates a token and sets the cookie.

import { NextRequest, NextResponse } from "next/server";
import { CAPTCHA_CONFIG } from "@/config/captcha.config";
import { checkRateLimit, clientKey } from "@/server/rate-limit";
import {
  clearVerificationCookieHeader,
  isVerificationValueValid,
  turnstileEnforced,
  verificationCookieHeader,
  verifyTurnstileToken,
} from "@/server/turnstile-verify";

export const runtime = "nodejs";

const VERIFY_LIMIT = 30;
const VERIFY_WINDOW_MS = 60_000;

// Reports whether the caller already holds a valid verification cookie.
export async function GET(request: NextRequest) {
  if (!turnstileEnforced()) {
    return NextResponse.json({ verified: true, enforced: false });
  }
  const verified = isVerificationValueValid(
    request.cookies.get(CAPTCHA_CONFIG.cookieName)?.value,
  );
  return NextResponse.json({ verified, enforced: true });
}

// Validates a widget token with Cloudflare and issues the session cookie.
export async function POST(request: NextRequest) {
  if (
    !checkRateLimit(
      clientKey(request.headers, "verify"),
      VERIFY_LIMIT,
      VERIFY_WINDOW_MS,
    )
  ) {
    return NextResponse.json({ error: "Too many attempts." }, { status: 429 });
  }
  const body = (await request.json().catch(() => null)) as {
    token?: unknown;
  } | null;
  const token = typeof body?.token === "string" ? body.token : "";
  const forwarded = request.headers.get("x-forwarded-for");
  const ip = forwarded?.split(",")[0]?.trim();

  const ok = await verifyTurnstileToken(token, ip);
  if (!ok) {
    const response = NextResponse.json(
      { verified: false, error: "Verification failed. Retry." },
      { status: 400 },
    );
    response.headers.set("Set-Cookie", clearVerificationCookieHeader());
    return response;
  }
  const response = NextResponse.json({ verified: true });
  response.headers.set("Set-Cookie", verificationCookieHeader());
  return response;
}
