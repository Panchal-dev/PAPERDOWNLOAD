// DownloadFileRow: one result row with checkbox, info, and actions.
// Syllabus and singles link straight to the working upstream URL (new-tab
// view, direct download — no server hop). Merged packs live only here, so
// they keep the server view/download with loader → saved / retry states.

"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { Check, Eye, FileText, RotateCcw } from "lucide-react";
import { CircularLoader } from "@/components/ui/circular-loader";
import { saveFileFromUrl } from "@/lib/save-file";
import { formatBytes } from "@/utils/format";
import { ROUTES_CONFIG } from "@/config/routes.config";
import type { DownloadFileItem } from "@/types/download.types";

type RowState = "idle" | "loading" | "saved" | "error";

const SAVED_VISIBLE_MS = 2500;

export function DownloadFileRow({
  file,
  selected,
  onToggle,
}: {
  file: DownloadFileItem;
  selected: boolean;
  onToggle: () => void;
}) {
  const [state, setState] = useState<RowState>("idle");
  // Guards late async completions after the row unmounts.
  const mounted = useRef(true);

  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
    };
  }, []);

  // Streams this server-built file, then hands it to the browser.
  // (Upstream files use plain anchors below — no fetch needed.)
  const download = useCallback(async () => {
    if (state === "loading") return;
    setState("loading");
    try {
      await saveFileFromUrl(ROUTES_CONFIG.api.file(file.filename), file.filename);
      if (!mounted.current) return;
      setState("saved");
      window.setTimeout(() => {
        if (mounted.current) setState("idle");
      }, SAVED_VISIBLE_MS);
    } catch {
      if (mounted.current) setState("error");
    }
  }, [file, state]);

  // Upstream-backed rows (syllabus, singles): direct GTU links.
  if (file.sourceUrl) {
    return (
      <div className="flex items-center gap-3 px-4 py-3 transition-colors hover:bg-[var(--gtu-elevated)]">
        <input
          type="checkbox"
          checked={selected}
          onChange={onToggle}
          aria-label={`Select ${file.filename}`}
          className="h-4 w-4 shrink-0 cursor-pointer accent-[#4f8cff]"
        />
        <FileText
          className="h-5 w-5 shrink-0 text-[var(--gtu-accent)]"
          aria-hidden="true"
        />
        <span className="min-w-0 flex-1 truncate font-mono text-[13px]">
          {file.filename}
        </span>
        {/* Size — own column, vertically centered between filename and actions */}
        <span className="w-16 shrink-0 text-center text-xs text-[var(--gtu-text-muted)]">
          {file.sizeBytes ? formatBytes(file.sizeBytes) : "PDF"}
        </span>
        <span className="flex flex-1 shrink-0 items-center justify-end gap-3">
          <a
            href={file.sourceUrl}
            target="_blank"
            rel="noopener noreferrer"
            aria-label={`View ${file.filename} in a new tab`}
            className="flex items-center gap-1 text-xs font-semibold text-[var(--gtu-text-secondary)] transition-colors hover:text-[var(--gtu-text)]"
          >
            <Eye className="h-3.5 w-3.5" aria-hidden="true" />
            View
          </a>
          <a
            href={file.sourceUrl}
            download={file.filename}
            aria-label={`Download ${file.filename}`}
            className="flex items-center gap-1 text-xs font-semibold text-[var(--gtu-accent)]"
          >
            <span>Download</span>
          </a>
        </span>
      </div>
    );
  }

  // Server-built rows (merged packs): view/download through this server.
  return (
    <div className="flex items-center gap-3 px-4 py-3 transition-colors hover:bg-[var(--gtu-elevated)]">
      <input
        type="checkbox"
        checked={selected}
        onChange={onToggle}
        aria-label={`Select ${file.filename}`}
        className="h-4 w-4 shrink-0 cursor-pointer accent-[#4f8cff]"
      />
      <FileText
        className="h-5 w-5 shrink-0 text-[var(--gtu-accent)]"
        aria-hidden="true"
      />
      <span className="min-w-0 flex-1 truncate font-mono text-[13px]">
        {file.filename}
      </span>
      {/* Size — own column, vertically centered between filename and actions */}
      <span className="w-16 shrink-0 text-center text-xs text-[var(--gtu-text-muted)]">
        {file.sizeBytes ? formatBytes(file.sizeBytes) : "PDF"}
      </span>
      <span className="flex flex-1 shrink-0 items-center justify-end gap-3">
        <a
          href={`${ROUTES_CONFIG.api.file(file.filename)}?view=1`}
          target="_blank"
          rel="noopener noreferrer"
          aria-label={`View ${file.filename} in a new tab`}
          className="flex items-center gap-1 text-xs font-semibold text-[var(--gtu-text-secondary)] transition-colors hover:text-[var(--gtu-text)]"
        >
          <Eye className="h-3.5 w-3.5" aria-hidden="true" />
          View
        </a>
        <button
          type="button"
          onClick={download}
          disabled={state === "loading"}
          aria-busy={state === "loading"}
          className="flex items-center gap-1.5 text-xs font-semibold disabled:cursor-wait"
        >
          {state === "loading" && (
            <>
              <CircularLoader size={16} label={`Downloading ${file.filename}`} />
              <span className="text-[var(--gtu-text-secondary)]">Getting…</span>
            </>
          )}
          {state === "saved" && (
            <>
              <Check
                className="h-4 w-4 text-[var(--gtu-success)]"
                aria-hidden="true"
              />
              <span className="text-[var(--gtu-success)]">Saved</span>
            </>
          )}
          {state === "error" && (
            <>
              <RotateCcw
                className="h-4 w-4 text-[var(--gtu-error)]"
                aria-hidden="true"
              />
              <span className="text-[var(--gtu-error)]">Retry</span>
            </>
          )}
          {state === "idle" && (
            <span className="text-[var(--gtu-accent)]">Download</span>
          )}
        </button>
      </span>
    </div>
  );
}
