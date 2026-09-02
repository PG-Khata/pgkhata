"use client"

import ReactLoadingSkeleton from "react-loading-skeleton"
import "react-loading-skeleton/dist/skeleton.css"
import { cn } from "@/lib/utils"

function Skeleton({
  className,
  width,
  height,
  circle,
  count,
  ...props
}: {
  className?: string
  width?: string | number
  height?: string | number
  circle?: boolean
  count?: number
} & React.HTMLAttributes<HTMLDivElement>) {
  return (
    <ReactLoadingSkeleton
      className={cn(className)}
      width={width}
      height={height}
      circle={circle}
      count={count}
      baseColor="var(--muted)"
      highlightColor="var(--accent)"
      borderRadius="0.75rem"
      {...props}
    />
  )
}

export { Skeleton }
