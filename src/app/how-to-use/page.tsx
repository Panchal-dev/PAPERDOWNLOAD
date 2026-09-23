// How-to-use guide: steps and troubleshooting.
// Static content — no client JS needed beyond the shared layout.

import type { Metadata } from "next";
import Link from "next/link";
import { ROUTES_CONFIG } from "@/config/routes.config";
import { Card } from "@/components/ui/card";

export const metadata: Metadata = {
  title: "How to use",
  description:
    "Learn how to download GTU previous-year question papers and syllabi: select a course, enter subject codes, and get every format in one fetch.",
};

const STEPS = [
  {
    num: "1",
    title: "Select your course",
    body: 'Open the course dropdown and pick your program — e.g. "BE" for Bachelor of Engineering or "DI" for Diploma. Your choice is remembered between visits.',
  },
  {
    num: "2",
    title: "Enter subject code(s)",
    body: 'Type one or more 7-digit subject codes separated by commas — e.g. 3150713 or 3150713, 3160704. Up to 5 subjects per request.',
  },
  {
    num: "3",
    title: 'Click "Fetch papers"',
    body: "One request fetches everything in parallel: every individual paper from 2017 to the latest session, two season packs (Summer + Winter), three merged PDFs (winter-first, summer-first, interleaved), and the official syllabus — all at the same time.",
  },
  {
    num: "4",
    title: "Browse results by section",
    body: "Results appear on the right panel, grouped by section. Each section has a distinct colour:\n• Purple → Syllabus\n• Sky blue → Single papers (newest first)\n• Emerald → Season packs\n• Amber → Merged winter-first\n• Rose → Merged summer-first\n• Teal → Merged interleaved",
  },
  {
    num: "5",
    title: "Download files",
    body: 'Each row shows the filename, file size (centre), and View / Download buttons. Click "View" to open in a new tab or "Download" to save directly.',
  },
  {
    num: "6",
    title: "Bulk download or .zip",
    body: 'Tick the checkboxes next to any files (use "Select all" in a section header or the global "Select all" at the top). Then hit "Files" to save one-by-one or ".zip" to pack them into a single archive named after your course and subject codes — e.g. GTU_BE_3150713.zip.',
  },
] as const;

const FAQS = [
  {
    question: "A paper shows as unavailable — why?",
    answer:
      "The GTU archive has no PDF for that session and subject. Older or less-common subjects often have gaps. The \"Not in the archive\" card at the bottom lists exactly which sessions are missing.",
  },
  {
    question: "The syllabus is missing.",
    answer:
      "Syllabi are hosted separately on the GTU circular server and are not published for every subject code. Your paper downloads are unaffected.",
  },
  {
    question: "My download link stopped working.",
    answer:
      "Generated merged-pack files expire after a few hours to save disk space. Re-run the same fetch — the shareable URL in the address bar remembers your course and subjects.",
  },
  {
    question: "The request timed out or failed.",
    answer:
      "GTU's servers occasionally respond slowly. Try again — the fetch is fully parallel so it usually completes in a few seconds. If one subject consistently fails, try fetching it alone.",
  },
  {
    question: "How do share links work?",
    answer:
      "Your course and subject codes are stored in the URL as ?course=BE&subjects=3150713. Copy the address bar and share it — opening the link pre-fills the form and runs the fetch automatically.",
  },
  {
    question: "How do I switch between light and dark mode?",
    answer:
      "Use the ☀️ / 🌙 toggle in the header. On first visit the theme follows your operating system setting. Your choice is saved for future visits.",
  },
  {
    question: "What is the .zip named after?",
    answer:
      'The archive is named from your course and subject codes — for example GTU_BE_3150713.zip or GTU_BE_3150713_3160704.zip for multiple subjects — so you always know what is inside.',
  },
] as const;

export default function HowToUsePage() {
  return (
    <div className="mx-auto max-w-3xl px-4 py-8 sm:px-6 sm:py-10">
      <h1 className="text-2xl font-bold tracking-tight">How to use</h1>
      <p className="mt-2 text-[15px] text-[var(--gtu-text-secondary)]">
        Six steps from subject code to downloaded PDF — plus answers to common
        questions.{" "}
        <Link
          href={ROUTES_CONFIG.home}
          className="font-medium text-[var(--gtu-accent)] underline underline-offset-2"
        >
          Open the downloader →
        </Link>
      </p>

      {/* Steps */}
      <ol className="mt-6 flex flex-col gap-3" aria-label="Steps">
        {STEPS.map((step) => (
          <li key={step.num}>
            <Card className="flex gap-4 p-4">
              <span
                aria-hidden="true"
                className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-[var(--gtu-accent-soft)] text-sm font-bold text-[var(--gtu-accent)]"
              >
                {step.num}
              </span>
              <div>
                <h2 className="text-[15px] font-semibold">{step.title}</h2>
                <p className="mt-1 whitespace-pre-line text-sm leading-relaxed text-[var(--gtu-text-secondary)]">
                  {step.body}
                </p>
              </div>
            </Card>
          </li>
        ))}
      </ol>

      {/* FAQs */}
      <h2 className="mt-10 text-lg font-bold">Common questions</h2>
      <div className="mt-3 flex flex-col gap-3">
        {FAQS.map((faq) => (
          <Card key={faq.question} className="p-4">
            <h3 className="text-[15px] font-semibold">{faq.question}</h3>
            <p className="mt-1 text-sm leading-relaxed text-[var(--gtu-text-secondary)]">
              {faq.answer}
            </p>
          </Card>
        ))}
      </div>
    </div>
  );
}
