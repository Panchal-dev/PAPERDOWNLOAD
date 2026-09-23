// POST /api/archive — bundles stored files into one .zip download.
// Same verification + rate-limit guards as /api/download; caps count and
// total size so one request cannot exhaust server memory.

import { NextRequest, NextResponse } from "next/server";
import JSZip from "jszip";
import { z } from "zod";
import { CAPTCHA_CONFIG } from "@/config/captcha.config";
import { readStoredFile } from "@/server/file-store";
import { checkRateLimit, clientKey } from "@/server/rate-limit";
import {
  isVerificationValueValid,
  turnstileEnforced,
} from "@/server/turnstile-verify";

export const runtime = "nodejs";
export const maxDuration = 120;

const ARCHIVE_LIMIT = 10;
const ARCHIVE_WINDOW_MS = 60_000;
const MAX_FILES = 130;
const MAX_NAME_LENGTH = 120;
const MAX_TOTAL_BYTES = 250 * 1024 * 1024;
const VERIFICATION_CODE = "verification_required";

// Filenames arrive exactly as the download API issued them.
const archiveSchema = z.object({
  files: z
    .array(z.string().min(1).max(MAX_NAME_LENGTH))
    .min(1, "Select at least one file")
    .max(MAX_FILES, `Up to ${MAX_FILES} files per archive`),
});

// True when the request carries a live, honestly-issued verification cookie.
function isVerified(request: NextRequest): boolean {
  if (!turnstileEnforced()) return true;
  return isVerificationValueValid(
    request.cookies.get(CAPTCHA_CONFIG.cookieName)?.value,
  );
}

// Derives a descriptive zip name from the stored filenames.
// Filenames: COURSE_SUBJECTCODE_SESSION.pdf → GTU_BE_3150713.zip
function zipName(names: string[]): string {
  const seen = new Map<string, Set<string>>();
  for (const name of names) {
    const parts = name.replace(/\.pdf$/i, "").split("_");
    if (parts.length >= 2) {
      const course = parts[0];
      const subject = parts[1];
      if (!seen.has(course)) seen.set(course, new Set());
      seen.get(course)!.add(subject);
    }
  }
  if (seen.size === 0) return `GTU_Papers_${names.length}_files.zip`;
  const out: string[] = ["GTU"];
  for (const [course, subjects] of seen) {
    out.push(course);
    out.push(...[...subjects].sort());
  }
  return `${out.join("_")}.zip`;
}

export async function POST(request: NextRequest) {
  // Zipping is CPU-heavy: stricter per-client budget than downloads.
  if (
    !checkRateLimit(
      clientKey(request.headers, "archive"),
      ARCHIVE_LIMIT,
      ARCHIVE_WINDOW_MS,
    )
  ) {
    return NextResponse.json(
      { error: "Too many archive requests. Wait a minute and retry." },
      { status: 429 },
    );
  }

  if (!isVerified(request)) {
    return NextResponse.json(
      { error: "Verification required.", code: VERIFICATION_CODE },
      { status: 403 },
    );
  }

  const body = (await request.json().catch(() => null)) as unknown;
  const parsed = archiveSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0]?.message ?? "Invalid request." },
      { status: 400 },
    );
  }

  // Reads every file first (validates names, expiry); aborts on gaps.
  const entries: { name: string; bytes: Buffer }[] = [];
  const missing: string[] = [];
  for (const name of new Set(parsed.data.files)) {
    try {
      entries.push({ name, bytes: await readStoredFile(name) });
    } catch {
      missing.push(name);
    }
  }
  if (missing.length > 0) {
    return NextResponse.json(
      { error: `These files expired. Re-fetch first: ${missing.join(", ")}` },
      { status: 404 },
    );
  }

  const totalBytes = entries.reduce((sum, entry) => sum + entry.bytes.length, 0);
  if (totalBytes > MAX_TOTAL_BYTES) {
    return NextResponse.json(
      { error: "Selection too large for one archive. Split it and retry." },
      { status: 413 },
    );
  }

  const zip = new JSZip();
  for (const entry of entries) {
    zip.file(entry.name, entry.bytes);
  }
  const bytes = await zip.generateAsync({
    type: "nodebuffer",
    compression: "STORE",
  });

  return new NextResponse(new Uint8Array(bytes), {
    status: 200,
    headers: {
      "Content-Type": "application/zip",
      "Content-Disposition": `attachment; filename="${zipName(entries.map((e) => e.name))}"`,
      "Cache-Control": "no-store",
    },
  });
}
