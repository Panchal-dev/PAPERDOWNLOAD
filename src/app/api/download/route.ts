// POST /api/download — validates, then streams NDJSON events:
// start (expected total) → file / unavailable as each lands → done.
// Files render progressively instead of all at once at the end.
// Requires a valid Turnstile cookie when enforcement is configured.

import { NextRequest, NextResponse } from "next/server";
import { DOWNLOAD_CONFIG } from "@/config/download.config";
import { CAPTCHA_CONFIG } from "@/config/captcha.config";
import { downloadRequestSchema } from "@/schemas/download.schema";
import { fetchSubjectPapers, fetchSyllabus } from "@/server/gtu-fetch";
import { buildPacksAndMerged } from "@/server/pdf-merge";
import { storeFile } from "@/server/file-store";
import { checkRateLimit, clientKey } from "@/server/rate-limit";
import { isVerificationValueValid, turnstileEnforced } from "@/server/turnstile-verify";
import { formatDuration } from "@/utils/format";
import type { DownloadEvent, DownloadFileItem } from "@/types/download.types";

export const runtime = "nodejs";
export const maxDuration = 180;

const DOWNLOAD_LIMIT = 20;
const DOWNLOAD_WINDOW_MS = 60_000;
const VERIFICATION_CODE = "verification_required";

// Expected deliverables per subject: every session single + 2 season
// packs + 3 merged files + 1 syllabus.
function expectedPerSubject(): number {
  return (
    DOWNLOAD_CONFIG.summerSessions.length +
    DOWNLOAD_CONFIG.winterSessions.length +
    2 +
    3 +
    1
  );
}

// True when the request carries a live, honestly-issued verification cookie.
function isVerified(request: NextRequest): boolean {
  if (!turnstileEnforced()) return true;
  return isVerificationValueValid(
    request.cookies.get(CAPTCHA_CONFIG.cookieName)?.value,
  );
}

export async function POST(request: NextRequest) {
  const started = Date.now();

  if (
    !checkRateLimit(
      clientKey(request.headers, "download"),
      DOWNLOAD_LIMIT,
      DOWNLOAD_WINDOW_MS,
    )
  ) {
    return NextResponse.json(
      { error: "Too many requests. Wait a minute and retry." },
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
  const parsed = downloadRequestSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0]?.message ?? "Invalid request." },
      { status: 400 },
    );
  }
  const { course, subjects } = parsed.data;
  const totalPdfs = subjects.length * expectedPerSubject();

  const stream = new ReadableStream({
    async start(controller) {
      const encoder = new TextEncoder();
      const send = (event: DownloadEvent) => {
        controller.enqueue(encoder.encode(`${JSON.stringify(event)}\n`));
      };
      let successCount = 0;
      const files: DownloadFileItem[] = [];
      const failed: string[] = [];
      try {
        send({ type: "start", totalPdfs });

        for (const subjectCode of subjects) {
          const storeAndSend = async (
            filename: string,
            bytes: Buffer,
            format: DownloadFileItem["format"],
            sourceUrl?: string,
          ): Promise<boolean> => {
            try {
              // Sirf woh files disk pe likho jo server se serve hongi.
              // sourceUrl wali (syllabus + singles) GTU se direct jaati
              // hain — UI unhe /api/files se kabhi nahi maangta, isliye
              // local copy pure waste hai. Per subject ~15 writes aur
              // ~3.4 MB disk bachta hai.
              if (!sourceUrl) {
                await storeFile(filename, bytes);
              }
              const item: DownloadFileItem = {
                url: `/api/files/${encodeURIComponent(filename)}`,
                filename,
                sizeBytes: bytes.length,
                format,
                ...(sourceUrl ? { sourceUrl } : {}),
              };
              files.push(item);
              successCount += 1;
              send({ type: "file", file: item });
              return true;
            } catch {
              const entry = `${subjectCode}`;
              failed.push(entry);
              send({ type: "unavailable", entry });
              return false;
            }
          };

          const sendUnavailable = (entry: string) => {
            failed.push(entry);
            send({ type: "unavailable", entry });
          };

          // Syllabus verdict gates single display, so the syllabus card
          // always paints first. Downloads keep racing in the background —
          // only their screen emission waits, never the network work.
          let releaseSingles!: () => void;
          const syllabusGate = new Promise<void>((resolve) => {
            releaseSingles = resolve;
          });
          let syllabusBytes: Buffer | null = null;
          const syllabusPromise = fetchSyllabus(subjectCode).then(
            async (syllabus) => {
              syllabusBytes = syllabus?.bytes ?? null;
              if (syllabus) {
                await storeAndSend(
                  `${course}_${subjectCode}_SYLLABUS.pdf`,
                  syllabus.bytes,
                  "syllabus",
                  syllabus.url,
                );
              } else {
                sendUnavailable(`${subjectCode}_SYLLABUS`);
              }
              releaseSingles();
            },
          );

          const pendingSingles: Promise<unknown>[] = [];
          const papers = await fetchSubjectPapers(
            course,
            subjectCode,
            (session, bytes, url) => {
              pendingSingles.push(
                (async () => {
                  await syllabusGate;
                  await storeAndSend(
                    `${course}_${subjectCode}_${session}.pdf`,
                    bytes,
                    "single",
                    url,
                  );
                })(),
              );
            },
          );
          await Promise.all(pendingSingles);
          await syllabusPromise;

          if (!papers) {
            if (!syllabusBytes) {
              failed.push(subjectCode);
              send({ type: "unavailable", entry: subjectCode });
            } else {
              for (const session of [
                ...DOWNLOAD_CONFIG.summerSessions,
                ...DOWNLOAD_CONFIG.winterSessions,
              ]) {
                const entry = `${subjectCode}_${session}`;
                failed.push(entry);
                send({ type: "unavailable", entry });
              }
            }
            continue;
          }

          const found = new Set(papers.files.keys());
          for (const session of [
            ...DOWNLOAD_CONFIG.summerSessions,
            ...DOWNLOAD_CONFIG.winterSessions,
          ]) {
            if (!found.has(session)) {
              const entry = `${subjectCode}_${session}`;
              failed.push(entry);
              send({ type: "unavailable", entry });
            }
          }

          // Season packs + merged — yeh server pe hi bante hain, inhi ko
          // disk pe store karo (storeAndSend me sourceUrl nahi jaata).
          for (const file of await buildPacksAndMerged(course, papers)) {
            await storeAndSend(file.filename, file.bytes, file.format);
          }

          if (DOWNLOAD_CONFIG.requestDelayMs > 0) {
            await new Promise((resolve) =>
              setTimeout(resolve, DOWNLOAD_CONFIG.requestDelayMs),
            );
          }
        }

        send({
          type: "done",
          successCount,
          totalPdfs,
          processingTime: formatDuration(Date.now() - started),
        });
      } catch {
        send({ type: "error", message: "Processing failed. Retry." });
      } finally {
        controller.close();
      }
    },
  });

  return new Response(stream, {
    status: 200,
    headers: {
      "Content-Type": "application/x-ndjson",
      "Cache-Control": "no-store",
      "X-Accel-Buffering": "no",
    },
  });
}
