// Client-side paper engine.
//
// 1. discover(): the browser probes every session PDF straight from GTU
//    (CORS *) with bounded concurrency, retries and %PDF validation. A 1 KB
//    Range probe is enough to list a paper; the full file is fetched on the
//    first Download / View / merge. If GTU ignores or rejects Range, the probe
//    falls back to the old full download, so behaviour never regresses.
//    The syllabus comes through our own /api/pdf proxy (its host has no CORS).
// 2. Full bytes are kept as Blobs in an LRU-capped Map for this tab only
//    (temporary cache: gone on reload, nothing stored on any server, no DB).
//    Blobs let the browser spill large PDFs to disk instead of pinning them
//    in the JS heap.
// 3. Singles save from a same-origin blob: URL with <a download>, so the
//    browser saves the file under the right name and the page never
//    navigates or opens a tab.
// 4. Merges use @cantoo/pdf-lib in a module Web Worker (with a main-thread
//    fallback), so the UI stays responsive and there is no server limit.

import { DOWNLOAD_CONFIG } from "@/config/download.config";
import { ROUTES_CONFIG } from "@/config/routes.config";
import { chronoKey, sessionsUpTo, sortChronological } from "@/lib/sessions";
import { formatDuration } from "@/utils/format";
import type {
  DownloadEvent,
  DownloadFileItem,
  DownloadRequest,
} from "@/types/download.types";

// Full files (Blob) and probe results (size only) are tracked separately so a
// 1 KB probe can never be mistaken for a complete PDF.
const store = new Map<string, Blob>();
const probes = new Map<string, { sizeBytes: number | null }>();
const building = new Map<string, Promise<Blob>>();

// Merged copies duplicate bytes, so cap what this tab keeps. Oldest entries
// are evicted first; a single oversized file is still kept.
const MAX_CACHE_BYTES = 256 * 1024 * 1024;
let cachedBytes = 0;

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

async function isPdfBlob(blob: Blob): Promise<boolean> {
  if (blob.size < DOWNLOAD_CONFIG.minPdfBytes) return false;
  const head = new Uint8Array(await blob.slice(0, 4).arrayBuffer());
  return (
    head[0] === 0x25 && // %
    head[1] === 0x50 && // P
    head[2] === 0x44 && // D
    head[3] === 0x46 // F
  );
}

type FetchResult =
  | { bytes: Blob }
  | { probed: true; sizeBytes: number | null }
  | { missing: true }
  | { error: string };

function cacheGet(name: string): Blob | undefined {
  const blob = store.get(name);
  if (!blob) return undefined;
  // Refresh insertion order for LRU eviction.
  store.delete(name);
  store.set(name, blob);
  return blob;
}

function cacheSet(name: string, blob: Blob): void {
  const previous = store.get(name);
  if (previous) cachedBytes -= previous.size;
  store.delete(name);
  store.set(name, blob);
  cachedBytes += blob.size;
  probes.delete(name);

  while (cachedBytes > MAX_CACHE_BYTES && store.size > 1) {
    const oldest = store.keys().next();
    if (oldest.done) break;
    const evicted = store.get(oldest.value);
    store.delete(oldest.value);
    if (evicted) cachedBytes -= evicted.size;
  }
}

function sizeOf(name: string): number {
  return store.get(name)?.size ?? probes.get(name)?.sizeBytes ?? 0;
}

// One URL with timeout, retries (network / 5xx / non-PDF) and no retry on 404.
async function fetchPdf(url: string, signal?: AbortSignal): Promise<FetchResult> {
  let lastError = "network error";
  for (let attempt = 0; attempt <= DOWNLOAD_CONFIG.maxRetries; attempt += 1) {
    if (signal?.aborted) return { error: "cancelled" };
    const timeout = AbortSignal.timeout(DOWNLOAD_CONFIG.fetchTimeoutMs);
    const combined = signal ? AbortSignal.any([signal, timeout]) : timeout;
    try {
      const res = await fetch(url, {
        signal: combined,
        credentials: "omit",
        redirect: "follow",
      });
      if (res.status === 404) return { missing: true };
      if (res.ok) {
        const blob = await res.blob();
        if (await isPdfBlob(blob)) return { bytes: blob };
        lastError = "not a PDF";
      } else {
        lastError = `HTTP ${res.status}`;
        if (res.status === 403 || res.status === 400) return { error: lastError };
      }
    } catch (error) {
      lastError = error instanceof Error ? error.name : "network error";
    }
    if (attempt < DOWNLOAD_CONFIG.maxRetries) {
      await sleep(400 * 2 ** attempt + Math.random() * 200);
    }
  }
  return { error: lastError };
}

