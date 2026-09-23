// Browser-storage keys for non-sensitive preferences only.
// Security-sensitive verification state lives in an HttpOnly cookie.

export const STORAGE_KEYS = {
  // Last selected course (restores the form faster on revisit).
  lastCourse: "gtu:last-course",
  // Dismissed helper hints.
  dismissedHints: "gtu:dismissed-hints",
} as const;
