// In-memory sliding-window rate limiter for API routes.
// Stateless across instances, but sufficient abuse protection for this tool.
// (The visitor counter additionally uses Upstash's distributed limiter.)

interface Bucket {
  hits: number[];
  windowMs: number;
}

const buckets = new Map<string, Bucket>();
const MAX_BUCKETS = 5_000;

// Drops expired buckets, then evicts the least-recently-used ones. The old
// `buckets.clear()` wiped every client's limit as soon as one attacker
// created enough keys.
function evictIfNeeded(now: number): void {
  if (buckets.size <= MAX_BUCKETS) return;

  for (const [key, bucket] of buckets) {
    const last = bucket.hits[bucket.hits.length - 1] ?? 0;
    if (now - last >= bucket.windowMs) buckets.delete(key);
  }

  while (buckets.size > MAX_BUCKETS) {
    const oldest = buckets.keys().next();
    if (oldest.done) break;
    buckets.delete(oldest.value);
  }
}

// Returns true when the request is allowed; false when the limit is hit.
export function checkRateLimit(
  key: string,
  limit: number,
  windowMs: number,
): boolean {
  const now = Date.now();
  evictIfNeeded(now);

  let bucket = buckets.get(key);
  if (bucket) {
    // Refresh insertion order so the cap evicts the least recently used key.
    buckets.delete(key);
  } else {
    bucket = { hits: [], windowMs };
  }
  bucket.hits = bucket.hits.filter((hit) => now - hit < windowMs);
  buckets.set(key, bucket);

  if (bucket.hits.length >= limit) return false;
  bucket.hits.push(now);
  return true;
}

// Derives a client key from proxy headers.
//
// Prefer `x-real-ip` (set by Vercel and most reverse proxies). Otherwise use
// the LAST `x-forwarded-for` entry: the rightmost value is the one appended by
// the nearest trusted proxy, while the leftmost is client-controlled and
// trivially spoofed off-Vercel.
export function clientKey(
  headers: Headers,
  scope: string,
  fallback = "anon",
): string {
  const realIp = headers.get("x-real-ip")?.trim();
  const forwarded = headers.get("x-forwarded-for");
  const forwardedIp = forwarded
    ?.split(",")
    .map((part) => part.trim())
    .filter(Boolean)
    .at(-1);
  return `${scope}:${realIp || forwardedIp || fallback}`;
}