// Once a host proves it ignores or blocks Range, stop probing for the rest of
// the session instead of paying for a failed probe per file.
let rangeSupported: boolean | null = null;

function contentRangeTotal(header: string | null): number | null {
  if (!header) return null; // CORS may not expose Content-Range.
  const match = /\/(\d+)$/.exec(header);
  if (!match?.[1]) return null;
  const total = Number(match[1]);
  return Number.isFinite(total) ? total : null;
}

// Cheap discovery: ask for the first 1 KB, validate the %PDF header, and keep
// only the total size. The full file is fetched lazily on first use.
async function probePdf(url: string, signal?: AbortSignal): Promise<FetchResult> {
  if (rangeSupported === false) return fetchPdf(url, signal);

  const timeout = AbortSignal.timeout(DOWNLOAD_CONFIG.fetchTimeoutMs);
  const combined = signal ? AbortSignal.any([signal, timeout]) : timeout;
  try {
    const res = await fetch(url, {
      signal: combined,
      credentials: "omit",
      redirect: "follow",
      headers: { Range: "bytes=0-1023" },
    });
    if (res.status === 404) return { missing: true };

    if (res.status === 206) {
      rangeSupported = true;
      const blob = await res.blob();
      if (!(await isPdfBlob(blob))) return { error: "not a PDF" };
      return { probed: true, sizeBytes: contentRangeTotal(res.headers.get("content-range")) };
    }

    if (res.ok) {
      // Range was ignored and the whole file arrived anyway — keep it.
      rangeSupported = false;
      const blob = await res.blob();
      if (!(await isPdfBlob(blob))) return { error: "not a PDF" };
      return { bytes: blob };
    }

    // 403/416/5xx: use the normal path, which owns the retry policy.
    rangeSupported = false;
    return fetchPdf(url, signal);
  } catch {
    // A rejected Range request (e.g. CORS preflight) must not lose the paper.
    rangeSupported = false;
    return fetchPdf(url, signal);
  }
}

function paperFilename(course: string, subject: string, session: string): string {
  return `${course}_${subject}_${session}.pdf`;
}

function gtuUrl(course: string, subject: string, session: string): string {
  return `${DOWNLOAD_CONFIG.gtuBaseUrl}/${session}/${course}/${subject}.pdf`;
}

// Paper: browser -> GTU directly; if the browser is blocked (403 / network),
// fall back to our server proxy (works where the server's IP is allowed).
async function fetchPaper(
  course: string,
  subject: string,
  session: string,
  signal?: AbortSignal,
): Promise<FetchResult> {
  const direct = await fetchPdf(gtuUrl(course, subject, session), signal);
  if (!("error" in direct) || signal?.aborted) return direct;
  const viaServer = await fetchPdf(ROUTES_CONFIG.api.pdf(course, subject, session), signal);
  return "error" in viaServer ? direct : viaServer;
}

async function probePaper(
  course: string,
  subject: string,
  session: string,
  signal?: AbortSignal,
): Promise<FetchResult> {
  const direct = await probePdf(gtuUrl(course, subject, session), signal);
  if (!("error" in direct) || signal?.aborted) return direct;
  // The proxy always streams a full PDF (it does not forward Range).
  const viaServer = await fetchPdf(ROUTES_CONFIG.api.pdf(course, subject, session), signal);
  return "error" in viaServer ? direct : viaServer;
}

function mergeDetail(sessions: string[]): string {
  if (sessions.length === 0) return "";
  const first = sessions[0];
  const last = sessions[sessions.length - 1];
  const n = sessions.length;
  const range = n === 1 ? first : `${first} → ${last}`;
  return `${range} · ${n} paper${n === 1 ? "" : "s"}`;
}

