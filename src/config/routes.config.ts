// Canonical route definitions.
// Pages build hrefs from here so renames only touch one file.

export const ROUTES_CONFIG = {
  home: "/",
  howToUse: "/how-to-use",
  api: {
    pdf: (course: string, subject: string, session: string) =>
      `/api/pdf/${course}/${subject}/${session}`,
  },
} as const;
