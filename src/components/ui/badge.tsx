// Badge primitive for metadata chips (sessions, counts, status).

import type { ReactNode } from "react";
import { cn } from "@/lib/cn";

type BadgeTone = "neutral" | "accent" | "success" | "warning" | "error";

const TONE_CLASSES: Record<BadgeTone, string> = {
  neutral:
    "border-[var(--gtu-border)] bg-[var(--gtu-elevated)] text-[var(--gtu-text-secondary)]",
  accent:
    "border-transparent bg-[var(--gtu-accent-soft)] text-[var(--gtu-accent)]",
  success: "border-transparent bg-[rgba(52,201,142,0.12)] text-[var(--gtu-success)]",
  warning: "border-transparent bg-[rgba(229,161,61,0.12)] text-[var(--gtu-warning)]",
  error: "border-transparent bg-[rgba(229,96,95,0.12)] text-[var(--gtu-error)]",
};

export function Badge({
  tone = "neutral",
  children,
  className,
}: {
  tone?: BadgeTone;
  children: ReactNode;
  className?: string;
}) {
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-medium",
        TONE_CLASSES[tone],
        className,
      )}
    >
      {children}
    </span>
  );
}
