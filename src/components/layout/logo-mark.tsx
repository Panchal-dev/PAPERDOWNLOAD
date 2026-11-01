// LogoMark: product emblem — an exam paper (folded document with lines)
// carrying a syllabus bookmark ribbon. Fixed brand colors so it matches
// the favicon on any background.

export function LogoMark({ size = 32 }: { size?: number }) {
  return (
    <span
      aria-hidden="true"
      className="inline-flex shrink-0"
      style={{ width: size, height: size }}
    >
      <svg viewBox="0 0 32 32" width={size} height={size}>
        <rect width="32" height="32" rx="7" fill="var(--gtu-accent)" />
        <path
          d="M9 5h9l6 6v16H9z"
          fill="#10141c"
          stroke="#ffffff"
          strokeWidth="1.8"
          strokeLinejoin="round"
        />
        <path
          d="M18 5v6h6"
          fill="none"
          stroke="#ffffff"
          strokeWidth="1.8"
          strokeLinejoin="round"
        />
        <path d="M12.5 5v7l2-1.6 2 1.6V5z" fill="#ffffff" />
        <line
          x1="12.5"
          y1="16.5"
          x2="20.5"
          y2="16.5"
          stroke="#ffffff"
          strokeWidth="1.8"
          strokeLinecap="round"
        />
        <line
          x1="12.5"
          y1="20"
          x2="20.5"
          y2="20"
          stroke="#ffffff"
          strokeWidth="1.8"
          strokeLinecap="round"
        />
        <line
          x1="12.5"
          y1="23.5"
          x2="17.5"
          y2="23.5"
          stroke="#ffffff"
          strokeWidth="1.8"
          strokeLinecap="round"
        />
      </svg>
    </span>
  );
}
