// Deep-link paper page: /papers/[course]/[subject].
// Pre-fills the downloader and adds per-subject SEO metadata.

import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { COURSES, SUBJECT_CODE_PATTERN } from "@/constants/app.constants";
import { Downloader } from "@/components/home/downloader";

interface PaperParams {
  course: string;
  subject: string;
}

// Validates path segments; unknown courses/subjects render the 404 page.
function parseParams(params: PaperParams): { course: string; subject: string } | null {
  const course = decodeURIComponent(params.course).toUpperCase();
  const subject = decodeURIComponent(params.subject).toUpperCase();
  const knownCourse = (COURSES as readonly string[]).includes(course);
  if (!knownCourse || !SUBJECT_CODE_PATTERN.test(subject)) return null;
  return { course, subject };
}

export async function generateMetadata({
  params,
}: {
  params: Promise<PaperParams>;
}): Promise<Metadata> {
  const resolved = await params;
  const parsed = parseParams(resolved);
  if (!parsed) return { title: "Paper not found" };
  return {
    title: `${parsed.subject} · ${parsed.course} papers`,
    description: `Download previous-year ${parsed.course} question papers and the syllabus for subject ${parsed.subject} from the GTU archive.`,
  };
}

export default async function PaperDetailPage({
  params,
}: {
  params: Promise<PaperParams>;
}) {
  const parsed = parseParams(await params);
  if (!parsed) notFound();
  return (
    <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6 sm:py-10">
      <div className="mb-6 max-w-2xl">
        <h1 className="text-2xl font-bold tracking-tight">
          {parsed.subject}{" "}
          <span className="font-normal text-[var(--gtu-text-secondary)]">
            · {parsed.course}
          </span>
        </h1>
        <p className="mt-2 text-[15px] text-[var(--gtu-text-secondary)]">
          Pre-filled for this subject — fetch to get every format plus the
          syllabus.
        </p>
      </div>
      <Downloader
        initialCourse={parsed.course}
        initialSubjects={parsed.subject}
      />
    </div>
  );
}
