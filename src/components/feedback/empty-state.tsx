// Empty-state block: explains what is missing and what to do next.
// Every list in the app funnels through this instead of blank space.

import type { LucideIcon } from "lucide-react";
import { Inbox } from "lucide-react";

export function EmptyState({
  icon: Icon = Inbox,
  title,
  description,
  action,
}: {
  icon?: LucideIcon;
  title: string;
  description: string;
  action?: React.ReactNode;
}) {
  return (
    <div className="flex flex-col items-center gap-2 rounded-[12px] border border-dashed border-[var(--gtu-border-strong)] px-6 py-10 text-center">
      <span className="flex h-10 w-10 items-center justify-center rounded-full bg-[var(--gtu-elevated)]">
        <Icon className="h-5 w-5 text-[var(--gtu-text-muted)]" aria-hidden="true" />
      </span>
      <h3 className="text-sm font-semibold text-[var(--gtu-text)]">{title}</h3>
      <p className="max-w-sm text-[13px] leading-relaxed text-[var(--gtu-text-secondary)]">
        {description}
      </p>
      {action}
    </div>
  );
}
