// Upstream GTU fetching: direct PDF URLs with retries, host fallback,
// and strict %PDF validation.
//
// Determinism contract (why results no longer vary between runs):
//   404              → null, no retry (definitive miss on GTU static host)
//   429 / 5xx        → retry with backoff, then fallback host
//   timeout          → retry with backoff, then fallback host
//   network error    → retry with backoff, then fallback host
//   non-PDF 200 body → retry with backoff, then fallback host
//   fallback host 404→ null, no retry (definitive miss on both hosts)

import { DOWNLOAD_CONFIG } from "@/config/download.config";
import type { SessionAsset, SubjectPapers } from "@/types/paper.types";

const PDF_MAGIC = "%PDF";
const RETRY_BASE_DELAY_MS = 400;
const RETRYABLE_STATUS = new Set([408, 425, 429, 500, 502, 503, 504]);

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

// Jittered exponential backoff: 400ms, 800ms, 1600ms (+ up to 200ms noise).
function backoffMs(attempt: number): number {
  return RETRY_BASE_DELAY_MS * 2 ** attempt + Math.random() * 200;
}

// Builds the canonical GTU paper URL on a given host.
function buildPaperUrl(
  host: string,
  course: string,
  subject: string,
  session: string,
): string {
  return `${host}/${session}/${course}/${subject}.pdf`;
}

function hasPdfMagic(bytes: Buffer): boolean {
  return bytes
    .subarray(0, PDF_MAGIC.length)
    .toString("ascii")
    .startsWith(PDF_MAGIC);
}

// Fetches one URL with timeout, bounded retries, and %PDF validation.
// Retries on: timeout, network error, 429/5xx, non-PDF 200 bodies.
// Does NOT retry 404 — that is a definitive miss on this host.
async function fetchWithRetries(
  url: string,
  maxRetries: number = DOWNLOAD_CONFIG.maxRetries,
): Promise<Buffer | null> {
  for (let attempt = 0; attempt <= maxRetries; attempt += 1) {
    const controller = new AbortController();
    const timer = setTimeout(
      () => controller.abort(),
      DOWNLOAD_CONFIG.fetchTimeoutMs,
    );
    try {
      const response = await fetch(url, {
        signal: controller.signal,
        cache: "no-store", // always live bytes from GTU
        headers: {
          "User-Agent":
            "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 " +
            "(KHTML, like Gecko) Chrome/140.0 Safari/537.36",
          Accept: "application/pdf,*/*",
          Connection: "keep-alive",
        },
      });

      // 404 = definitively missing on THIS host. Move on.
      if (response.status === 404) return null;

      // Transient server / rate-limit errors — retry.
      if (RETRYABLE_STATUS.has(response.status)) {
        if (attempt < maxRetries) {
          await sleep(backoffMs(attempt));
          continue;
        }
        return null;
      }

      // Other non-2xx: treat as a miss for this host.
      if (!response.ok) return null;

      const bytes = Buffer.from(await response.arrayBuffer());

      // Guard against HTML error pages served with HTTP 200.
      if (
        bytes.length < DOWNLOAD_CONFIG.minPdfBytes ||
        !hasPdfMagic(bytes)
      ) {
        if (attempt < maxRetries) {
          await sleep(backoffMs(attempt));
          continue;
        }
        return null;
      }

      return bytes;
    } catch {
      // Timeout (AbortError) OR network drop — both retryable. This is the
      // fix that stops papers from disappearing between runs.
      if (attempt < maxRetries) {
        await sleep(backoffMs(attempt));
        continue;
      }
      return null;
    } finally {
      clearTimeout(timer);
    }
  }
  return null;
}

// Tries the primary host, then the fallback host. A 404 on the fallback is
// treated as a definitive miss — no further retries across hosts.
async function fetchSessionBytes(
  course: string,
  subject: string,
  session: string,
): Promise<{ bytes: Buffer; url: string } | null> {
  // Widen both to `string`: the config values are `as const` literals, so
  // a direct comparison would be narrowed to "always false" by TypeScript
  // and flagged as dead code. Runtime equality is still possible if the
  // two config values are ever set to the same string.
  const primaryHost: string = DOWNLOAD_CONFIG.gtuBaseUrl;
  const fallbackHost: string = DOWNLOAD_CONFIG.gtuFallbackBaseUrl;

  const primaryUrl = buildPaperUrl(primaryHost, course, subject, session);
  const primary = await fetchWithRetries(primaryUrl);
  if (primary) return { bytes: primary, url: primaryUrl };

  if (fallbackHost && fallbackHost !== primaryHost) {
    const fallbackUrl = buildPaperUrl(fallbackHost, course, subject, session);
    const fallback = await fetchWithRetries(fallbackUrl);
    if (fallback) return { bytes: fallback, url: fallbackUrl };
  }
  return null;
}

// Fetches the official syllabus PDF for a subject.
export async function fetchSyllabus(
  subjectCode: string,
): Promise<{ bytes: Buffer; url: string } | null> {
  const url = `${DOWNLOAD_CONFIG.syllabusBaseUrl}/${subjectCode}.pdf`;
  const bytes = await fetchWithRetries(url);
  return bytes ? { bytes, url } : null;
}

// Fetches every session for one subject with bounded concurrency.
// Each landed PDF is reported through onSession immediately, so callers
// can store and stream singles without waiting for the slow sessions.
export async function fetchSubjectPapers(
  course: string,
  subjectCode: string,
  onSession?: (session: string, bytes: Buffer, url: string) => void,
): Promise<SubjectPapers | null> {
  const sessions = [
    ...DOWNLOAD_CONFIG.summerSessions,
    ...DOWNLOAD_CONFIG.winterSessions,
  ];
  const files = new Map<string, SessionAsset>();
  const queue = [...sessions];

  const workers = Array.from(
    { length: Math.min(DOWNLOAD_CONFIG.maxConcurrency, queue.length) },
    async () => {
      while (queue.length > 0) {
        const session = queue.shift() as string;
        const result = await fetchSessionBytes(course, subjectCode, session);
        if (result) {
          files.set(session, result);
          onSession?.(session, result.bytes, result.url);
        }
        // Small jittered pause between requests per worker — prevents
        // all workers from re-hitting the host in the same tick after
        // a retry wave (lock-step bursts are what trigger throttling).
        if (DOWNLOAD_CONFIG.requestDelayMs > 0 && queue.length > 0) {
          await sleep(
            DOWNLOAD_CONFIG.requestDelayMs + Math.random() * 80,
          );
        }
      }
    },
  );
  await Promise.all(workers);

  if (files.size === 0) return null;
  const isSummer = (session: string) => session.startsWith("S");
  const sorted = (list: string[]) => [...list].sort().reverse();
  return {
    subjectCode,
    files,
    summerSessions: sorted([...files.keys()].filter(isSummer)),
    winterSessions: sorted([...files.keys()].filter((s) => !isSummer(s))),
  };
}