function mergedItems(course: string, subject: string, found: string[]): DownloadFileItem[] {
  const chrono = sortChronological(found);
  const summer = chrono.filter((s) => s.startsWith("S"));
  const winter = chrono.filter((s) => s.startsWith("W"));
  const groups = [
    { format: "merge-summer" as const, suffix: "MERGE_SUMMER", sessions: summer },
    { format: "merge-winter" as const, suffix: "MERGE_WINTER", sessions: winter },
    { format: "merge-all" as const, suffix: "MERGE_ALL", sessions: chrono },
  ];
  return groups
    .filter((g) => g.sessions.length > 0)
    .map((g) => {
      const sources = g.sessions.map((s) => paperFilename(course, subject, s));
      return {
        filename: `${course}_${subject}_${g.suffix}.pdf`,
        format: g.format,
        course,
        subject,
        sources,
        sizeBytes: sources.reduce((sum, name) => sum + sizeOf(name), 0),
        detail: mergeDetail(g.sessions),
      };
    });
}

// Probes every session (current year back to firstYear) + syllabus for each
// subject, emitting events as files land.
export async function discover(
  request: DownloadRequest,
  onEvent: (event: DownloadEvent) => void,
  signal?: AbortSignal,
): Promise<void> {
  const started = performance.now();
  const sessions = sessionsUpTo();
  const course = request.course.toUpperCase();
  const subjects = request.subjects.map((s) => s.toUpperCase());
  onEvent({ type: "start", totalPdfs: subjects.length * (sessions.length + 1) });

  type Job = { subject: string; session: string };
  const jobs: Job[] = [];
  for (const subject of subjects) {
    jobs.push({ subject, session: "SYLLABUS" });
    for (const session of sessions) jobs.push({ subject, session });
  }
  const remaining = new Map(subjects.map((s) => [s, sessions.length + 1]));
  const found = new Map<string, string[]>(subjects.map((s) => [s, []]));
  let successCount = 0;
  let errors = 0;

  const finishJob = (subject: string) => {
    const left = (remaining.get(subject) ?? 1) - 1;
    remaining.set(subject, left);
    if (left === 0) {
      for (const item of mergedItems(course, subject, found.get(subject) ?? [])) {
        onEvent({ type: "file", file: item });
      }
    }
  };

  async function runJob({ subject, session }: Job) {
    const filename = paperFilename(course, subject, session);
    const isSyllabus = session === "SYLLABUS";
    const url = isSyllabus
      ? ROUTES_CONFIG.api.pdf(course, subject, "SYLLABUS")
      : gtuUrl(course, subject, session);
    let result: FetchResult;
    const cached = cacheGet(filename);
    const probed = probes.get(filename);
    if (cached) result = { bytes: cached };
    else if (probed) result = { probed: true, sizeBytes: probed.sizeBytes };
    else if (isSyllabus) result = await fetchPdf(url, signal);
    else result = await probePaper(course, subject, session, signal);

    if ("bytes" in result) {
      cacheSet(filename, result.bytes);
      successCount += 1;
      if (!isSyllabus) found.get(subject)?.push(session);
      onEvent({
        type: "file",
        file: {
          filename,
          format: isSyllabus ? "syllabus" : "single",
          course,
          subject,
          session,
          url,
          sizeBytes: result.bytes.size,
        },
      });
    } else if ("probed" in result) {
      probes.set(filename, { sizeBytes: result.sizeBytes });
      successCount += 1;
      if (!isSyllabus) found.get(subject)?.push(session);
      onEvent({
        type: "file",
        file: {
          filename,
          format: isSyllabus ? "syllabus" : "single",
          course,
          subject,
          session,
          url,
          sizeBytes: result.sizeBytes ?? 0,
        },
      });
    } else {
      if ("error" in result) errors += 1;
      onEvent({ type: "unavailable", entry: `${subject}_${session}` });
    }
    finishJob(subject);
  }

  const queue = [...jobs];
  await Promise.all(
    Array.from({ length: Math.min(DOWNLOAD_CONFIG.maxConcurrency, queue.length) }, async () => {
      while (queue.length > 0 && !signal?.aborted) {
        await runJob(queue.shift() as Job);
      }
    }),
  );
  if (signal?.aborted) return;
  if (successCount === 0 && errors > 0) {
    throw new Error("Could not reach the GTU server. Check your connection and retry.");
  }
  onEvent({
    type: "done",
    successCount,
    totalPdfs: subjects.length * (sessions.length + 1),
    processingTime: formatDuration(performance.now() - started),
  });
}

