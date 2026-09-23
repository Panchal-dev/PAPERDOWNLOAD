// Error-state block: friendly message plus a concrete recovery action.
// Server internals never leak here — only what the user can act on.

import { TriangleAlert } from "lucide-react";
import { Button } from "@/components/ui/button";

export function ErrorState({
  title = "Something went wrong",
  message,
  onRetry,
  retryLabel = "Try again",
}: {
  title?: string;
  message: string;
  onRetry?: () => void;
  retryLabel?: string;
}) {
  return (
    <div
      role="alert"
      className="flex flex-col items-center gap-2 rounded-[12px] border border-[rgba(229,96,95,0.4)] bg-[var(--gtu-surface)] px-6 py-10 text-center"
    >
      <span className="flex h-10 w-10 items-center justify-center rounded-full bg-[rgba(229,96,95,0.12)]">
        <TriangleAlert className="h-5 w-5 text-[var(--gtu-error)]" aria-hidden="true" />
      </span>
      <h3 className="text-sm font-semibold text-[var(--gtu-text)]">{title}</h3>
      <p className="max-w-sm text-[13px] leading-relaxed text-[var(--gtu-text-secondary)]">
        {message}
      </p>
      {onRetry && (
        <Button variant="secondary" onClick={onRetry} className="mt-2">
          {retryLabel}
        </Button>
      )}
    </div>
  );
}
