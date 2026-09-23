// Subject-code helpers: normalize free-text input into clean codes.
// Used by the form, URL parsing, and deep-link routes.

import { SUBJECT_CODE_PATTERN } from "@/constants/app.constants";

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

// Returns only codes that match the GTU format; drops the rest.
export function validSubjectCodes(raw: string): string[] {
  return parseSubjectCodes(raw).filter((code) => SUBJECT_CODE_PATTERN.test(code));
}

// True when every entered code matches the GTU format.
export function isSubjectInputValid(raw: string): boolean {
  const codes = parseSubjectCodes(raw);
  return codes.length > 0 && codes.every((code) => SUBJECT_CODE_PATTERN.test(code));
}
