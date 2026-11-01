// Results panel: syllabus card first, then one card per subject section.
// Files render progressively as they stream in; pending files show as
// skeletons. Checkboxes + select-all feed the bulk toolbar with exactly
// three actions: Download individually · Merge in order (1 PDF) · .zip

"use client";

import { useState } from "react";
import { Archive, Combine, Download, Link2 } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Alert } from "@/components/ui/alert";
import { CircularLoader } from "@/components/ui/circular-loader";
import { Skeleton } from "@/components/ui/skeleton";
import { EmptyState } from "@/components/feedback/empty-state";
import { DownloadFileRow } from "@/components/download/download-file-row";
import { SelectAllCheckbox } from "@/components/download/select-all-checkbox";
import { useFileSelection } from "@/hooks/use-file-selection";
import { downloadFilesAsZip, type ZipProgress } from "@/lib/zip-client";
import { getFileBytes, mergeSelection, saveBytes } from "@/lib/paper-engine";
import { sortNewestFirst } from "@/lib/sessions";
import type {
  DownloadFileItem,
  DownloadResponse,
} from "@/types/download.types";
import type { PaperFormat } from "@/types/paper.types";

const BULK_DELAY_MS = 400;
const PENDING_SKELETON_ROWS = 4;

// Fixed display order of format sections. Colors come from theme tokens so
// they stay readable on both the dark surface and the light card.
const FORMAT_SECTIONS: { formats: PaperFormat[]; title: string; color: string }[] = [
  { formats: ["single"],       title: "Single papers", color: "var(--gtu-section-single)" },
  { formats: ["merge-summer"], title: "Merge Summer",  color: "var(--gtu-section-summer)" },
  { formats: ["merge-winter"], title: "Merge Winter",  color: "var(--gtu-section-winter)" },
  { formats: ["merge-all"],    title: "Merge All",     color: "var(--gtu-section-all)" },
];

interface ResultCard {
  key: string;
  badge: string | null;
  title: string;
  color: string;
  files: DownloadFileItem[];
}

// Sorts single papers newest-first (W2024 is newer than S2024).
function sortSingleFiles(files: DownloadFileItem[]): DownloadFileItem[] {
  const bySession = new Map(files.map((f) => [f.session ?? "", f]));
  return sortNewestFirst([...bySession.keys()]).map((s) => bySession.get(s) as DownloadFileItem);
}

// Builds the card list: syllabus first, then one card per subject section.
function buildCards(
  data: DownloadResponse,
  subjects: string[],
): ResultCard[] {
  const cards: ResultCard[] = [];
  const syllabus = data.files
    .filter((file) => file.format === "syllabus")
    .sort((a, b) => subjects.indexOf(a.subject) - subjects.indexOf(b.subject));
  if (syllabus.length > 0) {
    cards.push({
      key: "syllabus",
      badge: null,
      title: "Syllabus",
      color: "var(--gtu-section-syllabus)",
      files: syllabus,
    });
  }
  const bySubject = new Map<string, DownloadFileItem[]>();
  for (const file of data.files) {
    if (file.format === "syllabus") continue;
    const key = file.subject;
    const list = bySubject.get(key) ?? [];
    list.push(file);
    bySubject.set(key, list);
  }
  const order = (s: string) => {
    const i = subjects.indexOf(s);
    return i === -1 ? 999 : i;
  };
  const subjectEntries = [...bySubject.entries()].sort(([a], [b]) => order(a) - order(b));
  for (const [subject, files] of subjectEntries) {
    for (const section of FORMAT_SECTIONS) {
      const sectionFiles = files.filter((file) =>
        section.formats.includes(file.format),
      );
      if (sectionFiles.length > 0) {
        cards.push({
          key: `${subject}-${section.title}`,
          badge: subject,
          title: section.title,
          color: section.color,
          // Singles sorted newest-first; other formats keep natural order.
          files: section.formats.includes("single")
            ? sortSingleFiles(sectionFiles)
            : sectionFiles,
        });
      }
    }
  }
  return cards;
}

