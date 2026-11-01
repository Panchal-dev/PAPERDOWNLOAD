// Persists a single non-sensitive string preference (e.g. last course).
// useSyncExternalStore keeps server HTML, first client paint, and the
// stored value consistent — no hydration mismatch when they differ.
// An explicit pin (e.g. course from a shared link) wins over storage.

"use client";

import { useCallback, useEffect, useSyncExternalStore } from "react";
import { readPreference, writePreference } from "@/lib/storage";

// Cross-tab updates arrive through the native storage event.
function subscribe(onChange: () => void): () => void {
  window.addEventListener("storage", onChange);
  return () => window.removeEventListener("storage", onChange);
}

export function usePersistentPreference(
  key: string,
  initialValue: string,
  options?: { pin?: string },
): [string, (value: string) => void] {
  const pin = options?.pin;

  // Server snapshot and first client paint agree (pin wins when present);
  // the stored value applies right after hydration, mismatch-free.
  const value = useSyncExternalStore(
    subscribe,
    () => (pin ? pin : (readPreference(key) ?? initialValue)),
    () => (pin ? pin : initialValue),
  );

  // Persists an explicit pin for later visits.
  // Storage write only — no setState, so no render cascade.
  useEffect(() => {
    if (pin && readPreference(key) !== pin) writePreference(key, pin);
  }, [key, pin]);

  // Writes through the store; same-tab "storage" events don't fire
  // natively, so one is dispatched to refresh this tab too.
  const update = useCallback(
    (next: string) => {
      writePreference(key, next);
      window.dispatchEvent(new StorageEvent("storage"));
    },
    [key],
  );

  return [value, update];
}
