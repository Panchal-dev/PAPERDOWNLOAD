// Results panel: syllabus card first, then one card per subject section.
// Files render progressively as they stream in; pending files show as
// skeletons. Checkboxes + select-all feed the bulk toolbar (files / .zip).

"use client";

import { useState } from "react";
import { Archive, Download, FileWarning, Link2 } from "lucide-react";
import { ROUTES_CONFIG } from "@/config/routes.config";
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
import { downloadAsZip } from "@/lib/archive-client";
import { saveDirectUrl, saveFileFromUrl } from "@/lib/save-file";
import { subjectFromFilename } from "@/utils/format";
import type {
  DownloadFileItem,
  DownloadResponse,
} from "@/types/download.types";
import type { PaperFormat } from "@/types/paper.types";

const BULK_DELAY_MS = 400;
const PENDING_SKELETON_ROWS = 4;

// Fixed display order of format sections — each with a distinct dark-theme color.
const FORMAT_SECTIONS: { formats: PaperFormat[]; title: string; color: string }[] = [
  { formats: ["single"],                                   title: "Single papers",       color: "#38bdf8" }, // sky blue
  { formats: ["summer-pack", "winter-pack"],               title: "Season packs",        color: "#34d399" }, // emerald
  { formats: ["merged-winter-first"],                      title: "Merged · winter first", color: "#fbbf24" }, // amber
  { formats: ["merged-summer-first"],                      title: "Merged · summer first", color: "#fb7185" }, // rose
  { formats: ["merged-interleaved"],                       title: "Merged · interleaved",  color: "#2dd4bf" }, // teal
];

interface ResultCard {
  key: string;
  badge: string | null;
  title: string;
  color: string;
  files: DownloadFileItem[];
}

// Sorts single papers newest-first: descending year, then W before S
// within the same year (W2024 is newer than S2024).
function sortSingleFiles(files: DownloadFileItem[]): DownloadFileItem[] {
  const SESSION_RE = /([WS])(\d{4})\.pdf$/i;
  return [...files].sort((a, b) => {
    const ma = SESSION_RE.exec(a.filename);
    const mb = SESSION_RE.exec(b.filename);
    if (!ma || !mb) return 0;
    const yearDiff = Number(mb[2]) - Number(ma[2]);
    if (yearDiff !== 0) return yearDiff;
    // Same year: W (winter) is newer than S (summer)
    return ma[1].toUpperCase() === "W" ? -1 : 1;
  });
}

