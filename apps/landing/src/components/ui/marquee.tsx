"use client";

import { cn } from "@/lib/utils";

interface MarqueeProps {
  children: React.ReactNode;
  className?: string;
  reverse?: boolean;
  pauseOnHover?: boolean;
  speed?: number;
}

export function Marquee({
  children,
  className = "",
  reverse = false,
  pauseOnHover = false,
  speed = 30,
}: MarqueeProps) {
  return (
    <div
      className={cn("flex overflow-hidden", className)}
      style={{
        "--duration": `${speed}s`,
      } as React.CSSProperties}
    >
      <div
        className={cn(
          "flex shrink-0 gap-4",
          reverse ? "animate-marquee-reverse" : "animate-marquee",
          pauseOnHover && "hover:[animation-play-state:paused]"
        )}
      >
        {children}
        {children}
      </div>
    </div>
  );
}