// ── Lazy full-file loading ────────────────────────────────────────────────

async function loadSource(course: string, subject: string, name: string): Promise<Blob | null> {
  const cached = cacheGet(name);
  if (cached) return cached;

  const session = name.replace(/\.pdf$/i, "").split("_").pop();
  if (!session) return null;

  const result =
    session === "SYLLABUS"
      ? await fetchPdf(ROUTES_CONFIG.api.pdf(course, subject, "SYLLABUS"))
      : await fetchPaper(course, subject, session);
  if (!("bytes" in result)) return null;
  cacheSet(name, result.bytes);
  return result.bytes;
}

// ── Merging (module worker, main-thread fallback) ─────────────────────────

interface PendingMerge {
  resolve: (bytes: Uint8Array) => void;
  reject: (error: Error) => void;
}

type MergeResponse =
  | { id: string; ok: true; bytes: Uint8Array }
  | { id: string; ok: false; error: string };

const pendingMerges = new Map<string, PendingMerge>();
let mergeWorker: Worker | null = null;
let mergeWorkerBroken = false;
let nextMergeId = 0;

function getMergeWorker(): Worker | null {
  if (mergeWorkerBroken || typeof Worker === "undefined") return null;
  if (mergeWorker) return mergeWorker;

  try {
    const worker = new Worker(new URL("./merge-worker.ts", import.meta.url), {
      type: "module",
    });
    worker.addEventListener("message", (event: MessageEvent<MergeResponse>) => {
      const data = event.data;
      const entry = pendingMerges.get(data.id);
      if (!entry) return;
      pendingMerges.delete(data.id);
      if (data.ok) entry.resolve(data.bytes);
      else entry.reject(new Error(data.error));
    });
    worker.addEventListener("error", (event) => {
      mergeWorkerBroken = true;
      const error = new Error(event.message || "Merge worker failed.");
      for (const entry of pendingMerges.values()) entry.reject(error);
      pendingMerges.clear();
      worker.terminate();
      mergeWorker = null;
    });
    mergeWorker = worker;
    return worker;
  } catch {
    mergeWorkerBroken = true;
    return null;
  }
}

function mergeInWorker(parts: ArrayBuffer[]): Promise<Uint8Array> {
  const worker = getMergeWorker();
  if (!worker) return mergeOnMainThread(parts);

  return new Promise((resolve, reject) => {
    const id = `merge-${nextMergeId++}`;
    pendingMerges.set(id, { resolve, reject });
    try {
      // Transfer ownership: the caller only needs the merged result.
      worker.postMessage({ id, parts }, parts);
    } catch (error) {
      pendingMerges.delete(id);
      reject(error instanceof Error ? error : new Error("Merge worker failed."));
    }
  });
}

async function mergeOnMainThread(parts: ArrayBuffer[]): Promise<Uint8Array> {
  const { mergePdfParts } = await import("./pdf-merge");
  return mergePdfParts(parts);
}

async function mergeBlobs(blobs: Blob[]): Promise<Blob> {
  if (blobs.length === 0) throw new Error("None of these PDFs could be merged.");
  const parts = await Promise.all(blobs.map((blob) => blob.arrayBuffer()));

  let bytes: Uint8Array;
  try {
    bytes = await mergeInWorker(parts);
  } catch {
    // postMessage transfers (detaches) the buffers. If the worker failed
    // before using them, re-read the Blobs for the main-thread retry.
    const usable = parts.some((part) => part.byteLength > 0)
      ? parts
      : await Promise.all(blobs.map((blob) => blob.arrayBuffer()));
    bytes = await mergeOnMainThread(usable);
  }

  return new Blob([bytes as BlobPart], { type: "application/pdf" });
}

// ── Public API ────────────────────────────────────────────────────────────

