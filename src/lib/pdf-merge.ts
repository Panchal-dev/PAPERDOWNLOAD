// Shared PDF merge routine, used by the worker and the main-thread fallback.
// Loaded lazily: the app never pays for pdf-lib until a merge is requested.

import { PDFDocument } from "@cantoo/pdf-lib";

export async function mergePdfParts(parts: ArrayBuffer[]): Promise<Uint8Array> {
  const merged = await PDFDocument.create();
  let pages = 0;

  for (const part of parts) {
    try {
      const doc = await PDFDocument.load(part, { ignoreEncryption: true });
      const copied = await merged.copyPages(doc, doc.getPageIndices());
      copied.forEach((page) => merged.addPage(page));
      pages += copied.length;
    } catch {
      // A damaged source PDF is skipped instead of failing the whole merge.
    }
  }

  if (pages === 0) throw new Error("None of these PDFs could be merged.");
  return merged.save();
}
