// Shared application constants: courses, labels, limits.
// Imported by components, schemas, and server code alike.

// Full course catalogue carried over from the legacy web UI.
export const COURSES = [
  "BE", "AF", "BA", "BB", "BC", "BD", "BESP", "BH", "BI", "BL", "BM", "BN",
  "BP", "BPSP", "BS", "BSIT", "BT", "BV", "CI", "CS", "DA", "DB", "DH", "DI",
  "DISP", "DM", "DP", "DS", "DV", "EP", "FD", "HM", "IB", "IC", "IM", "MA",
  "MB", "MC", "MCSP", "MD", "ME", "MH", "ML", "MN", "MP", "MR", "MS", "MT",
  "MV", "PB", "PD", "PH", "PM", "PP", "PR", "TE", "VP",
] as const;

// Subject-code format accepted by GTU hosts. Old codes are numeric
// (e.g. 3160704, 319283); newer codes prefix the course
// (e.g. BE3150710, DI03000031, BESP3150713), so allow up to 14 chars.
export const SUBJECT_CODE_PATTERN = /^[A-Z0-9]{4,14}$/;

// Query-string keys used for shareable / refresh-safe URLs.
export const URL_PARAMS = {
  course: "course",
  subjects: "subjects",
} as const;
