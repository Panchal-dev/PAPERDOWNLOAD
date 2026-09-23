// Download orchestration: validation → streaming request → live state.
// Each server event folds into the response, so files render while the
// rest still streams. Guards against duplicate clicks; surfaces
// verification failures separately.

"use client";

import { useCallback, useRef, useState } from "react";
import { DOWNLOAD_STATUS } from "@/constants/download.constants";
import { downloadRequestSchema } from "@/schemas/download.schema";
import {
  isVerificationError,
  streamDownloadRequest,
} from "@/lib/download-client";
import {
  applyDownloadEvent,
  EMPTY_DOWNLOAD_RESPONSE,
  pendingCountOf,
} from "@/lib/download-progress";
import type {
  DownloadRequest,
  DownloadState,
} from "@/types/download.types";

const INITIAL_STATE: DownloadState = {
  status: DOWNLOAD_STATUS.idle,
  data: null,
  error: null,
};

export function useDownload(options?: {
  onVerificationRequired?: () => void;
}) {
  const [state, setState] = useState<DownloadState>(INITIAL_STATE);
  // Blocks duplicate submissions while a request is in flight.
  const inFlight = useRef(false);

  // Validates locally, then streams NDJSON events into live state.
  const download = useCallback(
    async (payload: DownloadRequest) => {
      if (inFlight.current) return;
      const parsed = downloadRequestSchema.safeParse(payload);
      if (!parsed.success) {
        setState({
          status: DOWNLOAD_STATUS.error,
          data: null,
          error: parsed.error.issues[0]?.message ?? "Check your input.",
        });
        return;
      }
      inFlight.current = true;
      setState({
        status: DOWNLOAD_STATUS.loading,
        data: { ...EMPTY_DOWNLOAD_RESPONSE },
        error: null,
      });
      try {
        await streamDownloadRequest(parsed.data, (event) => {
          if (event.type === "error") throw new Error(event.message);
          setState((prev) => ({
            ...prev,
            data: prev.data
              ? applyDownloadEvent(prev.data, event)
              : { ...EMPTY_DOWNLOAD_RESPONSE },
          }));
        });
        setState((prev) => ({
          status: DOWNLOAD_STATUS.success,
          data: prev.data,
          error: null,
        }));
      } catch (error) {
        if (isVerificationError(error)) {
          setState({ status: DOWNLOAD_STATUS.idle, data: null, error: null });
          options?.onVerificationRequired?.();
        } else {
          setState({
            status: DOWNLOAD_STATUS.error,
            data: null,
            error:
              error instanceof Error ? error.message : "Download failed. Retry.",
          });
        }
      } finally {
        inFlight.current = false;
      }
    },
    [options],
  );

  // Files still in flight (drives the pending skeletons).
  const pendingCount =
    state.status === DOWNLOAD_STATUS.loading
      ? pendingCountOf(state.data)
      : 0;

  // Clears results/errors back to the idle state.
  const reset = useCallback(() => setState(INITIAL_STATE), []);

  return { ...state, pendingCount, download, reset };
}
