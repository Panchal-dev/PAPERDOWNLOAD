// Download engine configuration.
// Session range (2017–2026, both seasons) and syllabus host mirror the
// proven paper.py bulk downloader; merging preserves gtu-web-main behavior.

export const DOWNLOAD_CONFIG = {
  // Live GTU file host — mirrors paper.py BASE_URL exactly.
  gtuBaseUrl: "https://old26.gtu.ac.in/uploads",
  // Syllabus host from paper.py (note the upstream "Syallbus" spelling).
  syllabusBaseUrl:
    "https://s3-ap-southeast-1.amazonaws.com/gtusitecirculars/Syallbus",
  // Sessions fetched per subject, newest first (paper.py: 2017–2026).
  summerSessions: [
    "S2026",
    "S2025",
    "S2024",
    "S2023",
    "S2022",
    "S2021",
    "S2020",
    "S2019",
    "S2018",
    "S2017",
  ],
  winterSessions: [
    "W2026",
    "W2025",
    "W2024",
    "W2023",
    "W2022",
    "W2021",
    "W2020",
    "W2019",
    "W2018",
    "W2017",
  ],
  // Parallel upstream fetches per subject — matches paper.py MAX_CONCURRENT.
  maxConcurrency: 32,
  // Per-file upstream timeout. GTU PDFs reach 272 KB on slow hosts;
  // 25 s is generous enough to receive large files without false misses.
  // Timeouts are NOT retried (paper.py: "retrying makes it worse").
  fetchTimeoutMs: 25_000,
  // Retries for genuine network drops only (not timeouts, not 4xx/5xx).
  maxRetries: 2,
  // Inter-subject delay — zero; the semaphore already caps concurrency.
  requestDelayMs: 0,
  // Minimum bytes accepted as a real PDF (guards against error pages).
  minPdfBytes: 100,
  // Server-side retention for generated files (hours).
  fileTtlHours: 6,
  // Upper bound on subject codes per request (each yields ~26 files).
  maxSubjectsPerRequest: 5,
} as const;
