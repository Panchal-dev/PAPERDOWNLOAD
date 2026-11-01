// Unique visitor counter — backed by Upstash Redis HyperLogLog.
//
// POST /api/visitors  { visitorId: UUID }
//   → Adds the visitorId to the HyperLogLog set and returns the new count.
//   → HyperLogLog: O(1) space (~12 KB max), ±0.81% error, no PII stored.
//
// GET /api/visitors
//   → Returns current unique count without modifying the set.
//
// Both methods are rate-limited with Upstash's distributed sliding window, so
// one client cannot inflate the count or burn the Redis quota. PFADD + PFCOUNT
// run in a single pipeline request. If env vars are absent (local dev), both
// endpoints return count: 0 instead of crashing.

import { Ratelimit } from "@upstash/ratelimit";
import { Redis } from "@upstash/redis";
import { type NextRequest, NextResponse } from "next/server";
import { clientKey } from "@/server/rate-limit";

export const runtime = "nodejs";

const REDIS_URL = process.env.UPSTASH_REDIS_REST_URL;
const REDIS_TOKEN = process.env.UPSTASH_REDIS_REST_TOKEN;
const HLL_KEY = "gtu:unique_visitors";

// RFC 4122 shape (versions 1–8, variant 8/9/a/b). The client sends a v4 UUID.
const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

// A visitor payload is tiny; reject anything that could be used to waste RAM.
const MAX_BODY_BYTES = 1_024;

const redis =
  REDIS_URL && REDIS_TOKEN
    ? new Redis({ url: REDIS_URL, token: REDIS_TOKEN })
    : null;

const ratelimit = redis
  ? new Ratelimit({
      redis,
      limiter: Ratelimit.slidingWindow(10, "1 m"),
      prefix: "gtu:rl:visitors",
      analytics: false,
    })
  : null;

// Fails open: the counter is decorative, so a Redis hiccup must not break it.
async function allow(headers: Headers, scope: string): Promise<boolean> {
  if (!ratelimit) return true;
  try {
    const result = await ratelimit.limit(clientKey(headers, scope));
    return result.success;
  } catch {
    return true;
  }
}

function tooMany(): NextResponse {
  return NextResponse.json(
    { error: "Too many requests." },
    { status: 429, headers: { "Retry-After": "60" } },
  );
}

// GET — read current unique visitor count (no mutation).
export async function GET(request: NextRequest): Promise<NextResponse> {
  if (!(await allow(request.headers, "visitors:get"))) return tooMany();
  if (!redis) return NextResponse.json({ count: 0 });

  try {
    const count = await redis.pfcount(HLL_KEY);
    return NextResponse.json({ count });
  } catch {
    // Degraded: return 0 so the UI still renders without crashing.
    return NextResponse.json({ count: 0 });
  }
}

// POST — register a visitor + return the updated count.
export async function POST(request: NextRequest): Promise<NextResponse> {
  if (!(await allow(request.headers, "visitors:post"))) return tooMany();

  const declaredLength = Number(request.headers.get("content-length") ?? 0);
  if (declaredLength > MAX_BODY_BYTES) {
    return NextResponse.json({ error: "Request body too large" }, { status: 413 });
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const visitorId = (body as { visitorId?: unknown } | null)?.visitorId;
  if (typeof visitorId !== "string" || !UUID_PATTERN.test(visitorId)) {
    return NextResponse.json(
      { error: "visitorId must be a UUID" },
      { status: 400 },
    );
  }

  // Validated input, but no Redis configured (local dev): stay degraded.
  if (!redis) return NextResponse.json({ count: 0 });

  try {
    // PFADD returns 1 when the set changed; PFCOUNT returns the new total.
    // One pipeline round trip instead of two.
    const [, count] = await redis
      .pipeline()
      .pfadd(HLL_KEY, visitorId)
      .pfcount(HLL_KEY)
      .exec<[number, number]>();
    return NextResponse.json({ count });
  } catch {
    return NextResponse.json({ count: 0 });
  }
}
