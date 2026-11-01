// Deliverables per subject: Syllabus, every single paper, and three merged
// PDFs (Summer, Winter, All), all in chronological order.

export const DOWNLOAD_STATUS = {
  idle: "idle",
  loading: "loading",
  success: "success",
  error: "error",
} as const;

export type DownloadStatus = (typeof DOWNLOAD_STATUS)[keyof typeof DOWNLOAD_STATUS];
