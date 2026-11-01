// Course selection state with persistence of the last-used course.
// The catalogue itself stays in constants; this hook only tracks choice.
// An explicit course (URL/deep-link) pins the selection until the user
// picks otherwise; otherwise the last-used course resumes.
// reset() clears the selection (e.g. when only old-style codes are entered
// and no course can be inferred — the user must pick one manually).

"use client";

import { useCallback, useState } from "react";
import { STORAGE_KEYS } from "@/constants/storage.constants";
import { usePersistentPreference } from "@/hooks/use-persistent-preference";

const DEFAULT_COURSE = "";

export function useCourseSelection(urlCourse = "") {
  // Manual picks unpin the URL course so storage takes over again.
  const [unpinned, setUnpinned] = useState(false);
  const pin = unpinned ? undefined : urlCourse || undefined;

  // Persisted so returning users resume where they left off.
  const [course, setCourse] = usePersistentPreference(
    STORAGE_KEYS.lastCourse,
    DEFAULT_COURSE,
    { pin },
  );
  const [touched, setTouched] = useState(false);

  // Records an explicit user choice (used for validation messaging).
  const select = useCallback(
    (next: string) => {
      setUnpinned(true);
      setTouched(true);
      setCourse(next);
    },
    [setCourse],
  );

  // Clears the selection back to empty (no course).
  // Called when subject codes give no detectable course so the user
  // is prompted to pick one instead of silently reusing the last pick.
  const reset = useCallback(() => {
    setUnpinned(true);
    setCourse(DEFAULT_COURSE);
  }, [setCourse]);

  return { course, select, reset, touched };
}
