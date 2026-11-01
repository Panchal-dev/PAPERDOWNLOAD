// Global loading fallback: skeleton matching the home layout.
// Shown during route transitions before content streams in.

import { Skeleton } from "@/components/ui/skeleton";

export default function Loading() {
  return (
    <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6" aria-label="Loading page">
      <Skeleton className="mb-2 h-8 w-1/2" />
      <Skeleton className="mb-6 h-5 w-2/3" />
      <div className="grid gap-6 lg:grid-cols-[380px_1fr]">
        <div className="flex flex-col gap-3">
          <Skeleton className="h-16 w-full" />
          <Skeleton className="h-24 w-full" />
          <Skeleton className="h-40 w-full" />
        </div>
        <div className="flex flex-col gap-3">
          <Skeleton className="h-6 w-1/3" />
          <Skeleton className="h-20 w-full" />
          <Skeleton className="h-20 w-full" />
        </div>
      </div>
    </div>
  );
}
