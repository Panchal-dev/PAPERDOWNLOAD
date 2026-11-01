// Safe wrappers around localStorage for non-sensitive UI preferences.
// Every access is guarded: private-mode or disabled storage never throws.

const MEMORY_FALLBACK = new Map<string, string>();

// Reads a stored string value, or null when missing/unavailable.
export function readPreference(key: string): string | null {
  try {
    const value = window.localStorage.getItem(key);
    if (value !== null) return value;
  } catch {
    // Storage blocked — fall through to the in-memory copy.
  }
  return MEMORY_FALLBACK.get(key) ?? null;
}

// Persists a string preference; silently keeps an in-memory copy on failure.
export function writePreference(key: string, value: string): void {
  MEMORY_FALLBACK.set(key, value);
  try {
    window.localStorage.setItem(key, value);
  } catch {
    // Non-fatal: the in-memory copy keeps this session working.
  }
}
