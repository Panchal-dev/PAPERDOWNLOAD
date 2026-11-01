// GET /api/pdf/:course/:subject/:session  (session = W2024 | S2025 | SYLLABUS)
// Streams one upstream PDF through this origin with
//   Content-Disposition: attachment  -> real download, never a new tab
//   Cache-Control: public, s-maxage  -> the CDN keeps a copy for a day and
//                                       then drops it (this IS the "temporary
//                                       storage with auto-delete"; no DB).
// Streaming means no 4.5 MB body limit and ~64 KB memory per request.
// ?inline=1 serves it inline for the "View" button.

import { NextRequest, NextResponse } from "next/server";
import { parsePaperRef, upstreamUrl, outputFilename } from "@/server/gtu-urls";
import { checkRateLimit, clientKey } from "@/server/rate-limit";

export const runtime = "nodejs";
export const maxDuration = 60;

const UPSTREAM_TIMEOUT_MS = 20_000;
const CDN_CACHE = "public, max-age=3600, s-maxage=86400, stale-while-revalidate=604800";
const UA =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 " +
  "(KHTML, like Gecko) Chrome/140.0 Safari/537.36";

export async function GET(
  request: NextRequest,
  context: { params: Promise<{ course: string; subject: string; session: string }> },
) {
  if (!checkRateLimit(clientKey(request.headers, "pdf"), 120, 60_000)) {
    return NextResponse.json({ error: "Too many requests." }, { status: 429 });
  }
  const p = await context.params;
  const ref = parsePaperRef(p.course, p.subject, p.session);
  if (!ref) {
    return NextResponse.json({ error: "Invalid paper reference." }, { status: 400 });
  }

  let upstream: Response;
  try {
    upstream = await fetch(upstreamUrl(ref), {
      headers: { "User-Agent": UA, Accept: "application/pdf,*/*" },
      signal: AbortSignal.timeout(UPSTREAM_TIMEOUT_MS),
      cache: "no-store",
      // Never let an upstream redirect take the request off the allow-list.
      redirect: "manual",
    });
  } catch {
    return NextResponse.json({ error: "GTU server did not respond. Retry." }, { status: 504 });
  }
  if (upstream.status >= 300 && upstream.status < 400) {
    return NextResponse.json(
      { error: "GTU redirected the request; refusing to follow." },
      { status: 502 },
    );
  }
  if (upstream.status === 404 || upstream.status === 403) {
    return NextResponse.json(
      { error: "Paper not found on GTU." },
      { status: 404, headers: { "Cache-Control": "public, s-maxage=3600" } },
    );
  }
  if (!upstream.ok || !upstream.body) {
    return NextResponse.json({ error: `GTU error ${upstream.status}. Retry.` }, { status: 502 });
  }

  // Peek the first chunk: refuse HTML error pages served as 200.
  const reader = upstream.body.getReader();
  const first = await reader.read();
  const head = first.value ? new TextDecoder().decode(first.value.subarray(0, 5)) : "";
  if (!head.startsWith("%PDF")) {
    await reader.cancel().catch(() => undefined);
    return NextResponse.json({ error: "GTU returned a non-PDF file." }, { status: 502 });
  }
  const body = new ReadableStream<Uint8Array>({
    start(controller) {
      if (first.value) controller.enqueue(first.value);
    },
    async pull(controller) {
      const { done, value } = await reader.read();
      if (done) controller.close();
      else controller.enqueue(value);
    },
    cancel(reason) {
      return reader.cancel(reason);
    },
  });

  const inline = request.nextUrl.searchParams.get("inline") === "1";
  const name = outputFilename(ref);
  const headers = new Headers({
    "Content-Type": "application/pdf",
    "Content-Disposition": `${inline ? "inline" : "attachment"}; filename="${name}"`,
    "Cache-Control": CDN_CACHE,
    "X-Content-Type-Options": "nosniff",
  });
  const len = upstream.headers.get("content-length");
  if (len) headers.set("Content-Length", len);
  return new Response(body, { status: 200, headers });
}
