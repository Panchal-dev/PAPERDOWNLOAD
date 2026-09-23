// Streaming client for the download API route.
// Reads NDJSON events line by line so files render as they arrive.

import { API_CONFIG } from "@/config/api.config";
import type {
  DownloadEvent,
  DownloadRequest,
} from "@/types/download.types";

export const VERIFICATION_ERROR_CODE = "verification_required";

// Streams a download request, invoking the callback per server event.
// Throws with a `code` for verification failures (widget flow).
export async function streamDownloadRequest(
  payload: DownloadRequest,
  onEvent: (event: DownloadEvent) => void,
): Promise<void> {
  // No client-side timeout: the stream stays open while the server works
  // (bounded server-side by maxDuration); a stalled socket ends it.
  const response = await fetch(API_CONFIG.downloadPath, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Accept: "application/x-ndjson",
    },
    body: JSON.stringify(payload),
  });

  // Guards answer as plain JSON before any stream bytes flow.
  if (!response.ok || !response.body) {
    const body = (await response.json().catch(() => null)) as {
      error?: string;
      code?: string;
    } | null;
    if (response.status === 403 && body?.code === VERIFICATION_ERROR_CODE) {
      const error = new Error("Verification required before downloading.");
      (error as Error & { code: string }).code = VERIFICATION_ERROR_CODE;
      throw error;
    }
    throw new Error(
      body?.error ?? `Request failed (${response.status})`,
    );
  }

  // Incremental NDJSON parse: split on newlines, keep the tail buffered.
  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true });
    const lines = buffer.split("\n");
    buffer = lines.pop() ?? "";
    for (const line of lines) {
      const text = line.trim();
      if (text.length > 0) {
        onEvent(JSON.parse(text) as DownloadEvent);
      }
    }
  }
  const tail = buffer.trim();
  if (tail.length > 0) {
    onEvent(JSON.parse(tail) as DownloadEvent);
  }
}

// Type guard used by the download hook to trigger the captcha step.
export function isVerificationError(error: unknown): boolean {
  return (
    error instanceof Error &&
    (error as Error & { code?: string }).code === VERIFICATION_ERROR_CODE
  );
}
