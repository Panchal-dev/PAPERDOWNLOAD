// Mobile navigation: slide-down panel with the same links as desktop.
// Keyboard accessible (Escape closes, focus stays inside while open).

"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Menu, X } from "lucide-react";
import { cn } from "@/lib/cn";

interface NavLink {
  href: string;
  label: string;
}

export function MobileNav({
  links,
  currentPath,
}: {
  links: NavLink[];
  currentPath: string;
}) {
  const [open, setOpen] = useState(false);

  // Closes on Escape for keyboard users.
  useEffect(() => {
    if (!open) return;
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") setOpen(false);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open ]);

  return (
    <div className="sm:hidden">
      <button
        type="button"
        aria-expanded={open}
        aria-label={open ? "Close menu" : "Open menu"}
        onClick={() => setOpen((value) => !value)}
        className="flex h-9 w-9 items-center justify-center rounded-[8px] border border-[var(--gtu-border)] text-[var(--gtu-text-secondary)]"
      >
        {open ? <X className="h-4.5 w-4.5" /> : <Menu className="h-4.5 w-4.5" />}
      </button>
      {open && (
        <nav
          aria-label="Mobile"
          className="absolute inset-x-0 top-14 border-b border-[var(--gtu-border)] bg-[var(--gtu-surface)] px-4 py-3"
        >
          <ul className="flex flex-col gap-1">
            {links.map((link) => (
              <li key={link.href}>
                <Link
                  href={link.href}
                  onClick={() => setOpen(false)}
                  aria-current={currentPath === link.href ? "page" : undefined}
                  className={cn(
                    "block rounded-[8px] px-3 py-2 text-sm font-medium",
                    currentPath === link.href
                      ? "bg-[var(--gtu-accent-soft)] text-[var(--gtu-accent)]"
                      : "text-[var(--gtu-text-secondary)]",
                  )}
                >
                  {link.label}
                </Link>
              </li>
            ))}
          </ul>
        </nav>
      )}
    </div>
  );
}
