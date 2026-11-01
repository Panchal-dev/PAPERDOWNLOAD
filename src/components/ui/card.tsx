// Card primitive: flat surface with a hairline border, no decoration.
// Sections compose this instead of inventing their own containers.

import type { ReactNode } from "react";
import { cn } from "@/lib/cn";

export function Card({
  children,
  className,
}: {
  children: ReactNode;
  className?: string;
}) {
  return (
    <div
      className={cn(
        "rounded-[12px] border border-[var(--gtu-border)] bg-[var(--gtu-surface)]",
        className,
      )}
    >
      {children}
    </div>
  );
}
