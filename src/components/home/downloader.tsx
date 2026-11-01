// Downloader: the core form + results orchestrator for the home page.
// Owns selection state and syncs it to the URL. No captcha / human check.
// One fetch returns the syllabus, every paper and the merged PDFs.

"use client";

import {
  useEffect,
  useMemo,
  useRef,
  useState,
  useSyncExternalStore,
} from "react";
import { DOWNLOAD_STATUS } from "@/constants/download.constants";
import { downloadRequestSchema } from "@/schemas/download.schema";
import { useCourseSelection } from "@/hooks/use-course-selection";
import { useDownload } from "@/hooks/use-download";
import { readUrlState, writeUrlState } from "@/lib/url-state";
import {
  coursesFromSubjectCodes,
  parseSubjectCodes,
} from "@/utils/subject-code";
import { CourseSelector } from "@/components/course/course-selector";
import { SubjectInput } from "@/components/subject/subject-input";
import { DownloadButton } from "@/components/download/download-button";
import { DownloadStatus } from "@/components/download/download-status";
import { DownloadResults } from "@/components/download/download-results";
import { ResultsSkeleton } from "@/components/feedback/form-skeleton";
import { Alert } from "@/components/ui/alert";
import { Card } from "@/components/ui/card";

export function Downloader({
  initialCourse = "",
  initialSubjects = "",
}: {
  initialCourse?: string;
  initialSubjects?: string;
} = {}) {
  // Selections: deep-link values win after hydration, then user edits take over.
  const { course, select, reset: resetCourse } = useCourseSelection(initialCourse);
  const [subjectsRaw, setSubjectsRaw] = useState(initialSubjects);
  const [copied, setCopied] = useState(false);
  // Bumps per submit so the download button remounts with a fresh timer.
  const [runId, setRunId] = useState(0);
  // True once the user explicitly picks a course from the dropdown for
  // old-style codes. While this is set, editing codes won't wipe that pick.
  // Cleared when codes are fully deleted or when a new-style code
  // auto-detects a different course (auto-detect takes over again).
  const [courseManuallySet, setCourseManuallySet] = useState(
    () => !!initialCourse,
  );

  const { status, data, error, pendingCount, download, reset } = useDownload();

  const loading = status === DOWNLOAD_STATUS.loading;
  const codes = useMemo(() => parseSubjectCodes(subjectsRaw), [subjectsRaw]);
  // Courses embedded in prefixed codes (BE3150710, DI3150713). More than
  // one distinct course means the codes cannot be fetched together.
  const detectedCourses = useMemo(
    () => coursesFromSubjectCodes(codes),
    [codes],
  );
  const courseConflict = detectedCourses.length > 1;

  // Partial results stream in while loading; full skeleton only when
  // nothing has arrived yet.
  const hasPartial =
    !!data && (data.files.length > 0 || data.failed.length > 0);

  // Local validation mirror for disabling the submit button early.
  const formValid = useMemo(() => {
    if (courseConflict) return false;
    return downloadRequestSchema.safeParse({
      course,
      subjects: codes,
    }).success;
  }, [course, codes, courseConflict]);

  // Keeps the URL shareable: every user change rewrites the query string.
  // The first pass is skipped so a static page cannot overwrite a deep link
  // before <HomeDownloader> has applied it.
  const firstSync = useRef(true);
  useEffect(() => {
    if (firstSync.current) {
      firstSync.current = false;
      return;
    }
    const query = writeUrlState({ course, subjectsRaw });
    const url = `${window.location.pathname}${query}`;
    window.history.replaceState(null, "", url);
  }, [course, subjectsRaw]);

  // Hydrates the form when arriving via back/forward navigation.
  useEffect(() => {
    const onPopState = () => {
      clearSettledResults();
      const state = readUrlState(window.location.search);
      if (state.course) {
        setCourseManuallySet(true);
        select(state.course.toUpperCase());
      } else {
        const detected = coursesFromSubjectCodes(
          parseSubjectCodes(state.subjectsRaw),
        );
        if (detected.length === 1 && detected[0]) {
          setCourseManuallySet(false);
          select(detected[0]);
        } else if (detected.length === 0 && state.subjectsRaw.trim()) {
          // Old-style codes in URL — clear course and manual flag so user is prompted.
          setCourseManuallySet(false);
          resetCourse();
        }
      }
      setSubjectsRaw(state.subjectsRaw.toUpperCase());
    };
    window.addEventListener("popstate", onPopState);
    return () => window.removeEventListener("popstate", onPopState);
    // Re-subscribes when settled-state flips so back/forward clears stale
    // results with the selection it actually sees.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [select, status]);

  // Submits the validated payload to the download API.
  function onSubmit(event: React.FormEvent) {
    event.preventDefault();
    reset();
    setRunId((id) => id + 1);
    void download({ course, subjects: codes });
  }

  // Copies the current URL (which already encodes the selection).
  async function copyShareLink() {
    try {
      await navigator.clipboard.writeText(window.location.href);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 2000);
    } catch {
      setCopied(false);
    }
  }

  // Remounts results per fetch (not per landed file) so selections made
  // while files are still arriving are kept, and never carry over to a new fetch.
  const resultKey = `run-${runId}`;

  // Clears settled results when the selection changes, so displayed links
  // (and their /BE/ /DI/ path segments) can never disagree with the
  // currently selected course. In-flight requests are left alone.
  function clearSettledResults() {
    if (
      status === DOWNLOAD_STATUS.success ||
      status === DOWNLOAD_STATUS.error
    ) {
      reset();
    }
  }

  // Tracks course picks (explicit handler keeps results in sync).
  // Also marks that the user has intentionally chosen a course, so
  // editing old-style subject codes won't wipe the selection.
  function handleCourseSelect(next: string) {
    clearSettledResults();
    setCourseManuallySet(true);
    select(next);
  }

  // Tracks subject input.
  //
  // Course-detection rules (in priority order):
  //   1. ONE distinct course prefix across all prefixed codes → auto-select.
  //      Old-style (no-prefix) codes alongside are fine — they inherit the
  //      detected course (e.g. DI3150713 + 3150710 → course = DI).
  //   2. No prefixed codes at all (all old-style) + user hasn't manually
  //      chosen a course yet → reset to empty so user is prompted.
  //   3. No prefixed codes at all + user DID manually pick a course →
  //      keep their pick (they know the course; don't wipe it on every keystroke).
  //   4. Multiple different course prefixes (BE… + DI… + ME…) → conflict;
  //      leave course as-is and let the conflict alert handle it.
  function handleSubjectsChange(raw: string) {
    clearSettledResults();
    setSubjectsRaw(raw);
    const parsedCodes = parseSubjectCodes(raw);
    const detected = coursesFromSubjectCodes(parsedCodes);

    if (detected.length === 1 && detected[0]) {
      // Rule 1 — single prefix detected (may also have old-style codes mixed in).
      // Auto-detection takes precedence; clear the manual flag so future
      // prefix changes can auto-switch again.
      if (detected[0] !== course) {
        setCourseManuallySet(false);
        select(detected[0]);
      }
    } else if (detected.length === 0) {
      if (parsedCodes.length === 0) {
        // All codes deleted — drop both the course and the manual flag so
        // the form returns to its pristine "nothing selected" state.
        setCourseManuallySet(false);
        if (course) resetCourse();
      } else if (!courseManuallySet) {
        // Old-style codes only, user hasn't manually chosen yet → prompt them.
        if (course) resetCourse();
      }
      // else: old-style codes + user already chose manually → keep their pick.
    }
    // detected.length > 1 → conflict alert handles it; don't touch course.
  }

  return (
    <div className="grid grid-cols-1 gap-6 lg:grid-cols-[380px_minmax(0,1fr)]">
      <section
        aria-label="Paper selection"
        // Sticks the form beside the scrolling results on desktop:
        // self-start keeps it from stretching (sticky needs that),
        // top clears the sticky header, max-h + scroll covers short screens.
        className="gtu-fade-up min-w-0 lg:sticky lg:top-[72px] lg:max-h-[calc(100vh-88px)] lg:self-start lg:overflow-y-auto"
      >
        <Card className="p-5">
          <form onSubmit={onSubmit} className="flex flex-col gap-5">
            <div className="flex flex-col gap-1.5">
              <CourseSelector value={course} onChange={handleCourseSelect} />
              {courseConflict && (
                <p role="alert" className="text-xs text-[var(--gtu-error)]">
                  Codes from multiple courses ({detectedCourses.join(", ")})
                  can&apos;t be fetched together.
                </p>
              )}
              {codes.length > 0 && !course && !courseConflict && (
                <p role="alert" className="text-xs text-[var(--gtu-error)]">
                   Please select a course from the dropdown above.
                </p>
              )}
            </div>
            <SubjectInput value={subjectsRaw} onChange={handleSubjectsChange} />
            <DownloadButton key={runId} loading={loading} disabled={!formValid} />
            <DownloadStatus status={status} error={error} />
          </form>
        </Card>
      </section>

      <section
        aria-label="Download results"
        className="gtu-fade-up-delayed min-w-0"
      >
        {loading && !hasPartial ? (
          <Card className="p-5">
            <ResultsSkeleton />
          </Card>
        ) : (
          <DownloadResults
            key={resultKey}
            data={data}
            subjects={codes}
            pendingCount={pendingCount}
            onCopyLink={copyShareLink}
            copied={copied}
          />
        )}
        {status === DOWNLOAD_STATUS.error && !loading && (
          <div className="mt-4">
            <Alert tone="info">
              If the problem persists, check the{" "}
              <a href="/how-to-use" className="underline">
                troubleshooting guide
              </a>
              .
            </Alert>
          </div>
        )}
      </section>
    </div>
  );
}

// URL is an external store: the server snapshot is empty (the route is
// static), and the real query string arrives right after hydration. A keyed
// remount then seeds the form, so there is no hydration mismatch and no
// setState-inside-an-effect.
function subscribeToUrl(onChange: () => void) {
  window.addEventListener("popstate", onChange);
  return () => window.removeEventListener("popstate", onChange);
}

const getUrlSearch = () => window.location.search;
const getServerSearch = () => "";

// Home-page wrapper: applies the shareable query string on the client.
export function HomeDownloader() {
  const search = useSyncExternalStore(
    subscribeToUrl,
    getUrlSearch,
    getServerSearch,
  );
  const state = readUrlState(search);
  // A shared link may carry only prefixed subject codes; derive the course
  // so the form opens ready to submit instead of asking for it again.
  const detected = coursesFromSubjectCodes(parseSubjectCodes(state.subjectsRaw));
  const initialCourse =
    state.course.toUpperCase() || (detected.length === 1 ? detected[0] : "");
  return (
    <Downloader
      key={search}
      initialCourse={initialCourse ?? ""}
      initialSubjects={state.subjectsRaw.toUpperCase()}
    />
  );
}
