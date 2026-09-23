// Temporary file store — backed by Vercel Blob Storage.
//
// Why Blob instead of /tmp:
//   Vercel serverless functions are stateless containers. Files written to
//   /tmp on container A are invisible to container B that serves the next
//   request. Vercel Blob is a shared object store — every container sees the
//   same files — so download links keep working across invocations.
//
// TTL strategy:
//   There is no native TTL in Vercel Blob. We tag each blob's pathname with
//   an ISO-date prefix (YYYY-MM-DD/) so a periodic cleanup (or the next
//   storeFile call) can delete any blob older than fileTtlHours.
//   Cleanup is best-effort and never fails the request.
//
// Local / offline fallback:
//   When BLOB_READ_WRITE_TOKEN is absent (local dev without Blob configured)
//   every function throws immediately so callers see clear errors instead of
//   silent data loss. Set the env var to enable Blob in production.

import { DOWNLOAD_CONFIG } from "@/config/download.config";

// ─── Types (inlined to avoid SDK import at module level) ─────────────────────

interface BlobPutResult {
  url: string;
  pathname: string;
  contentType: string;
  contentDisposition: string;
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

/** Today's UTC date string used as a blob path prefix, e.g. "2024-01-15". */
function todayPrefix(): string {
  return new Date().toISOString().slice(0, 10);
}

/**
 * Converts fileTtlHours into a Date cutoff.
 * Any blob whose pathname starts with a date before the cutoff is expired.
 */
function expiryDate(): Date {
  return new Date(Date.now() - DOWNLOAD_CONFIG.fileTtlHours * 3_600_000);
}

// ─── Core API ─────────────────────────────────────────────────────────────────

/**
 * Uploads a PDF buffer to Vercel Blob and returns its public URL.
 * Pathname: "<YYYY-MM-DD>/<filename>" so cleanup can target old prefixes.
 * Triggers a best-effort expiry sweep on each write (never blocks the caller).
 */
export async function storeFile(
  filename: string,
  bytes: Buffer,
): Promise<string> {
  const { put } = await import("@vercel/blob");

  const pathname = `${todayPrefix()}/${filename}`;
  const result: BlobPutResult = await put(pathname, bytes, {
    access: "public",
    contentType: "application/pdf",
    // Replaces an existing blob with the same name instead of duplicating.
    allowOverwrite: true,
  });

  // Fire-and-forget expiry sweep — never blocks the response.
  void evictExpiredBlobs().catch(() => undefined);

  return result.url;
}

/**
 * Deletes blobs whose date prefix is older than fileTtlHours.
 * Called opportunistically on each storeFile; safe to call independently.
 * Returns the number of blobs deleted.
 */
export async function evictExpiredBlobs(): Promise<number> {
  const { list, del } = await import("@vercel/blob");

  const cutoff = expiryDate();
  // Vercel Blob list() is paginated; cursor loop collects all blobs.
  let deleted = 0;
  let cursor: string | undefined;

  do {
    const page = await list({ cursor, limit: 100 });
    const expired = page.blobs.filter((blob) => {
      // Pathname format: "YYYY-MM-DD/filename.pdf"
      const datePart = blob.pathname.split("/")[0];
      if (!datePart || !/^\d{4}-\d{2}-\d{2}$/.test(datePart)) return false;
      return new Date(datePart) < cutoff;
    });

    if (expired.length > 0) {
      await del(expired.map((b) => b.url));
      deleted += expired.length;
    }

    cursor = page.cursor;
  } while (cursor);

  return deleted;
}
