// Domain types for the download flow.
// Kept next to the domain; components import from here, not from routes.

import type { DownloadStatus } from "@/constants/download.constants";
import type { PaperFormat } from "@/types/paper.types";

export interface DownloadFileItem {
  url: string;
  filename: string;
  sizeBytes?: number;
  format: PaperFormat;
  // Direct upstream URL that served this file (singles + syllabus only).
  // Rows link straight to it; merged packs live only on this server.
  sourceUrl?: string;
}

export interface DownloadRequest {
  course: string;
  subjects: string[];
}

// Streaming protocol: the download API emits one NDJSON event per line
// so files render as they arrive instead of all at once at the end.
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

export interface VerificationState {
  verified: boolean;
  checking: boolean;
}
