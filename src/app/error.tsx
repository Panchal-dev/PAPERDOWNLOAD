// Route-level error boundary: friendly message with a retry action.
// Never exposes stack traces or server internals to the user.

"use client";

import { useEffect } from "react";
import { ErrorState } from "@/components/feedback/error-state";

export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  // Logs client-side for diagnostics while the UI stays friendly.
  useEffect(() => {
    console.error("Route error:", error.message);
  }, [error]);

  return (
    <div className="mx-auto max-w-7xl px-4 py-12 sm:px-6">
      <ErrorState
        title="This section failed to load"
        message="Something went wrong on our side. Your selections are kept in the address bar — retry, or go back and try again."
        onRetry={reset}
      />
    </div>
  );
}
