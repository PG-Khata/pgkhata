"use client";

import { cn } from "@/lib/utils";

interface ShimmerButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  children: React.ReactNode;
  className?: string;
}

export function ShimmerButton({
  children,
  className = "",
  ...props
}: ShimmerButtonProps) {
  return (
    <button
      className={cn(
        "relative inline-flex items-center justify-center px-6 py-3 overflow-hidden rounded-md font-semibold text-white bg-[var(--color-accent)] hover:bg-[var(--color-accent-hover)] transition-colors",
        className
      )}
      {...props}
    >
      <span className="relative z-10">{children}</span>
      <div className="absolute inset-0 -z-10 bg-gradient-to-r from-transparent via-white/20 to-transparent animate-shimmer" />
    </button>
  );
}
