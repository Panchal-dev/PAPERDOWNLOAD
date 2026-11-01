// Primary download action: spinner, elapsed timer, and progress bar.
// The label always states what happens next — no ambiguous buttons.
// Remounted per run (via key) so the elapsed timer restarts cleanly.

"use client";

import { useEffect, useState } from "react";
import { Download } from "lucide-react";
import { Button } from "@/components/ui/button";
import { CircularLoader } from "@/components/ui/circular-loader";

const ELAPSED_VISIBLE_AFTER_SECS = 2;

export function DownloadButton({
  loading,
  disabled,
}: {
  loading: boolean;
  disabled: boolean;
}) {
  // Seconds since this run started; updated from the interval callback
  // so the effect body itself never sets state.
  const [elapsed, setElapsed] = useState(0);

  useEffect(() => {
    if (!loading) return;
    const started = Date.now();
    const id = window.setInterval(() => {
      setElapsed(Math.floor((Date.now() - started) / 1000));
    }, 1000);
    return () => window.clearInterval(id);
  }, [loading]);

  return (
    <Button
      type="submit"
      disabled={disabled || loading}
      aria-busy={loading}
      className="relative w-full overflow-hidden py-3 text-[15px]"
    >
      {loading ? (
        <>
          <CircularLoader size={20} label="Fetching papers" />
          <span>
            Fetching papers…
            {elapsed > ELAPSED_VISIBLE_AFTER_SECS && ` ${elapsed}s`}
          </span>
          <span aria-hidden="true" className="gtu-progress-bar" />
        </>
      ) : (
        <>
          <Download className="h-4.5 w-4.5" aria-hidden="true" />
          Fetch papers
        </>
      )}
    </Button>
  );
}
