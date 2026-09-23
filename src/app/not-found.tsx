// 404 page: clear explanation plus links back to working pages.

import Link from "next/link";
import { FileQuestion } from "lucide-react";
import { ROUTES_CONFIG } from "@/config/routes.config";
import { Button } from "@/components/ui/button";

export default function NotFound() {
  return (
    <div className="mx-auto flex max-w-7xl flex-col items-center gap-3 px-4 py-16 text-center sm:px-6">
      <span className="flex h-12 w-12 items-center justify-center rounded-full bg-[var(--gtu-elevated)]">
        <FileQuestion
          className="h-6 w-6 text-[var(--gtu-text-muted)]"
          aria-hidden="true"
        />
      </span>
      <h1 className="text-xl font-bold">Page not found</h1>
      <p className="max-w-md text-sm leading-relaxed text-[var(--gtu-text-secondary)]">
        The address may have a typo, or this paper link may have expired.
        Generated files are kept for a few hours, then cleaned up.
      </p>
      <div className="mt-2 flex gap-2">
        <Button variant="secondary">
          <Link href={ROUTES_CONFIG.home}>Back to downloader</Link>
        </Button>
        <Button variant="ghost">
          <Link href={ROUTES_CONFIG.howToUse}>How to use</Link>
        </Button>
      </div>
    </div>
  );
}
