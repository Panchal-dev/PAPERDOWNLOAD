// DownloadFileRow: one result row with checkbox, info, and actions.
// "Download" saves the file directly (same-origin blob + download
// attribute): correct filename, no navigation, no new tab.
// "View" is the only action that opens a tab.

"use client";

import { useState } from "react";
import { Eye, FileText } from "lucide-react";
import { CircularLoader } from "@/components/ui/circular-loader";
import { formatBytes } from "@/utils/format";
import { getFileBytes, saveBytes, viewFile } from "@/lib/paper-engine";
import type { DownloadFileItem } from "@/types/download.types";

export function DownloadFileRow({
  file,
  selected,
  onToggle,
  onError,
}: {
  file: DownloadFileItem;
  selected: boolean;
  onToggle: () => void;
  onError: (message: string) => void;
}) {
  const [saving, setSaving] = useState(false);
  // Singles open GTU's own URL, the syllabus our inline proxy; merged PDFs
  // exist only in this tab, so they open as a blob.
  const viewHref = file.sources
    ? null
    : file.session === "SYLLABUS"
      ? `${file.url}?inline=1`
      : file.url;

  async function onDownload() {
    if (saving) return;
    setSaving(true);
    try {
      saveBytes(await getFileBytes(file), file.filename);
    } catch (error) {
      onError(error instanceof Error ? error.message : "Download failed. Retry.");
    } finally {
      setSaving(false);
    }
  }

  async function onView() {
    try {
      await viewFile(file);
    } catch (error) {
      onError(error instanceof Error ? error.message : "Could not open the file.");
    }
  }

  return (
    <div className="flex items-center gap-3 px-4 py-3 transition-colors hover:bg-[var(--gtu-elevated)]">
      <input
        type="checkbox"
        checked={selected}
        onChange={onToggle}
        aria-label={`Select ${file.filename}`}
        className="h-4 w-4 shrink-0 cursor-pointer accent-[#4f8cff]"
      />
      <FileText className="h-5 w-5 shrink-0 text-[var(--gtu-accent)]" aria-hidden="true" />
      <span className="flex min-w-0 flex-1 flex-col">
        <span className="truncate font-mono text-[13px]">{file.filename}</span>
        {file.detail && (
          <span className="truncate text-[11px] text-[var(--gtu-text-muted)]">{file.detail}</span>
        )}
      </span>
      <span className="w-16 shrink-0 text-center text-xs text-[var(--gtu-text-muted)]">
        {file.sizeBytes ? `${file.sources ? "~" : ""}${formatBytes(file.sizeBytes)}` : "PDF"}
      </span>
      <span className="flex shrink-0 items-center justify-end gap-3 sm:flex-1">
        {viewHref ? (
          <a
            href={viewHref}
            target="_blank"
            rel="noopener noreferrer"
            aria-label={`View ${file.filename} in a new tab`}
            className="flex items-center gap-1 text-xs font-semibold text-[var(--gtu-text-secondary)] transition-colors hover:text-[var(--gtu-text)]"
          >
            <Eye className="h-3.5 w-3.5" aria-hidden="true" />
            View
          </a>
        ) : (
          <button
            type="button"
            onClick={onView}
            aria-label={`View ${file.filename} in a new tab`}
            className="flex cursor-pointer items-center gap-1 text-xs font-semibold text-[var(--gtu-text-secondary)] transition-colors hover:text-[var(--gtu-text)]"
          >
            <Eye className="h-3.5 w-3.5" aria-hidden="true" />
            View
          </button>
        )}
        <button
          type="button"
          onClick={onDownload}
          disabled={saving}
          aria-label={`Download ${file.filename}`}
          data-filename={file.filename}
          className="flex min-w-[68px] cursor-pointer items-center justify-end gap-1 text-xs font-semibold text-[var(--gtu-accent)] disabled:cursor-wait"
        >
          {saving ? (
            <>
              <CircularLoader size={12} label={`Preparing ${file.filename}`} />
              {file.sources ? "Merging" : "Saving"}
            </>
          ) : (
            "Download"
          )}
        </button>
      </span>
    </div>
  );
}
