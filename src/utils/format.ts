// Small formatting helpers for sizes, durations, and filenames.

import type { PaperFormat } from "@/types/paper.types";

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

// Extracts the subject code embedded in generated filenames for grouping.
// Matches against the requested subjects so course prefixes (e.g. BESP)
// are never mistaken for the subject code.
export function subjectFromFilename(
  filename: string,
  subjects: string[],
): string | null {
  const upper = filename.toUpperCase();
  for (const subject of subjects) {
    if (subject && upper.includes(`_${subject.toUpperCase()}_`)) {
      return subject.toUpperCase();
    }
  }
  return null;
}

// Maps a generated filename to its deliverable format for row badges.
export function formatFromFilename(filename: string): PaperFormat {
  const upper = filename.toUpperCase();
  if (upper.includes("_SYLLABUS.PDF")) return "syllabus";
  if (upper.endsWith("_SUMMER.PDF")) return "summer-pack";
  if (upper.endsWith("_WINTER.PDF")) return "winter-pack";
  if (upper.endsWith("_WINTER_SUMMER.PDF")) return "merged-winter-first";
  if (upper.endsWith("_INTERLEAVED.PDF")) return "merged-interleaved";
  if (upper.endsWith("_SUMMER_WINTER.PDF")) return "merged-summer-first";
  return "single";
}
