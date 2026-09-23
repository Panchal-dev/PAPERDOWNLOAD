// Upstream GTU fetching: direct PDF URLs with retries and validation.
// Architecture mirrors paper.py exactly:
//   404         → null, no retry (definitive miss on GTU static host)
//   timeout     → null, no retry (throttling; retrying makes it worse)
//   network err → retry up to maxRetries with exponential backoff
//   5xx / other → null, no retry (static file host never self-heals in seconds)

import { DOWNLOAD_CONFIG } from "@/config/download.config";
import type { SessionAsset, SubjectPapers } from "@/types/paper.types";

const PDF_MAGIC = "%PDF";
const RETRY_BASE_DELAY_MS = 400; // mirrors paper.py RETRY_BACKOFF × 1000

// Builds the canonical GTU paper URL.
// Mirrors paper.py build_paper_url: BASE_URL/{season}{year}/{course}/{code}.pdf
function buildPaperUrl(course: string, subject: string, session: string): string {
  return `${DOWNLOAD_CONFIG.gtuBaseUrl}/${session}/${course}/${subject}.pdf`;
}

// Downloads one PDF with timeout, typed retries, and %PDF validation.
//
// Retry rules (paper.py parity — both files identical after this change):
//   • AbortError (timeout)   → null immediately. NO retry. Host is throttling.
//   • HTTP 404               → null immediately. NO retry. Definitive miss.
//   • HTTP 5xx / other 4xx   → null immediately. NO retry. Static host never
//                              self-heals within retry window; fail fast.
//   • Network drop (OS err)  → retry up to maxRetries with exponential backoff.
async function fetchSessionPdf(
  url: string,
  attempt = 0,
  maxRetries: number = DOWNLOAD_CONFIG.maxRetries,
): Promise<Buffer | null> {
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
        // Match the User-Agent paper.py sends so GTU doesn't fingerprint-block.
        "User-Agent":
          "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 " +
          "(KHTML, like Gecko) Chrome/140.0 Safari/537.36",
        Accept: "application/pdf,*/*",
        Connection: "keep-alive",
      },
    });

    // 404 = definitively missing on GTU's static host. Never retry.
    if (response.status === 404) return null;
    // 5xx / other 4xx: GTU is a static file host — it never self-heals within
    // the retry window. Retrying only wastes time and adds load. Fail fast.
    if (!response.ok) return null;

    const bytes = Buffer.from(await response.arrayBuffer());
    // Guard against HTML error pages served with HTTP 200.
    if (
      bytes.length < DOWNLOAD_CONFIG.minPdfBytes ||
      !bytes.subarray(0, PDF_MAGIC.length).toString("ascii").startsWith(PDF_MAGIC)
    ) {
      return null;
    }
    return bytes;
  } catch (err: unknown) {
    // AbortError = our timeout fired. Paper.py never retries timeouts.
    if (err instanceof Error && err.name === "AbortError") return null;

    // Genuine network error (ECONNRESET, ENOTFOUND, etc.) — worth retrying.
    if (attempt < maxRetries) {
      const jitter = Math.random() * 200;
      const delay = RETRY_BASE_DELAY_MS * 2 ** attempt + jitter;
      await new Promise((resolve) => setTimeout(resolve, delay));
      return fetchSessionPdf(url, attempt + 1, maxRetries);
    }
    return null;
  } finally {
    clearTimeout(timer);
  }
}

// Fetches one session paper with full retries against the live host.
// Mirrors paper.py: 404 → null instantly; network errors → retry up to maxRetries.
async function fetchSession(
  course: string,
  subject: string,
  session: string,
): Promise<{ session: string; bytes: Buffer | null; url: string | null }> {
  const url = buildPaperUrl(course, subject, session);
  const bytes = await fetchSessionPdf(url);
  return { session, bytes: bytes ?? null, url: bytes ? url : null };
}

// Fetches the official syllabus PDF for a subject (paper.py behavior).
// Returns the bytes with their working URL, or null — a normal gap.
export async function fetchSyllabus(
  subjectCode: string,
): Promise<{ bytes: Buffer; url: string } | null> {
  const url = `${DOWNLOAD_CONFIG.syllabusBaseUrl}/${subjectCode}.pdf`;
  const bytes = await fetchSessionPdf(url);
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
        const result = await fetchSession(course, subjectCode, session);
        if (result.bytes && result.url) {
          files.set(result.session, { bytes: result.bytes, url: result.url });
          onSession?.(result.session, result.bytes, result.url);
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
