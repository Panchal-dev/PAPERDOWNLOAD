// Skeleton primitive: shimmering placeholder matching final layout.
// Width/height come from the caller so loaders never shift content.

import { cn } from "@/lib/cn";

export function Skeleton({
  className,
  label = "Loading",
}: {
  className?: string;
  label?: string;
}) {
  return (
    <div
      role="status"
      aria-label={label}
      className={cn("gtu-skeleton rounded-[8px]", className)}
    />
  );
}
