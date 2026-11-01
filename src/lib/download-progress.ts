// Progressive download state: folds engine events into a response.
// Pure functions, so the accumulation logic is unit-testable on its own.

import type { DownloadEvent, DownloadFileItem, DownloadResponse } from "@/types/download.types";

export const EMPTY_DOWNLOAD_RESPONSE: DownloadResponse = {
  successCount: 0,
  totalPdfs: 0,
  files: [],
  failed: [],
  processingTime: "",
};

// Merged rows are derived from fetched papers, so they are not "probes".
const isProbe = (file: DownloadFileItem) => !file.sources;

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
        successCount: prev.successCount + (isProbe(event.file) ? 1 : 0),
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

// Probes still in flight: expected minus landed, never negative.
export function pendingCountOf(data: DownloadResponse | null): number {
  if (!data || data.totalPdfs === 0) return 0;
  const landed = data.files.filter(isProbe).length + data.failed.length;
  return Math.max(0, data.totalPdfs - landed);
}
