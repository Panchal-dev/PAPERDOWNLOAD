// Request validation for the download API.
// Zod runs on both client (fast feedback) and server (trust boundary).

import { z } from "zod";
import { COURSES, SUBJECT_CODE_PATTERN } from "@/constants/app.constants";
import { DOWNLOAD_CONFIG } from "@/config/download.config";

const MAX_SUBJECTS = DOWNLOAD_CONFIG.maxSubjectsPerRequest;

// Single subject code: trimmed + uppercased before pattern check.
const subjectCodeSchema = z
  .string()
  .trim()
  .toUpperCase()
  .regex(SUBJECT_CODE_PATTERN, "Enter a valid subject code (letters/digits, 4–10 chars)");

export const downloadRequestSchema = z.object({
  course: z
    .string()
    .trim()
    .toUpperCase()
    .refine((value) => (COURSES as readonly string[]).includes(value), {
      message: "Select a valid course",
    }),
  subjects: z
    .array(subjectCodeSchema)
    .min(1, "Enter at least one subject code")
    .max(MAX_SUBJECTS, `Up to ${MAX_SUBJECTS} subjects per request`)
    .refine((codes) => new Set(codes).size === codes.length, {
      message: "Remove duplicate subject codes",
    }),
});

export type DownloadRequestInput = z.infer<typeof downloadRequestSchema>;
