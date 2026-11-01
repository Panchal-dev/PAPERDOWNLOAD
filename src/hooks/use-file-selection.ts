// File selection state for bulk downloads (checkboxes + select-all).
// Holds a set of filenames; the panel remounts per result so stale
// selections never leak into a fresh fetch.

"use client";

import { useCallback, useState } from "react";

export function useFileSelection() {
  const [selected, setSelected] = useState<ReadonlySet<string>>(new Set());

  // Toggles one file in or out of the selection.
  const toggle = useCallback((filename: string) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(filename)) next.delete(filename);
      else next.add(filename);
      return next;
    });
  }, []);

  // Selects or deselects a batch (one card, one section, or everything).
  const setMany = useCallback((filenames: string[], select: boolean) => {
    setSelected((prev) => {
      const next = new Set(prev);
      for (const name of filenames) {
        if (select) next.add(name);
        else next.delete(name);
      }
      return next;
    });
  }, []);

  // Empties the selection after a bulk action or on demand.
  const clear = useCallback(() => setSelected(new Set()), []);

  return { selected, toggle, setMany, clear };
}