export function DownloadResults({
  data,
  subjects,
  pendingCount,
  onCopyLink,
  copied,
}: {
  data: DownloadResponse | null;
  subjects: string[];
  pendingCount: number;
  onCopyLink: () => void;
  copied: boolean;
}) {
  // Selection + bulk progress live here; the parent remounts per result
  // so stale selections never leak into a fresh fetch.
  const { selected, toggle, setMany, clear } = useFileSelection();
  const [bulk, setBulk] = useState<{ done: number; total: number } | null>(null);
  const [zipProgress, setZipProgress] = useState<ZipProgress | null>(null);
  const zipping = zipProgress !== null;
  const [merging, setMerging] = useState(false);
  const [bulkError, setBulkError] = useState<string | null>(null);

  // Nothing fetched yet — guide the user instead of showing blank space.
  if (!data) {
    return (
      <EmptyState
        title="No results yet"
        description="Choose a course, enter subject codes, and fetch. The syllabus, every paper, and Merge Summer / Winter / All will appear here."
      />
    );
  }

  // Local alias: narrowing does not reach async callbacks, this does.
  const result = data;
  const allNames = result.files.map((file) => file.filename);
  const busy = bulk !== null || zipping || merging;
  const cards = buildCards(result, subjects);

  // Selected rows in on-screen order.
  const selectedFiles = () => {
    const onScreen = cards.flatMap((card) => card.files);
    return onScreen.filter((file) => selected.has(file.filename));
  };

  // (a) Saves every selected file directly, one by one, with progress.
  async function downloadSelected() {
    const targets = selectedFiles();
    if (targets.length === 0 || busy) return;
    setBulkError(null);
    setBulk({ done: 0, total: targets.length });
    const failed: string[] = [];
    for (const file of targets) {
      try {
        saveBytes(await getFileBytes(file), file.filename);
      } catch {
        failed.push(file.filename);
      }
      setBulk((prev) =>
        prev ? { done: prev.done + 1, total: prev.total } : prev,
      );
      await new Promise((resolve) => setTimeout(resolve, BULK_DELAY_MS));
    }
    setBulk(null);
    if (failed.length > 0) {
      setBulkError(`${failed.length} file(s) could not be downloaded: ${failed.join(", ")}. Retry.`);
    } else {
      clear();
    }
  }

  // (b) Merges the selection into ONE PDF: syllabus first, then papers
  // oldest → newest per subject (duplicates removed).
  async function mergeSelected() {
    const targets = selectedFiles();
    if (targets.length === 0 || busy) return;
    setBulkError(null);
    setMerging(true);
    try {
      const { blob, filename } = await mergeSelection(targets, subjects);
      saveBytes(blob, filename);
      clear();
    } catch (error) {
      setBulkError(error instanceof Error ? error.message : "Merge failed. Retry.");
    } finally {
      setMerging(false);
    }
  }

  // (c) Packs every selected file into one .zip IN THE BROWSER (client-zip),
  // with a live progress bar. No server ZIP, no size/timeout limits.
  async function downloadZip() {
    const targets = selectedFiles();
    if (targets.length === 0 || busy) return;
    setBulkError(null);
    setZipProgress({ doneFiles: 0, totalFiles: targets.length, failed: [] });
    try {
      const final = await downloadFilesAsZip(targets, setZipProgress);
      if (final.failed.length > 0) {
        setBulkError(`ZIP saved, but ${final.failed.length} file(s) could not be fetched: ${final.failed.join(", ")}`);
      } else {
        clear();
      }
    } catch (error) {
      setBulkError(
        error instanceof Error ? error.message : "ZIP failed. Retry.",
      );
    } finally {
      setZipProgress(null);
    }
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center gap-2">
        {result.processingTime && (
          <Badge tone="neutral">{result.processingTime}</Badge>
        )}
        <span className="flex-1" />
        <Button variant="ghost" onClick={onCopyLink} className="px-2 py-1 text-xs">
          <Link2 className="h-3.5 w-3.5" aria-hidden="true" />
          {copied ? "Link copied" : "Copy share link"}
        </Button>
      </div>

      {result.files.length > 0 && (
        <Card
          className="flex flex-wrap items-center gap-2 px-4 py-3"
          aria-label="Bulk download"
        >
          <label className="flex cursor-pointer items-center gap-2 text-[13px] font-semibold">
            <input
              type="checkbox"
              ref={(el) => {
                if (el) {
                  el.indeterminate =
                    selected.size > 0 && selected.size < allNames.length;
                }
              }}
              checked={
                allNames.length > 0 && selected.size === allNames.length
              }
              onChange={(event) => setMany(allNames, event.target.checked)}
              aria-label="Select all files"
              className="h-4 w-4 cursor-pointer accent-[#4f8cff]"
            />
            Select all
          </label>
          <span className="text-xs text-[var(--gtu-text-muted)]">
            {selected.size} selected
          </span>
          <span className="flex-1" />
          <Button
            variant="secondary"
            onClick={downloadSelected}
            disabled={selected.size === 0 || busy}
            className="px-3 py-1.5 text-xs"
          >
            {bulk ? (
              <>
                <CircularLoader size={14} label="Saving selected files" />
                Saving {bulk.done}/{bulk.total}…
              </>
            ) : (
              <>
                <Download className="h-3.5 w-3.5" aria-hidden="true" />
                Individually
              </>
            )}
          </Button>
          <Button
            variant="secondary"
            onClick={mergeSelected}
            disabled={selected.size === 0 || busy}
            className="px-3 py-1.5 text-xs"
            aria-label="Merge selected in order into one PDF"
          >
            {merging ? (
              <>
                <CircularLoader size={14} label="Merging selected files" />
                Merging…
              </>
            ) : (
              <>
                <Combine className="h-3.5 w-3.5" aria-hidden="true" />
                Merge in order
              </>
            )}
          </Button>
          <Button
            onClick={downloadZip}
            disabled={selected.size === 0 || busy}
            className="px-3 py-1.5 text-xs"
          >
            {zipping ? (
              <>
                <CircularLoader size={14} label="Packing zip archive" />
                {zipProgress
                  ? `${zipProgress.doneFiles}/${zipProgress.totalFiles} · ${Math.round((zipProgress.doneFiles / zipProgress.totalFiles) * 100)}%`
                  : "Packing…"}
              </>
            ) : (
              <>
                <Archive className="h-3.5 w-3.5" aria-hidden="true" />
                .zip
              </>
            )}
          </Button>
          {selected.size > 0 && !busy && (
            <Button variant="ghost" onClick={clear} className="px-2 py-1.5 text-xs">
              Clear
            </Button>
          )}
        </Card>
      )}

      {zipProgress && (
        <div
          role="progressbar"
          aria-label="ZIP progress"
          aria-valuemin={0}
          aria-valuemax={zipProgress.totalFiles}
          aria-valuenow={zipProgress.doneFiles}
          className="h-2 w-full overflow-hidden rounded-full bg-[var(--gtu-elevated)]"
        >
          <div
            className="h-full bg-[var(--gtu-accent)] transition-[width]"
            style={{ width: `${(zipProgress.doneFiles / zipProgress.totalFiles) * 100}%` }}
          />
        </div>
      )}

      {bulkError && <Alert tone="error">{bulkError}</Alert>}

      {cards.map((card) => (
        <Card key={card.key} className="overflow-hidden">
          <CardHeaderRow
            badge={card.badge}
            title={card.title}
            color={card.color}
            count={card.files.length}
            names={card.files.map((file) => file.filename)}
            selected={selected}
            onSelectAll={setMany}
          />
          <ul className="divide-y divide-[var(--gtu-border)]">
            {card.files.map((file) => (
              <li key={file.filename}>
                <DownloadFileRow
                  file={file}
                  selected={selected.has(file.filename)}
                  onToggle={() => toggle(file.filename)}
                  onError={setBulkError}
                />
              </li>
            ))}
          </ul>
        </Card>
      ))}

      {pendingCount > 0 && (
        <Card className="p-5" aria-label="Files still loading">
          <p className="mb-3 flex items-center gap-2 text-[13px] font-semibold">
            <CircularLoader size={14} label="Fetching remaining files" />
            Fetching {pendingCount} more…
          </p>
          {Array.from({ length: Math.min(pendingCount, PENDING_SKELETON_ROWS) }).map(
            (_, index) => (
              <div
                key={index}
                className="mb-3 flex items-center gap-3 last:mb-0"
              >
                <Skeleton className="h-10 w-10 shrink-0" />
                <div className="flex flex-1 flex-col gap-2">
                  <Skeleton className="h-4 w-2/3" />
                  <Skeleton className="h-3 w-1/3" />
                </div>
              </div>
            ),
          )}
        </Card>
      )}
    </div>
  );
}

// Card header: subject badge + colored title + count + select-all.
function CardHeaderRow({
  badge,
  title,
  color,
  count,
  names,
  selected,
  onSelectAll,
}: {
  badge: string | null;
  title: string;
  color: string;
  count: number;
  names: string[];
  selected: ReadonlySet<string>;
  onSelectAll: (filenames: string[], select: boolean) => void;
}) {
  return (
    <div
      className="flex items-center gap-2 border-b border-[var(--gtu-border)] py-2.5 pl-3 pr-4"
      style={{ borderLeft: `3px solid ${color}` }}
    >
      {badge && <Badge tone="accent">{badge}</Badge>}
      <span className="text-[13px] font-bold tracking-wide" style={{ color }}>
        {title}
      </span>
      <span className="text-[13px] font-normal text-[var(--gtu-text-muted)]">
        {count} file{count === 1 ? "" : "s"}
      </span>
      <span className="flex-1" />
      <SelectAllCheckbox
        label={`Select all in ${title}`}
        names={names}
        selected={selected}
        onSelectAll={onSelectAll}
      />
    </div>
  );
}
