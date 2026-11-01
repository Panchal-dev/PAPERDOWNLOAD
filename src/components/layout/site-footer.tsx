// Site footer: product summary, quick links, and data-source note.
// Single row on desktop, stacked on mobile.

import Link from "next/link";
import { APP_CONFIG } from "@/config/app.config";
import { ROUTES_CONFIG } from "@/config/routes.config";

export function SiteFooter() {
  return (
    <footer className="border-t border-[var(--gtu-border)]">
      <div className="mx-auto flex max-w-7xl flex-col gap-3 px-4 py-6 text-[13px] text-[var(--gtu-text-muted)] sm:flex-row sm:items-center sm:justify-between sm:px-6">
        <p>
          <span className="font-semibold text-[var(--gtu-text-secondary)]">
            {APP_CONFIG.fullName}
          </span>{" "}
          · papers sourced from GTU public archives
        </p>
        <nav aria-label="Footer" className="flex items-center gap-4">
          <Link href={ROUTES_CONFIG.home} className="hover:text-[var(--gtu-text)]">
            Downloader
          </Link>
          <Link
            href={ROUTES_CONFIG.howToUse}
            className="hover:text-[var(--gtu-text)]"
          >
            How to use
          </Link>
        </nav>
      </div>
    </footer>
  );
}
