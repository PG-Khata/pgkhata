"use client";

import { cn } from "@/lib/utils";

interface BorderBeamProps {
  className?: string;
  size?: number;
  duration?: number;
  borderWidth?: number;
  colorFrom?: string;
  colorTo?: string;
}

export function BorderBeam({
  className = "",
  size = 200,
  duration = 15,
  borderWidth = 1.5,
  colorFrom = "#ffaa40",
  colorTo = "#9c40ff",
}: BorderBeamProps) {
  return (
    <div
      className={cn(
        "absolute inset-0 rounded-[inherit] overflow-hidden pointer-events-none",
        className
      )}
    >
      <div
        className="absolute inset-0 rounded-[inherit]"
        style={{
          background: `conic-gradient(from 0deg, transparent, ${colorFrom}, ${colorTo}, transparent)`,
          animation: `border-beam ${duration}s linear infinite`,
          mask: `linear-gradient(#fff 0 0) content-box, linear-gradient(#fff 0 0)`,
          maskComposite: "exclude",
          padding: borderWidth,
        }}
      />
    </div>
  );
}
