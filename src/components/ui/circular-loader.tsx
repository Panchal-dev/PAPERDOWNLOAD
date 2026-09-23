// CircularLoader: standard indeterminate progress ring.
// SVG track + rotating arc; inherits text color so any parent sets the tone.

import { cn } from "@/lib/cn";

const RADIUS = 9;
const CIRCUMFERENCE = 2 * Math.PI * RADIUS;
// Visible arc length — the gap acts as the rotating "head".
const ARC_LENGTH = CIRCUMFERENCE * 0.72;

export function CircularLoader({
  size = 20,
  className,
  label = "Loading",
}: {
  size?: number;
  className?: string;
  label?: string;
}) {
  return (
    <span
      role="status"
      aria-label={label}
      className={cn("inline-flex shrink-0", className)}
      style={{ width: size, height: size }}
    >
      <svg
        viewBox="0 0 24 24"
        width={size}
        height={size}
        aria-hidden="true"
        className="gtu-spin"
      >
        <circle
          cx="12"
          cy="12"
          r={RADIUS}
          fill="none"
          stroke="currentColor"
          strokeOpacity="0.25"
          strokeWidth="2.5"
        />
        <circle
          cx="12"
          cy="12"
          r={RADIUS}
          fill="none"
          stroke="currentColor"
          strokeWidth="2.5"
          strokeLinecap="round"
          strokeDasharray={`${ARC_LENGTH} ${CIRCUMFERENCE}`}
        />
      </svg>
    </span>
  );
}
