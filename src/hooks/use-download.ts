// Download orchestration: validation → client-side discovery → live state.
// Engine events are coalesced per animation frame, so a burst of streamed
// rows triggers one render instead of one render per file.
// Errors keep whatever results already arrived (they no longer wipe them).

"use client";

import { useCallback, useRef, useState } from "react";
import { DOWNLOAD_STATUS } from "@/constants/download.constants";
import { downloadRequestSchema } from "@/schemas/download.schema";
import { discover } from "@/lib/paper-engine";
import {
  applyDownloadEvent,
  EMPTY_DOWNLOAD_RESPONSE,
  pendingCountOf,
} from "@/lib/download-progress";
import type {
  DownloadEvent,
  DownloadRequest,
  DownloadState,
} from "@/types/download.types";

const INITIAL_STATE: DownloadState = {
  status: DOWNLOAD_STATUS.idle,
  data: null,
  error: null,
};

export function useDownload() {
  const [state, setState] = useState<DownloadState>(INITIAL_STATE);
  const inFlight = useRef<AbortController | null>(null);
  const buffered = useRef<DownloadEvent[]>([]);
  const frame = useRef<number | null>(null);

  // Applies every event buffered since the last frame in one state update.
  const flush = useCallback(() => {
    if (frame.current !== null) {
      cancelAnimationFrame(frame.current);
      frame.current = null;
    }
    const events = buffered.current;
    if (events.length === 0) return;
    buffered.current = [];
    setState((prev) => {
      let data = prev.data ?? { ...EMPTY_DOWNLOAD_RESPONSE };
      for (const event of events) data = applyDownloadEvent(data, event);
      return { ...prev, data };
    });
  }, []);

  const enqueue = useCallback(
    (event: DownloadEvent) => {
      buffered.current.push(event);
      if (frame.current !== null) return;
      if (typeof requestAnimationFrame === "undefined") {
        flush();
        return;
      }
      frame.current = requestAnimationFrame(() => {
        frame.current = null;
        flush();
      });
    },
    [flush],
  );

  const download = useCallback(
    async (payload: DownloadRequest) => {
      if (inFlight.current) return;
      const parsed = downloadRequestSchema.safeParse(payload);
      if (!parsed.success) {
        setState((prev) => ({
          ...prev,
          status: DOWNLOAD_STATUS.error,
          error: parsed.error.issues[0]?.message ?? "Check your input.",
        }));
        return;
      }
      const controller = new AbortController();
      inFlight.current = controller;
      buffered.current = [];
      setState({
        status: DOWNLOAD_STATUS.loading,
        data: { ...EMPTY_DOWNLOAD_RESPONSE },
        error: null,
      });
      // Ignore late events from a run that was reset/aborted.
      const onEvent = (event: DownloadEvent) => {
        if (inFlight.current === controller) enqueue(event);
      };
      try {
        await discover(parsed.data, onEvent, controller.signal);
        if (controller.signal.aborted) return;
        flush();
        setState((prev) => ({
          status: DOWNLOAD_STATUS.success,
          data: prev.data,
          error: null,
        }));
      } catch (error) {
        if (controller.signal.aborted) return;
        flush();
        setState((prev) => ({
          status: DOWNLOAD_STATUS.error,
          data: prev.data,
          error: error instanceof Error ? error.message : "Download failed. Retry.",
        }));
      } finally {
        if (inFlight.current === controller) inFlight.current = null;
      }
    },
    [enqueue, flush],
  );

  const pendingCount =
    state.status === DOWNLOAD_STATUS.loading ? pendingCountOf(state.data) : 0;

  // Clears results/errors back to idle and cancels any running fetch.
  const reset = useCallback(() => {
    inFlight.current?.abort();
    inFlight.current = null;
    buffered.current = [];
    if (frame.current !== null) {
      cancelAnimationFrame(frame.current);
      frame.current = null;
    }
    setState(INITIAL_STATE);
  }, []);

  return { ...state, pendingCount, download, reset };
}
