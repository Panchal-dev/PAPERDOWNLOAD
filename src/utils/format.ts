// Small formatting helpers for sizes and durations.

const BYTES_PER_KB = 1024;

// Human-readable file size ("245.3 KB", "3.1 MB").
export function formatBytes(bytes: number): string {
  if (!Number.isFinite(bytes) || bytes <= 0) return "0 B";
  if (bytes < BYTES_PER_KB) return `${bytes} B`;
  const kb = bytes / BYTES_PER_KB;
  if (kb < BYTES_PER_KB) return `${kb.toFixed(1)} KB`;
  return `${(kb / BYTES_PER_KB).toFixed(1)} MB`;
}

// Elapsed milliseconds rendered as the API does ("12.4s").
export function formatDuration(ms: number): string {
  return `${(Math.round(ms / 100) / 10).toFixed(1)}s`;
}
