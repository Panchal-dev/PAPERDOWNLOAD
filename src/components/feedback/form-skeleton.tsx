// Form-shaped skeleton shown while the download request is in flight.
// Mirrors the results panel so the layout never jumps when data arrives.

import { Skeleton } from "@/components/ui/skeleton";

const PLACEHOLDER_ROWS = 3;

export function ResultsSkeleton() {
  return (
    <div className="flex flex-col gap-3" aria-label="Loading results">
      <Skeleton className="h-5 w-2/3" />
      {Array.from({ length: PLACEHOLDER_ROWS }).map((_, index) => (
        <div key={index} className="flex items-center gap-3">
          <Skeleton className="h-12 w-12 shrink-0" />
          <div className="flex flex-1 flex-col gap-2">
            <Skeleton className="h-4 w-3/4" />
            <Skeleton className="h-3 w-1/2" />
          </div>
        </div>
      ))}
    </div>
  );
}