// Builds the card list: syllabus first, then one card per subject section.
function buildCards(
  data: DownloadResponse,
  subjects: string[],
): ResultCard[] {
  const cards: ResultCard[] = [];
  const syllabus = data.files.filter((file) => file.format === "syllabus");
  if (syllabus.length > 0) {
    cards.push({ key: "syllabus", badge: null, title: "Syllabus", color: "#a78bfa", files: syllabus });
  }
  const bySubject = new Map<string, DownloadFileItem[]>();
  for (const file of data.files) {
    if (file.format === "syllabus") continue;
    const key = subjectFromFilename(file.filename, subjects) ?? "Papers";
    const list = bySubject.get(key) ?? [];
    list.push(file);
    bySubject.set(key, list);
  }
  for (const [subject, files] of bySubject) {
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

// Groups "CODE_X" / "CODE" entries under their subject code.
function groupUnavailable(
  failed: string[],
  subjects: string[],
): Map<string, string[]> {
  const groups = new Map<string, string[]>();
  const known = subjects.map((s) => s.toUpperCase());
  for (const entry of failed) {
    const head = entry.split("_")[0].toUpperCase();
    const key = known.includes(head) ? head : "Other";
    const list = groups.get(key) ?? [];
    list.push(entry);
    groups.set(key, list);
  }
  return groups;
}

export function DownloadResults({
  data,
  subjects,
  pendingCount,
  shareUrl,
  onCopyLink,
  copied,
}: {
  data: DownloadResponse | null;
  subjects: string[];
  pendingCount: number;
  shareUrl: string;
  onCopyLink: () => void;
  copied: boolean;
}) {
  // Selection + bulk progress live here; the parent remounts per result
  // so stale selections never leak into a fresh fetch.
  const { selected, toggle, setMany, clear } = useFileSelection();
  const [bulk, setBulk] = useState<{ done: number; total: number } | null>(null);
  const [zipping, setZipping] = useState(false);
  const [bulkError, setBulkError] = useState<string | null>(null);

  // Nothing fetched yet — guide the user instead of showing blank space.
  if (!data) {
    return (
      <EmptyState
        title="No results yet"
        description="Choose a course, enter subject codes, and fetch. Every format plus the syllabus will appear here as download links."
      />
    );
  }

  // Local alias: narrowing does not reach async callbacks, this does.
  const result = data;
  const allNames = result.files.map((file) => file.filename);
  const busy = bulk !== null || zipping;
  const cards = buildCards(result, subjects);
  const unavailable = groupUnavailable(result.failed, subjects);

  // Saves every selected file one by one with visible progress.
  async function downloadSelected() {
    const targets = result.files.filter((file) => selected.has(file.filename));
    if (targets.length === 0 || busy) return;
    setBulkError(null);
    setBulk({ done: 0, total: targets.length });
    let failed = 0;
    for (const file of targets) {
      try {
        // Upstream files save straight from GTU (no server hop, no CORS
        // issue for anchor downloads); merged packs stream via the server.
        if (file.sourceUrl) {
          saveDirectUrl(file.sourceUrl, file.filename);
        } else {
          await saveFileFromUrl(
            ROUTES_CONFIG.api.file(file.filename),
            file.filename,
          );
        }
      } catch {
        failed += 1;
      }
      setBulk((prev) =>
        prev ? { done: prev.done + 1, total: prev.total } : prev,
      );
      await new Promise((resolve) => setTimeout(resolve, BULK_DELAY_MS));
    }
    setBulk(null);
    if (failed > 0) {
      setBulkError(
        `${failed} file(s) failed — likely expired. Re-fetch and retry.`,
      );
    } else {
      clear();
    }
  }

  // Packs every selected file into one .zip on the server, then saves it.
  async function downloadZip() {
    const names = allNames.filter((name) => selected.has(name));
    if (names.length === 0 || busy) return;
    setBulkError(null);
    setZipping(true);
    try {
      await downloadAsZip(names);
      clear();
    } catch (error) {
      setBulkError(
        error instanceof Error ? error.message : "Archive failed. Retry.",
      );
    } finally {
      setZipping(false);
    }
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center gap-2">
        <Badge tone="success">
          {result.successCount}/{result.totalPdfs} ready
        </Badge>
        {result.processingTime && (
          <Badge tone="neutral">{result.processingTime}</Badge>
        )}
        {result.failed.length > 0 && (
          <Badge tone="warning">{result.failed.length} unavailable</Badge>
        )}
        <span className="flex-1" />
        <Button variant="ghost" onClick={onCopyLink} className="px-2 py-1 text-xs">
          <Link2 className="h-3.5 w-3.5" aria-hidden="true" />
          {copied ? "Link copied" : "Copy share link"}
        </Button>
      </div>
      <span className="sr-only" aria-live="polite">
        {shareUrl}
      </span>

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
                Files
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
                Packing…
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

      {unavailable.size > 0 && (
        <Card className="px-4 py-3">
          <p className="flex items-start gap-2.5 text-[13px] text-[var(--gtu-text-secondary)]">
            <FileWarning
              className="mt-0.5 h-4 w-4 shrink-0 text-[var(--gtu-warning)]"
              aria-hidden="true"
            />
            <span>
              <span className="font-semibold text-[var(--gtu-text)]">
                Not in the archive:
              </span>{" "}
              the GTU hosts have no PDF for these — expand a subject to see
              exactly which sessions or syllabus are missing.
            </span>
          </p>
          <div className="mt-2 flex flex-col gap-1.5">
            {[...unavailable.entries()].map(([subject, entries]) => (
              <details
                key={subject}
                className="rounded-[8px] border border-[var(--gtu-border)] px-3 py-2"
              >
                <summary className="cursor-pointer text-[13px] font-semibold">
                  {subject}
                  <span className="ml-2 font-normal text-[var(--gtu-text-muted)]">
                    {entries.length} missing
                  </span>
                </summary>
                <p className="mt-1 font-mono text-xs leading-relaxed text-[var(--gtu-text-muted)]">
                  {entries.join(", ")}
                </p>
              </details>
            ))}
          </div>
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
