// Single source of truth for upstream GTU URLs.
// SSRF guard: the server never fetches a URL that came from the client.
// It only builds URLs from validated parts on fixed, allow-listed hosts.

import { DOWNLOAD_CONFIG } from "@/config/download.config";
import { COURSES, SUBJECT_CODE_PATTERN } from "@/constants/app.constants";

const SESSION_PATTERN = /^[SW](20\d{2})$/;
const SYLLABUS = "SYLLABUS";

interface PaperRef {
  course: string;
  subject: string;
  session: string; // "W2024" | "S2025" | "SYLLABUS"
}

// Validates and normalises the three path parts. Returns null when invalid.
export function parsePaperRef(
  course: string,
  subject: string,
  session: string,
): PaperRef | null {
  const c = course.trim().toUpperCase();
  const s = subject.trim().toUpperCase();
  const ses = session.trim().toUpperCase().replace(/\.PDF$/, "");
  if (!(COURSES as readonly string[]).includes(c)) return null;
  if (!SUBJECT_CODE_PATTERN.test(s)) return null;
  if (ses !== SYLLABUS && !SESSION_PATTERN.test(ses)) return null;
  return { course: c, subject: s, session: ses };
}

export function upstreamUrl(ref: PaperRef): string {
  if (ref.session === SYLLABUS) {
    return `${DOWNLOAD_CONFIG.syllabusBaseUrl}/${ref.subject}.pdf`;
  }
  return `${DOWNLOAD_CONFIG.gtuBaseUrl}/${ref.session}/${ref.course}/${ref.subject}.pdf`;
}

export function outputFilename(ref: PaperRef): string {
  return `${ref.course}_${ref.subject}_${ref.session}.pdf`;
}
