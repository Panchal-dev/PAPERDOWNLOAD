// Deliverables catalogue: every request returns ALL of these per subject.
// No option picker — one click yields single papers, every merged pack,
// and the official syllabus, exactly like the paper.py bulk downloader.

import type { PaperFormat } from "@/types/paper.types";

// Short badge labels for the per-file rows in the results panel.
export const FORMAT_LABELS: Record<PaperFormat, string> = {
  single: "Single",
  "summer-pack": "Summer pack",
  "winter-pack": "Winter pack",
  "merged-winter-first": "Merged W→S",
  "merged-interleaved": "Merged mix",
  "merged-summer-first": "Merged S→W",
  syllabus: "Syllabus",
};

export const DOWNLOAD_STATUS = {
  idle: "idle",
  verifying: "verifying",
  loading: "loading",
  success: "success",
  error: "error",
} as const;

export type DownloadStatus = (typeof DOWNLOAD_STATUS)[keyof typeof DOWNLOAD_STATUS];
