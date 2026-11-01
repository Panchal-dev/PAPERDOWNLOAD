// Request validation for the download API.
// Zod runs on both client (fast feedback) and server (trust boundary).
// `zod/mini` keeps only the checks used here, so the client bundle stays small.

import * as z from "zod/mini";
import { COURSES, SUBJECT_CODE_PATTERN } from "@/constants/app.constants";
import { DOWNLOAD_CONFIG } from "@/config/download.config";

const MAX_SUBJECTS = DOWNLOAD_CONFIG.maxSubjectsPerRequest;

// Single subject code: trimmed + uppercased before the pattern check.
const subjectCodeSchema = z.string().check(
  z.trim(),
  z.toUpperCase(),
  z.regex(
    SUBJECT_CODE_PATTERN,
    "Enter a valid subject code (letters/digits, 4–14 chars)",
  ),
);

export const downloadRequestSchema = z.object({
  course: z.string().check(
    z.trim(),
    z.toUpperCase(),
    z.refine((value) => (COURSES as readonly string[]).includes(value), {
      message: "Select a valid course",
    }),
  ),
  subjects: z.array(subjectCodeSchema).check(
    z.minLength(1, "Enter at least one subject code"),
    z.maxLength(MAX_SUBJECTS, `Up to ${MAX_SUBJECTS} subjects per request`),
    z.refine((codes) => new Set(codes).size === codes.length, {
      message: "Remove duplicate subject codes",
    }),
  ),
});
