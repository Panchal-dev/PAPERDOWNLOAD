// Client-visible API configuration.
// Only NEXT_PUBLIC_* values may appear here; secrets stay server-side.
// Note: downloads stream (NDJSON) with no client timeout by design —
// the stream ends when the server finishes (bounded by maxDuration).

export const API_CONFIG = {
  downloadPath: "/api/download",
  filePathPrefix: "/api/files/",
  verifyPath: "/api/verify-turnstile",
} as const;
