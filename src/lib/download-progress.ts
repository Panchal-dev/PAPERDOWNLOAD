// Progressive download state: folds streaming events into a response.
// Pure functions, so the accumulation logic is unit-testable on its own.

import type { DownloadEvent, DownloadResponse } from "@/types/download.types";

export const EMPTY_DOWNLOAD_RESPONSE: DownloadResponse = {
  successCount: 0,
  totalPdfs: 0,
  files: [],
  failed: [],
  processingTime: "",
};

// Applies one stream event to the running response snapshot.
export function applyDownloadEvent(
  prev: DownloadResponse,
  event: DownloadEvent,
): DownloadResponse {
  switch (event.type) {
    case "start":
      return { ...EMPTY_DOWNLOAD_RESPONSE, totalPdfs: event.totalPdfs };
    case "file":
      return {
        ...prev,
        files: [...prev.files, event.file],
        successCount: prev.successCount + 1,
      };
    case "unavailable":
      return { ...prev, failed: [...prev.failed, event.entry] };
    case "done":
      return {
        ...prev,
        successCount: event.successCount,
        totalPdfs: event.totalPdfs,
        processingTime: event.processingTime,
      };
    case "error":
      return prev;
  }
}

// Files still in flight: expected minus arrived, never negative.
export function pendingCountOf(data: DownloadResponse | null): number {
  if (!data || data.totalPdfs === 0) return 0;
  return Math.max(0, data.totalPdfs - data.files.length - data.failed.length);
}
