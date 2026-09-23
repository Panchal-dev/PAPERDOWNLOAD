// Temporary file store for generated PDFs with TTL cleanup.
// No database: files live under DOWNLOAD_DIR and expire automatically.

import { promises as fs } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { DOWNLOAD_CONFIG } from "@/config/download.config";

const DEFAULT_SUBDIR = "gtu-papers";
const SAFE_FILENAME = /^[A-Z0-9][A-Z0-9_.-]*\.pdf$/i;

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
  // Best-effort expiry sweep on each write; never fails the request.
  void evictExpiredFiles().catch(() => undefined);
  return finalPath;
}

// Reads a stored file after validating the name (blocks path traversal).
export async function readStoredFile(filename: string): Promise<Buffer> {
  if (!SAFE_FILENAME.test(filename)) throw new Error("Unsafe filename");
  return fs.readFile(path.join(downloadDir(), filename));
}

// Deletes files older than the configured TTL.
// All stat() calls are fired in parallel (one OS batch), then expired
// entries are unlinked concurrently — much faster on large cache dirs.
export async function evictExpiredFiles(): Promise<number> {
  const dir = downloadDir();
  const entries = await fs.readdir(/*turbopackIgnore: true*/ dir).catch(() => []);
  const cutoff = Date.now() - DOWNLOAD_CONFIG.fileTtlHours * 3_600_000;

  // Resolve stat for every entry in parallel.
  const stats = await Promise.all(
    entries.map(async (entry) => {
      // Orphaned temp files are always removed immediately.
      if (entry.startsWith(".tmp-")) return { entry, expired: true };
      const stat = await fs.stat(path.join(dir, entry)).catch(() => null);
      return { entry, expired: stat !== null && stat.mtimeMs < cutoff };
    }),
  );

  // Unlink all expired files in parallel.
  const expired = stats.filter((s) => s.expired);
  await Promise.all(
    expired.map(({ entry }) =>
      fs.unlink(path.join(dir, entry)).catch(() => undefined),
    ),
  );
  return expired.length;
}
