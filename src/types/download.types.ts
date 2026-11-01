// Domain types for the download flow.

import type { DownloadStatus } from "@/constants/download.constants";
import type { PaperFormat } from "@/types/paper.types";

export interface DownloadFileItem {
  // Unique id + saved filename, e.g. BE_3150713_W2024.pdf
  filename: string;
  format: PaperFormat;
  course: string;
  subject: string;
  // W2024 | S2025 for singles; "SYLLABUS" for the syllabus.
  session?: string;
  // Where the bytes come from (GTU URL for papers, /api/pdf for syllabus).
  url?: string;
  sizeBytes?: number;
  // Merged items: source filenames in chronological order.
  sources?: string[];
  // Merged items: short human label, e.g. "S2018 → S2025 · 7 papers".
  detail?: string;
}

export interface DownloadRequest {
  course: string;
  subjects: string[];
}

// Progressive protocol: the engine emits one event per landed file.
export type DownloadEvent =
  | { type: "start"; totalPdfs: number }
  | { type: "file"; file: DownloadFileItem }
  | { type: "unavailable"; entry: string }
  | {
      type: "done";
      successCount: number;
      totalPdfs: number;
      processingTime: string;
    }
  | { type: "error"; message: string };

export interface DownloadResponse {
  successCount: number;
  totalPdfs: number;
  files: DownloadFileItem[];
  failed: string[];
  processingTime: string;
}

export interface DownloadState {
  status: DownloadStatus;
  data: DownloadResponse | null;
  error: string | null;
}
