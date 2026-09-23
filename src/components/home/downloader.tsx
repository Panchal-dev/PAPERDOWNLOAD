// Downloader: the core form + results orchestrator for the home page.
// Owns selection state, syncs it to the URL, and gates downloads on verification.
// One fetch returns every format plus the syllabus — no option to pick.

"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { motion } from "framer-motion";
import { ShieldCheck } from "lucide-react";
import { DOWNLOAD_STATUS } from "@/constants/download.constants";
import {
  DIPLOMA_CODE_PREFIX,
  DIPLOMA_COURSE,
} from "@/constants/app.constants";
import { downloadRequestSchema } from "@/schemas/download.schema";
import { useCourseSelection } from "@/hooks/use-course-selection";
import { useDownload } from "@/hooks/use-download";
import { useTurnstile } from "@/hooks/use-turnstile";
import { readUrlState, writeUrlState } from "@/lib/url-state";
import { parseSubjectCodes } from "@/utils/subject-code";
import { CourseSelector } from "@/components/course/course-selector";
import { SubjectInput } from "@/components/subject/subject-input";
import { DownloadButton } from "@/components/download/download-button";
import { DownloadStatus } from "@/components/download/download-status";
import { DownloadResults } from "@/components/download/download-results";
import { TurnstileWidget } from "@/components/captcha/turnstile-widget";
import { ResultsSkeleton } from "@/components/feedback/form-skeleton";
import { Alert } from "@/components/ui/alert";
import { Card } from "@/components/ui/card";

export function Downloader({
  initialCourse,
  initialSubjects,
}: {
  initialCourse: string;
  initialSubjects: string;
}) {
  // Selections: deep-link values win on first paint, then user edits take over.
  const { course, select } = useCourseSelection(initialCourse);
  const [subjectsRaw, setSubjectsRaw] = useState(initialSubjects);
  const [copied, setCopied] = useState(false);
  // Bumps per submit so the download button remounts with a fresh timer.
  const [runId, setRunId] = useState(0);

  // Turnstile: checked once on load; widget appears only when required.
  const turnstile = useTurnstile();
  const [captchaOpen, setCaptchaOpen] = useState(false);

  // Opens the widget when the server rejects a request with 403.
  const { status, data, error, pendingCount, download, reset } = useDownload({
    onVerificationRequired: () => setCaptchaOpen(true),
  });

  const loading = status === DOWNLOAD_STATUS.loading;
  const codes = useMemo(() => parseSubjectCodes(subjectsRaw), [subjectsRaw]);

  // Partial results stream in while loading; full skeleton only when
  // nothing has arrived yet.
  const hasPartial =
    !!data && (data.files.length > 0 || data.failed.length > 0);

  // Local validation mirror for disabling the submit button early.
  const formValid = useMemo(() => {
    return downloadRequestSchema.safeParse({
      course,
      subjects: codes,
    }).success;
  }, [course, codes]);

  // Keeps the URL shareable: every selection change rewrites the query string.
  useEffect(() => {
    const query = writeUrlState({ course, subjectsRaw });
    const url = `${window.location.pathname}${query}`;
    window.history.replaceState(null, "", url);
  }, [course, subjectsRaw]);

  // Hydrates the form when arriving via back/forward navigation.
  useEffect(() => {
    const onPopState = () => {
      clearSettledResults();
      const state = readUrlState(window.location.search);
      if (state.course) select(state.course);
      setSubjectsRaw(state.subjectsRaw);
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

  // Verifies the widget token, then retries the pending download once.
  const onWidgetVerified = useCallback(
    async (token: string) => {
      const ok = await turnstile.verify(token);
      if (ok) {
        setCaptchaOpen(false);
        await turnstile.refresh();
        void download({ course, subjects: codes });
      }
    },
    [turnstile, download, course, codes],
  );

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

  // Shows the widget while its status is unknown or explicitly required.
  const needsWidget =
    turnstile.enabled &&
    (captchaOpen || (!turnstile.unknown && !turnstile.verified));

  // Remounts results per fetch so checkbox selections never carry over.
  const resultKey = data
    ? `${data.successCount}-${data.totalPdfs}-${data.processingTime}-${data.files.length}`
    : "no-data";

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
  function handleCourseSelect(next: string) {
    clearSettledResults();
    select(next);
  }

  // Tracks subject input; a DI-prefixed code auto-selects the DI course
  // (diploma codes embed their course — no other prefix switches).
  function handleSubjectsChange(raw: string) {
    clearSettledResults();
    setSubjectsRaw(raw);
    const entered = parseSubjectCodes(raw);
    if (
      entered.some((code) => code.startsWith(DIPLOMA_CODE_PREFIX)) &&
      course !== DIPLOMA_COURSE
    ) {
      select(DIPLOMA_COURSE);
    }
  }

  return (
    <div className="grid gap-6 lg:grid-cols-[380px_1fr]">
      <motion.section
        aria-label="Paper selection"
        // Sticks the form beside the scrolling results on desktop:
        // self-start keeps it from stretching (sticky needs that),
        // top clears the sticky header, max-h + scroll covers short screens.
        className="lg:sticky lg:top-[72px] lg:max-h-[calc(100vh-88px)] lg:self-start lg:overflow-y-auto"
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.25 }}
      >
        <Card className="p-5">
          <form onSubmit={onSubmit} className="flex flex-col gap-5">
            <CourseSelector value={course} onChange={handleCourseSelect} />
            <SubjectInput value={subjectsRaw} onChange={handleSubjectsChange} />
            {needsWidget && (
              <TurnstileWidget
                onVerified={onWidgetVerified}
                verifying={turnstile.verifying}
                error={turnstile.error}
              />
            )}
            {turnstile.enabled && turnstile.verified && !captchaOpen && (
              <p className="flex items-center gap-1.5 text-xs text-[var(--gtu-text-muted)]">
                <ShieldCheck
                  className="h-3.5 w-3.5 text-[var(--gtu-success)]"
                  aria-hidden="true"
                />
                Verified — downloads won&apos;t ask again for a while.
              </p>
            )}
            <DownloadButton key={runId} loading={loading} disabled={!formValid} />
            <DownloadStatus
              status={status}
              error={error}
              successCount={data?.successCount ?? 0}
              totalPdfs={data?.totalPdfs ?? 0}
            />
          </form>
        </Card>
      </motion.section>

      <motion.section
        aria-label="Download results"
        aria-live="polite"
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.25, delay: 0.05 }}
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
            shareUrl=""
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
      </motion.section>
    </div>
  );
}
