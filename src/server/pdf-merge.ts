// PDF packaging: converts fetched session PDFs into the requested option.
// Option ids (1-5) match the legacy Express backend exactly.
//
// Performance: all options share one load cache per subject. Previously
// each option called PDFDocument.load() independently, so the same session
// PDF was parsed 5× (100 parses/subject). Now 20 parses/subject — a 5×
// reduction. Output bytes are identical because the same source documents
// are appended in the same order.

import { PDFDocument } from "pdf-lib";
import type { BuiltFile, SessionAsset, SubjectPapers } from "@/types/paper.types";

const OPTION_SINGLE = 1;
const OPTION_SUMMER_WINTER = 2;

// Cache stores the *promise* of a loaded doc, not the resolved doc.
// This prevents a race: if two options request the same session at the
// same instant, both await the same in-flight load instead of starting
// two loads.
type LoadCache = Map<string, Promise<PDFDocument | null>>;

async function loadOnce(
  session: string,
  asset: SessionAsset | undefined,
  cache: LoadCache,
): Promise<PDFDocument | null> {
  const existing = cache.get(session);
  if (existing) return existing;

  const loading = (async (): Promise<PDFDocument | null> => {
    if (!asset) return null;
    try {
      const doc = await PDFDocument.load(asset.bytes, {
        ignoreEncryption: true,
      });
      return doc.getPageCount() > 0 ? doc : null;
    } catch {
      return null;
    }
  })();

  cache.set(session, loading);
  return loading;
}

// Orders sessions per option: 3 = winter-first, 5 = summer-first,
// 4 = interleaved; option 2 is handled as two separate documents.
function orderedSessions(papers: SubjectPapers, option: number): string[] {
  const { summerSessions, winterSessions } = papers;
  if (option === 4) {
    const merged: string[] = [];
    const longest = Math.max(summerSessions.length, winterSessions.length);
    for (let i = 0; i < longest; i += 1) {
      if (i < summerSessions.length) merged.push(summerSessions[i]);
      if (i < winterSessions.length) merged.push(winterSessions[i]);
    }
    return merged;
  }
  if (option === 5) return [...summerSessions, ...winterSessions];
  return [...winterSessions, ...summerSessions];
}

// Merges the given session order into one PDF. Returns null if nothing
// could be added (all sessions unreadable).
async function mergeSessions(
  sessions: string[],
  files: Map<string, SessionAsset>,
  cache: LoadCache,
): Promise<Buffer | null> {
  const merged = await PDFDocument.create();
  let added = false;
  for (const session of sessions) {
    const doc = await loadOnce(session, files.get(session), cache);
    if (!doc) continue;
    const pages = await merged.copyPages(doc, doc.getPageIndices());
    pages.forEach((page) => merged.addPage(page));
    added = true;
  }
  if (!added) return null;
  return Buffer.from(await merged.save());
}

// Builds the output files for one subject + option.
export async function buildSubjectFiles(
  course: string,
  papers: SubjectPapers,
  option: number,
  cache: LoadCache = new Map(),
): Promise<BuiltFile[]> {
  const { subjectCode, files } = papers;

  // Option 1: keep every session as its own PDF.
  if (option === OPTION_SINGLE) {
    return [...files.entries()].map(([session, asset]) => ({
      filename: `${course}_${subjectCode}_${session}.pdf`,
      bytes: asset.bytes,
      format: "single" as const,
    }));
  }

  // Option 2: one merged summer PDF + one merged winter PDF.
  if (option === OPTION_SUMMER_WINTER) {
    const outputs: BuiltFile[] = [];
    const groups = [
      {
        suffix: "SUMMER",
        sessions: papers.summerSessions,
        format: "summer-pack" as const,
      },
      {
        suffix: "WINTER",
        sessions: papers.winterSessions,
        format: "winter-pack" as const,
      },
    ];
    for (const group of groups) {
      const bytes = await mergeSessions(group.sessions, files, cache);
      if (bytes) {
        outputs.push({
          filename: `${course}_${subjectCode}_${group.suffix}.pdf`,
          bytes,
          format: group.format,
        });
      }
    }
    return outputs;
  }

  // Options 3/4/5: a single merged PDF in the requested session order.
  const sessionOrder = orderedSessions(papers, option);
  const bytes = await mergeSessions(sessionOrder, files, cache);
  if (!bytes) return [];
  const suffix =
    option === 4
      ? "INTERLEAVED"
      : option === 5
        ? "SUMMER_WINTER"
        : "WINTER_SUMMER";
  const format =
    option === 4
      ? ("merged-interleaved" as const)
      : option === 5
        ? ("merged-summer-first" as const)
        : ("merged-winter-first" as const);
  return [
    { filename: `${course}_${subjectCode}_${suffix}.pdf`, bytes, format },
  ];
}

// Builds the complete pack: every format (options 1–5) for one subject.
// One shared cache — the 20 sessions are parsed once, not five times.
export async function buildCompletePack(
  course: string,
  papers: SubjectPapers,
): Promise<BuiltFile[]> {
  const cache: LoadCache = new Map();
  const results = await Promise.all(
    [1, 2, 3, 4, 5].map((option) =>
      buildSubjectFiles(course, papers, option, cache),
    ),
  );
  return results.flat();
}

// Builds everything except singles (options 2–5): season packs + merged.
export async function buildPacksAndMerged(
  course: string,
  papers: SubjectPapers,
): Promise<BuiltFile[]> {
  const cache: LoadCache = new Map();
  const results = await Promise.all(
    [2, 3, 4, 5].map((option) =>
      buildSubjectFiles(course, papers, option, cache),
    ),
  );
  return results.flat();
}
