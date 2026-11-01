// ThemeToggle: simple light ↔ dark pill toggle matching the reference image.
// Sun icon — pill — Moon icon. Pill slides right for dark, left for light.

"use client";

import { Moon, Sun } from "lucide-react";
import { useTheme } from "@/components/layout/theme-provider";
import { cn } from "@/lib/cn";

export function ThemeToggle() {
  const { theme, toggle } = useTheme();
  const isDark = theme === "dark";

  return (
    <div className="flex items-center gap-2">
      {/* Sun icon */}
      <Sun
        className={cn(
          "h-[15px] w-[15px] transition-colors",
          !isDark
            ? "text-[var(--gtu-warning)]"
            : "text-[var(--gtu-text-muted)]",
        )}
        aria-hidden="true"
      />

      {/* Pill toggle */}
      <button
        type="button"
        role="switch"
        aria-checked={isDark}
        aria-label={isDark ? "Switch to light mode" : "Switch to dark mode"}
        onClick={toggle}
        className={cn(
          "relative inline-flex h-[22px] w-10 shrink-0 cursor-pointer items-center rounded-full border transition-colors duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--gtu-ring)] focus-visible:ring-offset-1",
          isDark
            ? "border-[var(--gtu-border-strong)] bg-[var(--gtu-elevated)]"
            : "border-[var(--gtu-border)] bg-[var(--gtu-surface)]",
        )}
      >
        {/* Sliding knob */}
        <span
          className={cn(
            "absolute h-[14px] w-[14px] rounded-full shadow-sm transition-all duration-200",
            isDark
              ? "left-[calc(100%-17px)] bg-[var(--gtu-accent)]"
              : "left-[3px] bg-[#f59e0b]",
          )}
        />
      </button>

      {/* Moon icon */}
      <Moon
        className={cn(
          "h-[15px] w-[15px] transition-colors",
          isDark
            ? "text-[var(--gtu-accent)]"
            : "text-[var(--gtu-text-muted)]",
        )}
        aria-hidden="true"
      />
    </div>
  );
}
