// Canonical route definitions.
// Pages build hrefs from here so renames only touch one file.

export const ROUTES_CONFIG = {
  home: "/",
  howToUse: "/how-to-use",
  paperDetail: (course: string, subject: string) =>
    `/papers/${encodeURIComponent(course)}/${encodeURIComponent(subject)}`,
  api: {
    download: "/api/download",
    file: (filename: string) =>
      `/api/files/${encodeURIComponent(filename)}`,
    verifyTurnstile: "/api/verify-turnstile",
    health: "/api/health",
  },
} as const;
