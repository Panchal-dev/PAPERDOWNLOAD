// GET /api/files/[...filename]
//
// Legacy route kept for backward compatibility with shared links that were
// generated before the Vercel Blob migration.
//
// New downloads now use Vercel Blob public URLs directly — this route is no
// longer the primary serving path. It returns 410 Gone so old links fail
// gracefully with a clear message rather than a cryptic 404.

import { NextResponse } from "next/server";

export const runtime = "nodejs";

export async function GET(): Promise<NextResponse> {
  return NextResponse.json(
    {
      error:
        "This link has expired. Please re-fetch the papers to get a fresh download link.",
    },
    {
      status: 410, // 410 Gone — resource no longer served here.
    },
  );
}
