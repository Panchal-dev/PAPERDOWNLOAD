// PDF packaging: converts fetched session PDFs into the requested option.
// Option ids (1-5) match the legacy Express backend exactly.

import { PDFDocument } from "pdf-lib";
import type { BuiltFile, SubjectPapers } from "@/types/paper.types";

const OPTION_SINGLE = 1;
const OPTION_SUMMER_WINTER = 2;


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

// Builds the output files for one subject + option.
export async function buildSubjectFiles(
  course: string,
  papers: SubjectPapers,
  option: number,
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
      { suffix: "SUMMER", sessions: papers.summerSessions, format: "summer-pack" as const },
      { suffix: "WINTER", sessions: papers.winterSessions, format: "winter-pack" as const },
    ];
    for (const group of groups) {
      const merged = await PDFDocument.create();
      // Load all PDFs in the group in parallel, preserving session order.
      const loaded = await Promise.all(
        group.sessions.map(async (session) => {
          const bytes = files.get(session)?.bytes;
          if (!bytes) return null;
          try {
            const doc = await PDFDocument.load(bytes, { ignoreEncryption: true });
            return doc.getPageCount() > 0 ? doc : null;
          } catch {
            return null;
          }
        }),
      );
      let added = false;
      for (const doc of loaded) {
        if (!doc) continue;
        const pages = await merged.copyPages(doc, doc.getPageIndices());
        pages.forEach((page) => merged.addPage(page));
        added = true;
      }
      if (added) {
        outputs.push({
          filename: `${course}_${subjectCode}_${group.suffix}.pdf`,
          bytes: Buffer.from(await merged.save()),
          format: group.format,
        });
      }
    }
    return outputs;
  }

  // Options 3/4/5: a single merged PDF in the requested session order.
  // Pre-load all PDFs in parallel; append in the correct order.
  const sessionOrder = orderedSessions(papers, option);
  const merged = await PDFDocument.create();
  const loaded = await Promise.all(
    sessionOrder.map(async (session) => {
      const bytes = files.get(session)?.bytes;
      if (!bytes) return null;
      try {
        const doc = await PDFDocument.load(bytes, { ignoreEncryption: true });
        return doc.getPageCount() > 0 ? doc : null;
      } catch {
        return null;
      }
    }),
  );
  let added = false;
  for (const doc of loaded) {
    if (!doc) continue;
    const pages = await merged.copyPages(doc, doc.getPageIndices());
    pages.forEach((page) => merged.addPage(page));
    added = true;
  }
  if (!added) return [];
  const suffix =
    option === 4 ? "INTERLEAVED" : option === 5 ? "SUMMER_WINTER" : "WINTER_SUMMER";
  const format =
    option === 4
      ? ("merged-interleaved" as const)
      : option === 5
        ? ("merged-summer-first" as const)
        : ("merged-winter-first" as const);
  return [
    {
      filename: `${course}_${subjectCode}_${suffix}.pdf`,
      bytes: Buffer.from(await merged.save()),
      format,
    },
  ];
}

// Builds the complete pack: every format (options 1–5) for one subject.
// All options are independent — run them in parallel for maximum throughput.
export async function buildCompletePack(
  course: string,
  papers: SubjectPapers,
): Promise<BuiltFile[]> {
  const results = await Promise.all(
    [1, 2, 3, 4, 5].map((option) => buildSubjectFiles(course, papers, option)),
  );
  return results.flat();
}

// Builds everything except singles (options 2–5): season packs + merged.
// Options are independent — all 4 merge jobs run in parallel.
export async function buildPacksAndMerged(
  course: string,
  papers: SubjectPapers,
): Promise<BuiltFile[]> {
  const results = await Promise.all(
    [2, 3, 4, 5].map((option) => buildSubjectFiles(course, papers, option)),
  );
  return results.flat();
}
