"use client"

import { cn } from "@/lib/utils"
import type { Bed } from "@/types"

/**
 * A bed is the smallest unit an owner sells, so it gets a direct affordance
 * rather than living behind a row expander. Filled means someone is in it,
 * outline means it is available, amber means out of use — readable at a glance
 * across a whole floor.
 */
const STATUS_STYLES: Record<Bed["status"], string> = {
  occupied: "border-foreground bg-foreground text-background",
  vacant: "border-border bg-transparent text-muted-foreground",
  maintenance: "border-amber-600 bg-amber-50 text-amber-700",
}

const STATUS_LABELS: Record<Bed["status"], string> = {
  occupied: "occupied",
  vacant: "vacant",
  maintenance: "under maintenance",
}

interface BedPillProps {
  bed: Bed
  roomNumber: string
  onSelect?: (bed: Bed) => void
}

export function BedPill({ bed, roomNumber, onSelect }: BedPillProps) {
  const label = `Bed ${roomNumber}-${bed.number}, ${STATUS_LABELS[bed.status]}`

  const classes = cn(
    // 44px touch target on mobile, tighter on desktop where rows are dense.
    "inline-flex h-11 w-11 items-center justify-center rounded-md border font-mono text-xs transition-colors md:h-7 md:w-7",
    STATUS_STYLES[bed.status],
    onSelect && "hover:border-foreground/60 cursor-pointer",
  )

  if (!onSelect) {
    return (
      <span className={classes} title={label} aria-label={label}>
        {bed.number}
      </span>
    )
  }

  return (
    <button type="button" className={classes} aria-label={label} title={label} onClick={() => onSelect(bed)}>
      {bed.number}
    </button>
  )
}

export function BedPillRow({
  beds,
  roomNumber,
  capacity,
  onSelect,
}: {
  beds: Bed[] | undefined
  roomNumber: string
  capacity: number
  onSelect?: (bed: Bed) => void
}) {
  if (!beds) {
    // Beds not loaded yet: show capacity as placeholders rather than nothing,
    // so the row does not change height when they arrive.
    return (
      <div className="flex flex-wrap gap-1" aria-hidden="true">
        {Array.from({ length: capacity }).map((_, index) => (
          <span
            key={index}
            className="inline-flex h-11 w-11 items-center justify-center rounded-md border border-dashed border-border md:h-7 md:w-7"
          />
        ))}
      </div>
    )
  }

  if (beds.length === 0) {
    return <span className="text-xs text-muted-foreground">No beds</span>
  }

  return (
    <div className="flex flex-wrap gap-1">
      {beds.map((bed) => (
        <BedPill key={bed.id} bed={bed} roomNumber={roomNumber} onSelect={onSelect} />
      ))}
    </div>
  )
}
