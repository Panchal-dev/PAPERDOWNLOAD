// Shared application constants: courses, labels, limits.
// Imported by components, schemas, and server code alike.

import { DOWNLOAD_CONFIG } from "@/config/download.config";

// Full course catalogue carried over from the legacy web UI.
export const COURSES = [
  "BE", "AF", "BA", "BB", "BC", "BD", "BESP", "BH", "BI", "BL", "BM", "BN",
  "BP", "BPSP", "BS", "BSIT", "BT", "BV", "CI", "CS", "DA", "DB", "DH", "DI",
  "DISP", "DM", "DP", "DS", "DV", "EP", "FD", "HM", "IB", "IC", "IM", "MA",
  "MB", "MC", "MCSP", "MD", "ME", "MH", "ML", "MN", "MP", "MR", "MS", "MT",
  "MV", "PB", "PD", "PH", "PM", "PP", "PR", "TE", "VP",
] as const;

export type CourseCode = (typeof COURSES)[number];

// All sessions covered per subject, newest first.
export const ALL_SESSIONS: readonly string[] = [
  ...DOWNLOAD_CONFIG.summerSessions,
  ...DOWNLOAD_CONFIG.winterSessions,
] as const;

// Subject-code format accepted by GTU hosts (e.g. 3160704, DI03000031).
export const SUBJECT_CODE_PATTERN = /^[A-Z0-9]{4,10}$/;

// Diploma subject codes embed their course (e.g. DI03000031) — entering
// one auto-selects the DI course. No other prefix triggers a switch.
export const DIPLOMA_CODE_PREFIX = "DI";
export const DIPLOMA_COURSE: CourseCode = "DI";

// Query-string keys used for shareable / refresh-safe URLs.
export const URL_PARAMS = {
  course: "course",
  subjects: "subjects",
} as const;
