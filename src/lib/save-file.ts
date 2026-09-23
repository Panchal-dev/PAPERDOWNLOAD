// Saves a same-origin file URL through a blob anchor download.
// Shared by single-row and bulk downloads so the logic lives once.

const URL_REVOKE_DELAY_MS = 5000;

// Saves an already-known URL straight through a plain anchor download.
// Used for upstream GTU links (no fetch, so no CORS or server hop).
export function saveDirectUrl(url: string, filename: string): void {
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = filename;
  anchor.rel = "noopener";
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
}

// Fetches the file, then hands it to the browser as a real download.
export async function saveFileFromUrl(
  url: string,
  filename: string,
): Promise<void> {
  const response = await fetch(url);
  if (!response.ok) {
    throw new Error(
      response.status === 404 ? "File expired" : "Download failed",
    );
  }
  const blob = await response.blob();
  const objectUrl = URL.createObjectURL(blob);
  try {
    const anchor = document.createElement("a");
    anchor.href = objectUrl;
    anchor.download = filename;
    document.body.appendChild(anchor);
    anchor.click();
    anchor.remove();
  } finally {
    window.setTimeout(
      () => URL.revokeObjectURL(objectUrl),
      URL_REVOKE_DELAY_MS,
    );
  }
}
