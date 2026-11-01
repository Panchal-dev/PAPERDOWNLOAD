// Download engine configuration.
//
// Papers are fetched by the visitor's browser straight from GTU (GTU sends
// `Access-Control-Allow-Origin: *`). Many GTU hosts answer 403 to datacenter
// IPs (verified 2026-10-30: Google Cloud box -> 403 even with a browser UA),
// so a server-side paper fetch is only a fallback. The syllabus host (S3)
// sends no CORS header, so the syllabus goes through /api/pdf on our server.

export const DOWNLOAD_CONFIG = {
  // Live GTU file host (paper.py BASE_URL).
  gtuBaseUrl: "https://old26.gtu.ac.in/uploads",
  // Syllabus host from paper.py (note the upstream "Syallbus" spelling).
  syllabusBaseUrl:
    "https://s3-ap-southeast-1.amazonaws.com/gtusitecirculars/Syallbus",
  // First exam year probed. The last year is the current year, computed at
  // run time (see sessionsUpTo), so no yearly code change is needed.
  firstYear: 2017,
  // Parallel browser fetches per run. GTU throttles above ~6 per client.
  maxConcurrency: 6,
  // Per-file timeout. GTU PDFs are < 2 MB.
  fetchTimeoutMs: 20_000,
  // Retries for timeouts, network errors and 5xx (404 is never retried).
  maxRetries: 2,
  // Minimum bytes accepted as a real PDF (guards against error pages).
  minPdfBytes: 100,
  // Upper bound on subject codes per request (each yields ~20 probes).
  maxSubjectsPerRequest: 5,
} as const;
