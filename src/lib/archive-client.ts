// Typed client for the .zip archive API route.
// Posts selected filenames, saves the returned bundle as one download.

const ARCHIVE_PATH = "/api/archive";
const ARCHIVE_TIMEOUT_MS = 180_000;

// Derives a descriptive zip name from the filenames.
// Filenames follow: COURSE_SUBJECTCODE_SESSION.pdf (e.g. BE_3150713_W2024.pdf)
// Result examples: GTU_BE_3150713.zip | GTU_BE_3150713_3150714.zip
function zipName(filenames: string[]): string {
  const seen = new Map<string, Set<string>>(); // course → subject codes
  for (const name of filenames) {
    const parts = name.replace(/\.pdf$/i, "").split("_");
    if (parts.length >= 2) {
      const course = parts[0];
      const subject = parts[1];
      if (!seen.has(course)) seen.set(course, new Set());
      seen.get(course)!.add(subject);
    }
  }
  if (seen.size === 0) return `GTU_Papers_${filenames.length}_files.zip`;
  const out: string[] = ["GTU"];
  for (const [course, subjects] of seen) {
    out.push(course);
    out.push(...[...subjects].sort());
  }
  return `${out.join("_")}.zip`;
}

// Builds a .zip of the given stored files and saves it locally.
export async function downloadAsZip(filenames: string[]): Promise<void> {
  const controller = new AbortController();
  const timeout = window.setTimeout(() => controller.abort(), ARCHIVE_TIMEOUT_MS);
  try {
    const response = await fetch(ARCHIVE_PATH, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ files: filenames }),
      signal: controller.signal,
    });
    if (!response.ok) {
      const body = (await response.json().catch(() => null)) as {
        error?: string;
      } | null;
      throw new Error(body?.error ?? `Archive failed (${response.status})`);
    }
    const blob = await response.blob();
    const objectUrl = URL.createObjectURL(blob);
    try {
      const anchor = document.createElement("a");
      anchor.href = objectUrl;
      anchor.download = zipName(filenames);
      document.body.appendChild(anchor);
      anchor.click();
      anchor.remove();
    } finally {
      window.setTimeout(() => URL.revokeObjectURL(objectUrl), 5000);
    }
  } finally {
    window.clearTimeout(timeout);
  }
}
