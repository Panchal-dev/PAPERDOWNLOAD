// Shareable URL state: course + subjects as search params.
// Keeps refresh, back/forward, and shared links working from one module.

import { URL_PARAMS } from "@/constants/app.constants";
import { parseSubjectCodes } from "@/utils/subject-code";

export interface UrlDownloadState {
  course: string;
  subjectsRaw: string;
}

// Reads the current download state from a query string.
export function readUrlState(search: string): UrlDownloadState {
  const params = new URLSearchParams(search);
  return {
    course: params.get(URL_PARAMS.course) ?? "",
    subjectsRaw: params.get(URL_PARAMS.subjects) ?? "",
  };
}

// Serializes state back to a query string, omitting empty values.
export function writeUrlState(state: UrlDownloadState): string {
  const params = new URLSearchParams();
  const course = state.course.trim().toUpperCase();
  const subjects = parseSubjectCodes(state.subjectsRaw).join(",");
  if (course) params.set(URL_PARAMS.course, course);
  if (subjects) params.set(URL_PARAMS.subjects, subjects);
  const text = params.toString();
  return text.length > 0 ? `?${text}` : "";
}