// Bytes for any result row: cached full file, re-fetched if evicted, or a
// merged PDF built on first use (then cached for this tab).
export async function getFileBytes(file: DownloadFileItem): Promise<Blob> {
  const cached = cacheGet(file.filename);
  if (cached) return cached;

  if (file.sources) {
    const sources = file.sources;
    return buildOnce(file.filename, async () => {
      const blobs: Blob[] = [];
      for (const name of sources) {
        const blob = await loadSource(file.course, file.subject, name);
        if (blob) blobs.push(blob);
      }
      return mergeBlobs(blobs);
    });
  }

  const blob = await loadSource(file.course, file.subject, file.filename);
  if (!blob) throw new Error(`${file.filename} could not be downloaded. Retry.`);
  return blob;
}

function buildOnce(key: string, build: () => Promise<Blob>): Promise<Blob> {
  const existing = building.get(key);
  if (existing) return existing;
  const promise = build()
    .then((blob) => {
      cacheSet(key, blob);
      return blob;
    })
    .finally(() => building.delete(key));
  building.set(key, promise);
  return promise;
}

interface SelectionEntry {
  name: string;
  subject: string;
  session: string;
  file?: DownloadFileItem;
}

// Pure ordering rule for "Merge in order": every selected row expanded to its
// source papers, de-duplicated, then per subject: syllabus first, papers
// oldest → newest. Exported so the ordering is unit-testable without pdf-lib.
export function orderSelection(
  files: DownloadFileItem[],
  subjectsOrder: string[],
): SelectionEntry[] {
  const byName = new Map<string, SelectionEntry>();
  for (const file of files) {
    if (file.sources) {
      for (const name of file.sources) {
        const session = name.replace(/\.pdf$/i, "").split("_").pop();
        if (!session) continue;
        byName.set(name, { name, subject: file.subject, session });
      }
    } else if (file.session) {
      byName.set(file.filename, {
        name: file.filename,
        subject: file.subject,
        session: file.session,
        file,
      });
    }
  }

  const rank = (subject: string) => {
    const index = subjectsOrder.indexOf(subject);
    return index === -1 ? 999 : index;
  };

  return [...byName.values()].sort((a, b) => {
    if (a.subject !== b.subject) return rank(a.subject) - rank(b.subject);
    if (a.session === b.session) return 0;
    if (a.session === "SYLLABUS") return -1;
    if (b.session === "SYLLABUS") return 1;
    return chronoKey(a.session) - chronoKey(b.session);
  });
}

// "Merge in order": every selected row expanded to its source papers,
// de-duplicated, then per subject: syllabus first, papers oldest → newest.
export async function mergeSelection(
  files: DownloadFileItem[],
  subjectsOrder: string[],
): Promise<{ blob: Blob; filename: string; parts: number }> {
  const ordered = orderSelection(files, subjectsOrder);
  const course = files[0]?.course ?? "GTU";
  const blobs: Blob[] = [];

  for (const entry of ordered) {
    const blob = await loadSource(course, entry.subject, entry.name);
    if (blob) blobs.push(blob);
  }

  const subjects = [...new Set(ordered.map((entry) => entry.subject))];
  const filename =
    subjects.length === 1
      ? `${course}_${subjects[0] ?? "PAPERS"}_SELECTED_${blobs.length}.pdf`
      : `${course}_SELECTED_${blobs.length}_PAPERS.pdf`;
  return { blob: await mergeBlobs(blobs), filename, parts: blobs.length };
}

// Saves bytes as a file: same-origin blob URL + download attribute, so the
// browser saves it with this exact filename and stays on the page.
export function saveBytes(bytes: Uint8Array | Blob, filename: string, type = "application/pdf"): void {
  const blob = bytes instanceof Blob ? bytes : new Blob([bytes as BlobPart], { type });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.rel = "noopener";
  a.style.display = "none";
  document.body.appendChild(a);
  a.click();
  a.remove();
  window.setTimeout(() => URL.revokeObjectURL(url), 60_000);
}

// "View": opens the PDF in a new tab (the only action that opens a tab).
export async function viewFile(file: DownloadFileItem): Promise<void> {
  const tab = window.open("", "_blank");
  try {
    const blob = await getFileBytes(file);
    const url = URL.createObjectURL(
      blob.type ? blob : new Blob([blob], { type: "application/pdf" }),
    );
    if (tab) tab.location.href = url;
    else window.open(url, "_blank");
    window.setTimeout(() => URL.revokeObjectURL(url), 5 * 60_000);
  } catch (error) {
    tab?.close();
    throw error;
  }
}
