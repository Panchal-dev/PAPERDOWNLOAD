// Temporary file store for generated PDFs with TTL cleanup.
// No database: files live under DOWNLOAD_DIR and expire automatically.

import { promises as fs, createReadStream } from "node:fs";
import type { Readable } from "node:stream";
import { tmpdir } from "node:os";
import path from "node:path";
import { DOWNLOAD_CONFIG } from "@/config/download.config";

const DEFAULT_SUBDIR = "gtu-papers";
const SAFE_FILENAME = /^[A-Z0-9][A-Z0-9_.-]*\.pdf$/i;

// TTL sweep throttle. TTL is 6 hours, so sweeping every 5 minutes is more
// than enough. Previously every storeFile() triggered a full readdir +
// stat + unlink pass — 20 writes meant 20 sweeps = ~400 syscalls per
// request. Now ~20.
let lastSweepAt = 0;
const SWEEP_INTERVAL_MS = 5 * 60_000;

// Resolves the download directory (env override, else OS temp dir).
export function downloadDir(): string {
  return process.env.DOWNLOAD_DIR ?? path.join(tmpdir(), DEFAULT_SUBDIR);
}

// Writes a file atomically (temp + rename) to avoid partial downloads.
export async function storeFile(
  filename: string,
  bytes: Buffer,
): Promise<string> {
  if (!SAFE_FILENAME.test(filename)) throw new Error("Unsafe filename");
  const dir = downloadDir();
  await fs.mkdir(dir, { recursive: true });
  const tempName = `.tmp-${Date.now()}-${Math.random().toString(36).slice(2)}`;
  const tempPath = path.join(dir, tempName);
  const finalPath = path.join(dir, filename);
  await fs.writeFile(tempPath, bytes);
  await fs.rename(tempPath, finalPath);

  // Best-effort, throttled expiry sweep — never fails the request.
  const now = Date.now();
  if (now - lastSweepAt > SWEEP_INTERVAL_MS) {
    lastSweepAt = now;
    void evictExpiredFiles().catch(() => undefined);
  }
  return finalPath;
}

// Reads a stored file after validating the name (blocks path traversal).
// Used by the archive (.zip) route, which needs the full bytes to bundle.
export async function readStoredFile(filename: string): Promise<Buffer> {
  if (!SAFE_FILENAME.test(filename)) throw new Error("Unsafe filename");
  return fs.readFile(path.join(downloadDir(), filename));
}

// Opens a stored file as a Node Readable stream for chunk-by-chunk
// serving. Serving through this instead of readStoredFile drops peak
// memory from ~file size per concurrent request to ~64 KB (one chunk).
export async function openStoredFileStream(
  filename: string,
): Promise<Readable> {
  if (!SAFE_FILENAME.test(filename)) throw new Error("Unsafe filename");
  const filePath = path.join(downloadDir(), filename);
  // Pre-check readability: createReadStream() emits errors asynchronously,
  // which would arrive after we have already sent HTTP 200 — the client
  // would see a truncated response instead of a clean 404.
  await fs.access(filePath, fs.constants.R_OK);
  return createReadStream(filePath);
}

// Deletes files older than the configured TTL.
export async function evictExpiredFiles(): Promise<number> {
  const dir = downloadDir();
  const entries = await fs
    .readdir(/*turbopackIgnore: true*/ dir)
    .catch(() => []);
  const cutoff = Date.now() - DOWNLOAD_CONFIG.fileTtlHours * 3_600_000;

  const stats = await Promise.all(
    entries.map(async (entry) => {
      // Orphaned temp files are always removed immediately.
      if (entry.startsWith(".tmp-")) return { entry, expired: true };
      const stat = await fs.stat(path.join(dir, entry)).catch(() => null);
      return { entry, expired: stat !== null && stat.mtimeMs < cutoff };
    }),
  );

  const expired = stats.filter((s) => s.expired);
  await Promise.all(
    expired.map(({ entry }) =>
      fs.unlink(path.join(dir, entry)).catch(() => undefined),
    ),
  );
  return expired.length;
}
