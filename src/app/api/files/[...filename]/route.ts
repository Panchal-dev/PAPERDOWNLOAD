// GET /api/files/[...filename] — serves generated PDFs from temp storage.
// Validates names strictly; never exposes internal paths.
// ?view=1 serves inline for new-tab preview; default forces download.

import { NextRequest, NextResponse } from "next/server";
import { readStoredFile } from "@/server/file-store";
import { checkRateLimit, clientKey } from "@/server/rate-limit";

export const runtime = "nodejs";

const FILE_LIMIT = 60;
const FILE_WINDOW_MS = 60_000;

export async function GET(
  request: NextRequest,
  context: { params: Promise<{ filename: string[] }> },
) {
  // Light abuse guard on file serving.
  if (
    !checkRateLimit(
      clientKey(request.headers, "files"),
      FILE_LIMIT,
      FILE_WINDOW_MS,
    )
  ) {
    return NextResponse.json({ error: "Too many requests." }, { status: 429 });
  }

  // Joins catch-all segments, then the store re-validates the name.
  const { filename } = await context.params;
  const name = filename.join("/");
  // Inline previews render in the browser; downloads save to disk.
  const inline = request.nextUrl.searchParams.get("view") === "1";
  try {
    const bytes = await readStoredFile(name);
    return new NextResponse(new Uint8Array(bytes), {
      status: 200,
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": `${inline ? "inline" : "attachment"}; filename="${name}"`,
        "Cache-Control": "private, max-age=3600",
      },
    });
  } catch {
    return NextResponse.json({ error: "File not found or expired." }, { status: 404 });
  }
}
