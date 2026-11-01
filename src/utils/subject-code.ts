// Subject-code helpers: normalize free-text input into clean codes and
// detect the course embedded in newer prefixed codes (e.g. BE3150710).
// Used by the form, URL parsing, and deep-link routes.

import { COURSES } from "@/constants/app.constants";

const SEPARATOR = /[,\s;]+/;

// Splits raw user input ("3160704, 3160716") into unique uppercased codes.
export function parseSubjectCodes(raw: string): string[] {
  const seen = new Set<string>();
  for (const part of raw.split(SEPARATOR)) {
    const code = part.trim().toUpperCase();
    if (code.length === 0) continue;
    if (!seen.has(code)) seen.add(code);
  }
  return [...seen];
}

// Newer GTU codes start with the course and end in digits
// (BE3150710, DI03000031, BESP3150713). Longest match wins so BESP is not
// mistaken for BE and DISP is not mistaken for DI. Old numeric codes
// (3150713, 319283) return null and need a manually selected course.
export function courseFromSubjectCode(code: string): string | null {
  const upper = code.trim().toUpperCase();
  let match: string | null = null;
  for (const course of COURSES) {
    if (upper.length <= course.length || !upper.startsWith(course)) continue;
    if (!/^[0-9]+$/.test(upper.slice(course.length))) continue;
    if (!match || course.length > match.length) match = course;
  }
  return match;
}

// Distinct courses detected across all entered codes. More than one means
// the request mixes courses and cannot be fetched in a single run.
export function coursesFromSubjectCodes(codes: string[]): string[] {
  const found = new Set<string>();
  for (const code of codes) {
    const course = courseFromSubjectCode(code);
    if (course) found.add(course);
  }
  return [...found];
}
