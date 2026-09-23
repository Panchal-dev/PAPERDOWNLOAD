// Unique visitor counter — backed by Upstash Redis HyperLogLog.
//
// POST /api/visitors  { visitorId: string }
//   → Adds the visitorId to the HyperLogLog set and returns the new count.
//   → HyperLogLog: O(1) space (~12 KB max), ±0.81% error, no PII stored.
//
// GET /api/visitors
//   → Returns current unique count without modifying the set.
//   → Used for SSR-primed initial render so the client shows a real number immediately.
//
// Graceful degradation: if env vars are absent (local dev without Upstash),
// both endpoints return count: 0 instead of crashing.

import { type NextRequest, NextResponse } from "next/server";

const REDIS_URL = process.env.UPSTASH_REDIS_REST_URL;
const REDIS_TOKEN = process.env.UPSTASH_REDIS_REST_TOKEN;
const HSET_KEY = "gtu:unique_visitors";

// Thin Upstash REST helper — commands go as URL path segments:
//   POST {REDIS_URL}/{COMMAND}/{arg1}/{arg2}...
//   Authorization: Bearer {REDIS_TOKEN}
// No SDK needed; native fetch is Edge-runtime compatible and keeps bundle tiny.
async function redisCommand<T = unknown>(
  ...args: (string | number)[]
): Promise<T> {
  if (!REDIS_URL || !REDIS_TOKEN) throw new Error("Upstash env vars not set");
  // Encode each arg so keys/values with special chars are safe in the URL path.
  const path = args.map((a) => encodeURIComponent(String(a))).join("/");
  const res = await fetch(`${REDIS_URL}/${path}`, {
    method: "GET",
    headers: {
      Authorization: `Bearer ${REDIS_TOKEN}`,
    },
    // Never cache Redis calls — we always want the live count.
    cache: "no-store",
  });
  if (!res.ok) throw new Error(`Redis error: ${res.status}`);
  const json = (await res.json()) as { result: T };
  return json.result;
}

// GET — read current unique visitor count (no mutation).
export async function GET(): Promise<NextResponse> {
  try {
    const count = await redisCommand<number>("PFCOUNT", HSET_KEY);
    return NextResponse.json({ count }, { status: 200 });
  } catch {
    // Degraded: return 0 so the UI still renders without crashing.
    return NextResponse.json({ count: 0 }, { status: 200 });
  }
}

// POST — register a visitor + return the updated count.
export async function POST(request: NextRequest): Promise<NextResponse> {
  try {
    const body = (await request.json()) as { visitorId?: string };
    const visitorId = body.visitorId?.trim();

    // Basic sanity check — must be a non-empty string ≤128 chars.
    if (!visitorId || visitorId.length > 128) {
      return NextResponse.json({ error: "Invalid visitorId" }, { status: 400 });
    }

    // PFADD returns 1 if the set was changed (new visitor), 0 if already present.
    await redisCommand<number>("PFADD", HSET_KEY, visitorId);
    const count = await redisCommand<number>("PFCOUNT", HSET_KEY);

    return NextResponse.json({ count }, { status: 200 });
  } catch {
    return NextResponse.json({ count: 0 }, { status: 200 });
  }
}
