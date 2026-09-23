// Visitor counter badge — subtle header pill showing unique visitor count.
// Wired to useVisitorCount which registers the current session once via
// Upstash Redis HyperLogLog and returns the live global total.
//
// States:
//  loading  → skeleton shimmer (width-locked so header doesn't shift)
//  count=0  → hidden (Upstash not configured yet / local dev)
//  count>0  → animated count-up then steady display

"use client";

import { useEffect, useRef, useState } from "react";
import { Users } from "lucide-react";
import { useVisitorCount } from "@/hooks/use-visitor-count";

/** Formats a number with locale-aware thousands separators: 1234 → "1,234" */
function fmt(n: number): string {
  return n.toLocaleString("en-IN"); // e.g. 1,23,456 for Indian locale
}

/** Animates from 0 to `target` over ~800ms using requestAnimationFrame. */
function useCountUp(target: number | null): number | null {
  const [display, setDisplay] = useState<number | null>(null);
  const rafRef = useRef<number | null>(null);

  useEffect(() => {
    if (target === null) return;

    // If first render just snap to target with no animation.
    if (display === null) {
      setDisplay(target);
      return;
    }

    const start = performance.now();
    const duration = 800;
    const from = display;
    // Capture in a const so TypeScript knows it is non-null inside step().
    const to = target;

    function step(now: number) {
      const elapsed = now - start;
      const progress = Math.min(elapsed / duration, 1);
      // Ease-out cubic
      const eased = 1 - Math.pow(1 - progress, 3);
      setDisplay(Math.round(from + (to - from) * eased));
      if (progress < 1) {
        rafRef.current = requestAnimationFrame(step);
      }
    }

    rafRef.current = requestAnimationFrame(step);
    return () => {
      if (rafRef.current !== null) cancelAnimationFrame(rafRef.current);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [target]);

  return display;
}

export function VisitorCounter() {
  const { count, isLoading } = useVisitorCount();
  const animated = useCountUp(count);

  // Loading state — fixed-width shimmer so header doesn't reflow.
  if (isLoading) {
    return (
      <div
        aria-hidden="true"
        className="gtu-skeleton h-6 w-16 rounded-full opacity-60"
      />
    );
  }

  // Hidden when Upstash not yet configured (count stays 0 or null).
  if (!count || count === 0) return null;

  return (
    <div
      title={`${fmt(count)} unique visitors`}
      className="flex items-center gap-1.5 rounded-full border border-[var(--gtu-border)] bg-[var(--gtu-elevated)] px-2.5 py-1 text-xs font-medium text-[var(--gtu-text-secondary)] transition-colors"
    >
      <Users
        className="h-3 w-3 shrink-0 text-[var(--gtu-accent)]"
        aria-hidden="true"
      />
      <span aria-label={`${fmt(count)} unique visitors`}>
        {animated !== null ? fmt(animated) : fmt(count)}
      </span>
    </div>
  );
}
