// Site header: floating bar with mild rounded corners + glassmorphism.
// Spans near full-width with side + top gaps; fully transparent glass look.

"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { APP_CONFIG } from "@/config/app.config";
import { ROUTES_CONFIG } from "@/config/routes.config";
import { LogoMark } from "@/components/layout/logo-mark";
import { MobileNav } from "@/components/layout/mobile-nav";
import { ThemeToggle } from "@/components/layout/theme-toggle";
import { VisitorCounter } from "@/components/layout/visitor-counter";
import { cn } from "@/lib/cn";

const NAV_LINKS = [
  { href: ROUTES_CONFIG.home, label: "Downloader" },
  { href: ROUTES_CONFIG.howToUse, label: "How to use" },
] as const;

export function SiteHeader() {
  const pathname = usePathname();
  return (
    // Transparent outer shell — sticky + top/side gap only.
    <header className="sticky top-0 z-40 px-4 pt-3 sm:px-6">
      {/* Floating bar: mild rounded corners, full-width glass strip */}
      <div className="mx-auto flex h-14 max-w-7xl items-center justify-between gap-4 rounded-2xl border border-white/[0.07] bg-white/[0.03] px-5 shadow-sm shadow-black/30 backdrop-blur-2xl sm:px-6">
        <Link href={ROUTES_CONFIG.home} className="flex items-center gap-2.5">
          <LogoMark size={30} />
          <span className="flex flex-col leading-none">
            <span className="text-[14px] font-bold tracking-tight">
              {APP_CONFIG.name}
            </span>
            <span className="hidden text-[10px] text-[var(--gtu-text-muted)] sm:block">
              {APP_CONFIG.institution}
            </span>
          </span>
        </Link>
        <nav aria-label="Primary" className="hidden items-center gap-1 sm:flex">
          {NAV_LINKS.map((link) => (
            <Link
              key={link.href}
              href={link.href}
              aria-current={pathname === link.href ? "page" : undefined}
              className={cn(
                "rounded-xl px-3 py-1.5 text-sm font-medium transition-colors",
                pathname === link.href
                  ? "bg-[var(--gtu-accent-soft)] text-[var(--gtu-accent)]"
                  : "text-[var(--gtu-text-secondary)] hover:text-[var(--gtu-text)]",
              )}
            >
              {link.label}
            </Link>
          ))}
        </nav>
        <div className="flex items-center gap-2">
          {/* Unique visitor badge — hidden in local dev without Upstash */}
          <VisitorCounter />
          <ThemeToggle />
          <MobileNav links={[...NAV_LINKS]} currentPath={pathname} />
        </div>
      </div>
    </header>
  );
}
