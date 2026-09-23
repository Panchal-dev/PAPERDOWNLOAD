// Text input primitive with label, hint, and error slots.
// Keeps form fields visually consistent across the app.

import type { InputHTMLAttributes } from "react";
import { cn } from "@/lib/cn";

interface TextInputProps extends InputHTMLAttributes<HTMLInputElement> {
  label: string;
  hint?: string;
  error?: string | null;
}

export function TextInput({
  label,
  hint,
  error,
  id,
  className,
  ...props
}: TextInputProps) {
  // Falls back to a slug of the label when no id is provided.
  const inputId = id ?? label.toLowerCase().replace(/[^a-z0-9]+/g, "-");
  return (
    <div className="flex flex-col gap-1.5">
      <label
        htmlFor={inputId}
        className="text-[13px] font-semibold tracking-wide text-[var(--gtu-text-secondary)]"
      >
        {label}
      </label>
      <input
        id={inputId}
        className={cn(
          "w-full rounded-[10px] border bg-[var(--gtu-surface)] px-3.5 py-2.5 text-sm text-[var(--gtu-text)] placeholder:text-[var(--gtu-text-muted)]",
          error
            ? "border-[var(--gtu-error)]"
            : "border-[var(--gtu-border)] focus:border-[var(--gtu-accent)]",
          className,
        )}
        aria-invalid={Boolean(error)}
        aria-describedby={hint ? `${inputId}-hint` : undefined}
        {...props}
      />
      {hint && !error && (
        <p id={`${inputId}-hint`} className="text-xs text-[var(--gtu-text-muted)]">
          {hint}
        </p>
      )}
      {error && (
        <p role="alert" className="text-xs text-[var(--gtu-error)]">
          {error}
        </p>
      )}
    </div>
  );
}
