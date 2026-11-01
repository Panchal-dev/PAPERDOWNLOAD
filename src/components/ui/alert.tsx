// Alert primitive for inline success / warning / error messages.
// Uses icon + text (never color alone) for accessible status feedback.

import type { ReactNode } from "react";
import { AlertCircle, CheckCircle2, Info } from "lucide-react";
import { cn } from "@/lib/cn";

type AlertTone = "info" | "success" | "warning" | "error";

const TONE_ICON: Record<AlertTone, typeof Info> = {
  info: Info,
  success: CheckCircle2,
  warning: AlertCircle,
  error: AlertCircle,
};

const TONE_CLASSES: Record<AlertTone, string> = {
  info: "border-[var(--gtu-border)] text-[var(--gtu-text-secondary)]",
  success: "border-[rgba(52,201,142,0.35)] text-[var(--gtu-success)]",
  warning: "border-[rgba(229,161,61,0.35)] text-[var(--gtu-warning)]",
  error: "border-[rgba(229,96,95,0.4)] text-[var(--gtu-error)]",
};

export function Alert({
  tone = "info",
  children,
  className,
}: {
  tone?: AlertTone;
  children: ReactNode;
  className?: string;
}) {
  const Icon = TONE_ICON[tone];
  return (
    <div
      role={tone === "error" ? "alert" : "status"}
      className={cn(
        "flex items-start gap-2.5 rounded-[10px] border bg-[var(--gtu-surface)] px-3.5 py-3 text-sm",
        TONE_CLASSES[tone],
        className,
      )}
    >
      <Icon className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
      <div className="min-w-0 flex-1 text-[var(--gtu-text)]">{children}</div>
    </div>
  );
}
