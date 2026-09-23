// In-memory sliding-window rate limiter for API routes.
// Stateless across instances, but sufficient abuse protection for this tool.

interface Bucket {
  hits: number[];
}

const buckets = new Map<string, Bucket>();
const MAX_BUCKETS = 5_000;

// Returns true when the request is allowed; false when the limit is hit.
export function checkRateLimit(
  key: string,
  limit: number,
  windowMs: number,
): boolean {
  const now = Date.now();
  // Caps memory: drops the whole table if it ever grows unbounded.
  if (buckets.size > MAX_BUCKETS) buckets.clear();
  let bucket = buckets.get(key);
  if (!bucket) {
    bucket = { hits: [] };
    buckets.set(key, bucket);
  }
  bucket.hits = bucket.hits.filter((hit) => now - hit < windowMs);
  if (bucket.hits.length >= limit) return false;
  bucket.hits.push(now);
  return true;
}

// Derives a stable client key from proxy headers, falling back to "anon".
export function clientKey(
  headers: Headers,
  scope: string,
  fallback = "anon",
): string {
  const forwarded = headers.get("x-forwarded-for");
  const ip = forwarded?.split(",")[0]?.trim() || fallback;
  return `${scope}:${ip}`;
}
