// Accessible course selector: searchable combobox over the course catalogue.
// Keyboard: arrows move, Enter selects, Escape closes; screen-reader announcements included.

"use client";

import { useEffect, useId, useMemo, useRef, useState } from "react";
import { Check, ChevronDown, Search, X } from "lucide-react";
import { COURSES } from "@/constants/app.constants";
import { EmptyState } from "@/components/feedback/empty-state";
import { cn } from "@/lib/cn";

const LISTBOX_LIMIT = 50;

export function CourseSelector({
  value,
  onChange,
}: {
  value: string;
  onChange: (course: string) => void;
}) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [activeIndex, setActiveIndex] = useState(0);
  const buttonId = useId();
  const listId = `${buttonId}-listbox`;
  const rootRef = useRef<HTMLDivElement>(null);

  // Filters the catalogue as the user types (case-insensitive prefix/substring).
  const matches = useMemo(() => {
    const needle = query.trim().toUpperCase();
    if (!needle) return [...COURSES];
    return COURSES.filter((course) => course.includes(needle));
  }, [query]);

  const visible = matches.slice(0, LISTBOX_LIMIT);

  // Closes the dropdown on outside click.
  useEffect(() => {
    if (!open) return;
    const onPointer = (event: PointerEvent) => {
      if (rootRef.current && !rootRef.current.contains(event.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener("pointerdown", onPointer);
    return () => document.removeEventListener("pointerdown", onPointer);
  }, [open ]);

  // Picks a course and returns focus-friendly closed state.
  function choose(course: string) {
    onChange(course);
    setQuery("");
    setOpen(false);
  }

  // Arrow-key navigation across the visible options.
  function onKeyDown(event: React.KeyboardEvent) {
    if (event.key === "ArrowDown") {
      event.preventDefault();
      setActiveIndex((i) => Math.min(i + 1, visible.length - 1));
    } else if (event.key === "ArrowUp") {
      event.preventDefault();
      setActiveIndex((i) => Math.max(i - 1, 0));
    } else if (event.key === "Enter" && open && visible[activeIndex]) {
      event.preventDefault();
      choose(visible[activeIndex]);
    } else if (event.key === "Escape") {
      setOpen(false);
    }
  }

  return (
    <div ref={rootRef} className="flex flex-col gap-1.5" onKeyDown={onKeyDown}>
      <label
        htmlFor={buttonId}
        className="text-[13px] font-semibold tracking-wide text-[var(--gtu-text-secondary)]"
      >
        Course
      </label>
      <div className="relative">
        <button
          id={buttonId}
          type="button"
          aria-haspopup="listbox"
          aria-expanded={open}
          aria-controls={listId}
          onClick={() => setOpen((v) => !v)}
          className={cn(
            "flex w-full items-center justify-between rounded-[10px] border bg-[var(--gtu-surface)] px-3.5 py-2.5 text-sm",
            open
              ? "border-[var(--gtu-accent)]"
              : "border-[var(--gtu-border)]",
          )}
        >
          <span className="font-semibold tracking-wide">
            {value || "Select course"}
          </span>
          <ChevronDown
            className={cn(
              "h-4 w-4 text-[var(--gtu-text-muted)] transition-transform",
              open && "rotate-180",
            )}
            aria-hidden="true"
          />
        </button>
        {open && (
          <div className="absolute inset-x-0 top-full z-30 mt-2 overflow-hidden rounded-[10px] border border-[var(--gtu-border)] bg-[var(--gtu-surface)] shadow-xl">
            <div className="border-b border-[var(--gtu-border)] p-2">
              <div className="relative flex items-center">
                <Search
                  className="pointer-events-none absolute left-3 h-4 w-4 text-[var(--gtu-text-muted)]"
                  aria-hidden="true"
                />
                <input
                  autoFocus
                  value={query}
                  onChange={(event) => {
                    setQuery(event.target.value);
                    setActiveIndex(0);
                  }}
                  placeholder="Search courses…"
                  aria-label="Search courses"
                  className="w-full rounded-[8px] border border-[var(--gtu-border)] bg-[var(--gtu-elevated)] py-2 pl-10 pr-8 text-sm text-[var(--gtu-text)] placeholder:text-[var(--gtu-text-muted)] transition-colors focus:border-[var(--gtu-accent)] focus:outline-none focus:ring-1 focus:ring-[var(--gtu-accent)] focus-visible:outline-none [outline:none!important]"
                />
                {query && (
                  <button
                    type="button"
                    tabIndex={-1}
                    onClick={() => {
                      setQuery("");
                      setActiveIndex(0);
                    }}
                    className="absolute right-2.5 rounded p-0.5 text-[var(--gtu-text-muted)] transition-colors hover:text-[var(--gtu-text)] focus-visible:outline-none"
                    aria-label="Clear search"
                  >
                    <X className="h-3.5 w-3.5" aria-hidden="true" />
                  </button>
                )}
              </div>
            </div>
            {visible.length === 0 ? (
              <div className="p-3">
                <EmptyState
                  title="No courses found"
                  description={`Nothing matches "${query}". Try a shorter search.`}
                />
              </div>
            ) : (
              <ul
                id={listId}
                role="listbox"
                aria-label="Courses"
                className="max-h-56 overflow-y-auto p-1.5"
              >
                {visible.map((course, index) => (
                  <li key={course} role="option" aria-selected={course === value}>
                    <button
                      type="button"
                      onMouseEnter={() => setActiveIndex(index)}
                      onClick={() => choose(course)}
                      className={cn(
                        "flex w-full items-center justify-between rounded-[8px] px-3 py-2 text-left text-sm",
                        index === activeIndex
                          ? "bg-[var(--gtu-elevated)]"
                          : "bg-transparent",
                      )}
                    >
                      <span className="font-medium">{course}</span>
                      {course === value && (
                        <Check
                          className="h-4 w-4 text-[var(--gtu-accent)]"
                          aria-hidden="true"
                        />
                      )}
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
