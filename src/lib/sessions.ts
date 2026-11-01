// Exam sessions: S = Summer (May/June), W = Winter (Nov/Dec).
// The range runs from DOWNLOAD_CONFIG.firstYear up to the CURRENT year,
// so new sessions are picked up automatically every year.

import { DOWNLOAD_CONFIG } from "@/config/download.config";

export function sessionsUpTo(lastYear: number = new Date().getFullYear()): string[] {
  const out: string[] = [];
  for (let year = lastYear; year >= DOWNLOAD_CONFIG.firstYear; year -= 1) {
    out.push(`W${year}`, `S${year}`);
  }
  return out; // newest first
}

// Chronological key: S2017 < W2017 < S2018 < W2018 ...
export function chronoKey(session: string): number {
  const year = Number(session.slice(1));
  return year * 2 + (session[0] === "W" ? 1 : 0);
}

export function sortChronological(sessions: string[]): string[] {
  return [...sessions].sort((a, b) => chronoKey(a) - chronoKey(b));
}

export function sortNewestFirst(sessions: string[]): string[] {
  return [...sessions].sort((a, b) => chronoKey(b) - chronoKey(a));
}
