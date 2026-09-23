// Upstream paper-availability types shared by server modules.

export type PaperFormat =
  | "single"
  | "summer-pack"
  | "winter-pack"
  | "merged-winter-first"
  | "merged-interleaved"
  | "merged-summer-first"
  | "syllabus";

export interface SessionFetchResult {
  session: string;
  ok: boolean;
  bytes?: Buffer;
}

// One fetched session: validated PDF bytes plus the exact upstream URL
// that served them (primary or fallback host, whichever worked).
export interface SessionAsset {
  bytes: Buffer;
  url: string;
}

export interface SubjectPapers {
  subjectCode: string;
  files: Map<string, SessionAsset>;
  summerSessions: string[];
  winterSessions: string[];
}

export interface BuiltFile {
  filename: string;
  bytes: Buffer;
  format: PaperFormat;
}
