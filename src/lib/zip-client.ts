// Client-side ZIP with client-zip: entries stream from the in-memory cache
// (merged PDFs are built on the fly), so the server never builds a ZIP and
// no size/timeout limit applies. STORE mode: PDFs are already compressed.

import { downloadZip } from "client-zip";
import { getFileBytes, saveBytes } from "@/lib/paper-engine";
import type { DownloadFileItem } from "@/types/download.types";

export interface ZipProgress {
  doneFiles: number;
  totalFiles: number;
  failed: string[];
}

// GTU_BE_3150713.zip, or GTU_BE_3150713_3160704.zip for several subjects.
function zipName(files: DownloadFileItem[]): string {
  const course = files[0]?.course ?? "GTU";
  const subjects = [...new Set(files.map((f) => f.subject))];
  return `GTU_${course}_${subjects.join("_")}.zip`;
}

export async function downloadFilesAsZip(
  files: DownloadFileItem[],
  onProgress: (p: ZipProgress) => void,
): Promise<ZipProgress> {
  const progress: ZipProgress = { doneFiles: 0, totalFiles: files.length, failed: [] };
  const emit = () => onProgress({ ...progress, failed: [...progress.failed] });

  async function* entries() {
    for (const file of files) {
      try {
        // getFileBytes returns a Blob, so client-zip can stream it without
        // copying the whole PDF into a second Uint8Array.
        const blob = await getFileBytes(file);
        yield { name: file.filename, input: blob, lastModified: new Date() };
      } catch {
        progress.failed.push(file.filename);
      }
      progress.doneFiles += 1;
      emit();
    }
  }

  const blob = await downloadZip(entries()).blob();
  if (progress.failed.length === files.length) {
    throw new Error("None of the selected files could be downloaded. Retry.");
  }
  saveBytes(blob, zipName(files), "application/zip");
  return progress;
}
