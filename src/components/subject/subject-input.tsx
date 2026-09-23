// Subject-code field: comma-separated codes with live chip preview.
// Shows parsed codes as badges and flags invalid entries before submit.

"use client";

import { useMemo } from "react";
import { SUBJECT_CODE_PATTERN } from "@/constants/app.constants";
import { parseSubjectCodes } from "@/utils/subject-code";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/cn";

export function SubjectInput({
  value,
  onChange,
}: {
  value: string;
  onChange: (raw: string) => void;
}) {
  // Splits the raw text for preview; validation is per-code.
  const codes = useMemo(() => parseSubjectCodes(value), [value]);
  const invalid = useMemo(
    () => codes.filter((code) => !SUBJECT_CODE_PATTERN.test(code)),
    [codes],
  );

  return (
    <div className="flex flex-col gap-1.5">
      <label
        htmlFor="subject-codes"
        className="text-[13px] font-semibold tracking-wide text-[var(--gtu-text-secondary)]"
      >
        Subject codes
      </label>
      <textarea
        id="subject-codes"
        value={value}
        onChange={(event) => onChange(event.target.value)}
        placeholder="e.g. 3160704, 3160716"
        rows={2}
        aria-invalid={invalid.length > 0}
        aria-describedby="subject-codes-hint"
        className={cn(
          "w-full resize-none rounded-[10px] border bg-[var(--gtu-surface)] px-3.5 py-2.5 font-mono text-sm uppercase tracking-wide placeholder:normal-case placeholder:text-[var(--gtu-text-muted)]",
          invalid.length > 0
            ? "border-[var(--gtu-error)]"
            : "border-[var(--gtu-border)] focus:border-[var(--gtu-accent)]",
        )}
      />
      <p id="subject-codes-hint" className="text-xs text-[var(--gtu-text-muted)]">
        Separate multiple codes with commas — up to 5 per request. Codes
        starting with DI auto-select the DI course.
      </p>
      {codes.length > 0 && (
        <ul aria-label="Parsed subject codes" className="flex flex-wrap gap-1.5">
          {codes.map((code) => (
            <li key={code}>
              <Badge
                tone={
                  SUBJECT_CODE_PATTERN.test(code) ? "accent" : "error"
                }
              >
                {code}
              </Badge>
            </li>
          ))}
        </ul>
      )}
      {invalid.length > 0 && (
        <p role="alert" className="text-xs text-[var(--gtu-error)]">
          {invalid.join(", ")} — codes use letters/digits only (4–10 chars).
        </p>
      )}
    </div>
  );
}
