// Primary button primitive: one style for every main action.
// Variants cover primary / secondary / ghost without drifting visuals.

import type { ButtonHTMLAttributes } from "react";
import { cn } from "@/lib/cn";

type ButtonVariant = "primary" | "secondary" | "ghost";

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant;
}

// Base + variant class maps (kept outside the component for clarity).
const BASE_CLASSES =
  "inline-flex items-center justify-center gap-2 rounded-[10px] px-4 py-2.5 text-sm font-semibold transition-colors disabled:cursor-not-allowed disabled:opacity-50";

const VARIANT_CLASSES: Record<ButtonVariant, string> = {
  primary:
    "bg-[var(--gtu-accent)] text-white hover:bg-[var(--gtu-accent-hover)]",
  secondary:
    "border border-[var(--gtu-border-strong)] bg-[var(--gtu-elevated)] text-[var(--gtu-text)] hover:border-[var(--gtu-accent)]",
  ghost: "text-[var(--gtu-text-secondary)] hover:text-[var(--gtu-text)]",
};

export function Button({
  variant = "primary",
  className,
  type = "button",
  ...props
}: ButtonProps) {
  return (
    <button
      type={type}
      className={cn(BASE_CLASSES, VARIANT_CLASSES[variant], className)}
      {...props}
    />
  );
}
