// Route guard for deep paper links: /papers/[course]/[subject].
// Invalid segments rewrite to the internal not-found route BEFORE the page
// streams, so crawlers and clients receive a real 404 status (calling
// notFound() inside the streaming page can only produce a soft 404).

import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { COURSES, SUBJECT_CODE_PATTERN } from "@/constants/app.constants";

const PAPER_SEGMENTS = 3;
const COURSE_INDEX = 1;
const SUBJECT_INDEX = 2;

// Validates /papers/:course/:subject; anything else falls through.
function isValidPaperPath(pathname: string): boolean {
  const segments = pathname.split("/").filter(Boolean);
  if (segments.length !== PAPER_SEGMENTS || segments[0] !== "papers") {
    return true;
  }
  // decodeURIComponent throws on malformed input like "%E0%A4" → was a 500.
  const courseSegment = segments[COURSE_INDEX];
  const subjectSegment = segments[SUBJECT_INDEX];
  if (!courseSegment || !subjectSegment) return false;

  let course: string;
  let subject: string;
  try {
    course = decodeURIComponent(courseSegment).toUpperCase();
    subject = decodeURIComponent(subjectSegment).toUpperCase();
  } catch {
    return false;
  }
  const knownCourse = (COURSES as readonly string[]).includes(course);
  return knownCourse && SUBJECT_CODE_PATTERN.test(subject);
}

export function proxy(request: NextRequest) {
  if (!isValidPaperPath(request.nextUrl.pathname)) {
    return NextResponse.rewrite(new URL("/_not-found", request.url));
  }
  return NextResponse.next();
}

export const config = {
  matcher: "/papers/:path*",
};
