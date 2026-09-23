// Hook: registers this browser session as a unique visitor and returns the
// live global count from Upstash Redis.
//
// Strategy:
//  1. On first mount, read or generate a stable UUID stored in localStorage.
//     The UUID never leaves the browser except as a HyperLogLog element —
//     no PII is stored server-side.
//  2. POST the UUID to /api/visitors.  The server does PFADD + PFCOUNT and
//     returns the updated count.
//  3. If the POST fails (offline, env vars missing, rate-limit), fall back
//     to a GET so we at least show the last known count.
//  4. The hook never re-posts on navigation — one registration per session.

"use client";

import { useEffect, useState } from "react";

const STORAGE_KEY = "gtu-vid";
const API_PATH = "/api/visitors";

/** Returns or creates a stable anonymous visitor UUID in localStorage. */
function getOrCreateVisitorId(): string {
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored) return stored;
    const id = crypto.randomUUID();
    localStorage.setItem(STORAGE_KEY, id);
    return id;
  } catch {
    // Private-browsing or storage blocked — generate a session-only ID.
    return crypto.randomUUID();
  }
}

export interface VisitorCountState {
  count: number | null; // null = loading
  isLoading: boolean;
}

export function useVisitorCount(): VisitorCountState {
  const [count, setCount] = useState<number | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;

    async function register() {
      const visitorId = getOrCreateVisitorId();

      try {
        const res = await fetch(API_PATH, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ visitorId }),
          // No caching — always get the live count.
          cache: "no-store",
        });

        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const data = (await res.json()) as { count: number };
        if (!cancelled) {
          setCount(data.count);
          setIsLoading(false);
        }
      } catch {
        // Fallback: try GET to at least show a stale count.
        try {
          const res = await fetch(API_PATH, { cache: "no-store" });
          if (res.ok) {
            const data = (await res.json()) as { count: number };
            if (!cancelled) setCount(data.count);
          }
        } catch {
          // Fully offline / Upstash not configured yet — stay at null.
        } finally {
          if (!cancelled) setIsLoading(false);
        }
      }
    }

    void register();
    return () => {
      cancelled = true;
    };
  }, []); // Run once per mount — one registration per session.

  return { count, isLoading };
}
