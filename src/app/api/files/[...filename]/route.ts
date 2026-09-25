// GET /api/files/[...filename] — streams generated PDFs from temp storage.
// Validates names strictly; never exposes internal paths.
// ?view=1 serves inline for new-tab preview; default forces download.

import { NextRequest, NextResponse } from "next/server";
import { Readable } from "node:stream";
import { openStoredFileStream } from "@/server/file-store";
import { checkRateLimit, clientKey } from "@/server/rate-limit";

export const runtime = "nodejs";

const FILE_LIMIT = 60;
const FILE_WINDOW_MS = 60_000;

export async function GET(
  request: NextRequest,
  context: { params: Promise<{ filename: string[] }> },
) {
  if (
    !checkRateLimit(
      clientKey(request.headers, "files"),
      FILE_LIMIT,
      FILE_WINDOW_MS,
    )
  ) {
    return NextResponse.json({ error: "Too many requests." }, { status: 429 });
  }

  const { filename } = await context.params;
  const name = filename.join("/");
  const inline = request.nextUrl.searchParams.get("view") === "1";

  try {
    const nodeStream = await openStoredFileStream(name);
    // Convert Node Readable → Web ReadableStream so Next.js streams the
    // body chunk-by-chunk instead of materializing the whole file. Peak
    // memory per request drops from ~file size to ~64 KB (one chunk).
    const webStream = Readable.toWeb(nodeStream) as ReadableStream<Uint8Array>;
    return new NextResponse(webStream, {
      status: 200,
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": `${inline ? "inline" : "attachment"}; filename="${name}"`,
        "Cache-Control": "private, max-age=3600",
      },
    });
  } catch {
    return NextResponse.json(
      { error: "File not found or expired." },
      { status: 404 },
    );
  }
}
