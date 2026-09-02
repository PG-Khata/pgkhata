import { cn } from "@/lib/utils"

/**
 * Semantic colour is the only colour in an otherwise monochrome UI, so the
 * mapping carries meaning rather than decoration:
 *   emerald - settled or in good standing
 *   amber   - needs the owner's attention
 *   red     - overdue or terminal-negative
 *   blue    - newly arrived, not yet triaged
 *   zinc    - neutral bookkeeping state
 */
export type Status =
  // tenancy
  | "active"
  | "vacating"
  | "vacated"
  | "pending"
  | "approved"
  | "rejected"
  // billing
  | "paid"
  | "partial"
  | "overdue"
  | "voided"
  // complaints
  | "open"
  | "in_progress"
  | "resolved"
  // occupancy
  | "vacant"
  | "occupied"
  | "maintenance"
  | "full"
  | "available"
  // deposits and advances
  | "held"
  | "refunded"
  | "forfeited"
  | "applied"
  // expenses
  | "draft"
  // general
  | "inactive"

const styles: Record<Status, string> = {
  active: "bg-emerald-50 text-emerald-700",
  approved: "bg-emerald-50 text-emerald-700",
  paid: "bg-emerald-50 text-emerald-700",
  resolved: "bg-emerald-50 text-emerald-700",
  available: "bg-emerald-50 text-emerald-700",
  vacant: "bg-emerald-50 text-emerald-700",
  refunded: "bg-emerald-50 text-emerald-700",

  vacating: "bg-amber-50 text-amber-700",
  partial: "bg-amber-50 text-amber-700",
  pending: "bg-amber-50 text-amber-700",
  in_progress: "bg-amber-50 text-amber-700",
  maintenance: "bg-amber-50 text-amber-700",
  held: "bg-amber-50 text-amber-700",

  vacated: "bg-red-50 text-red-700",
  overdue: "bg-red-50 text-red-700",
  rejected: "bg-red-50 text-red-700",
  forfeited: "bg-red-50 text-red-700",
  full: "bg-red-50 text-red-700",

  open: "bg-blue-50 text-blue-700",

  occupied: "bg-zinc-100 text-zinc-700",
  applied: "bg-zinc-100 text-zinc-700",
  voided: "bg-zinc-100 text-zinc-700",
  draft: "bg-zinc-100 text-zinc-700",
  inactive: "bg-zinc-100 text-zinc-700",
}

const labels: Record<Status, string> = {
  active: "Active",
  vacating: "Vacating",
  vacated: "Vacated",
  pending: "Pending",
  approved: "Approved",
  rejected: "Rejected",
  paid: "Paid",
  partial: "Partial",
  overdue: "Overdue",
  voided: "Voided",
  open: "Open",
  in_progress: "In Progress",
  resolved: "Resolved",
  vacant: "Vacant",
  occupied: "Occupied",
  maintenance: "Maintenance",
  full: "Full",
  available: "Available",
  held: "Held",
  refunded: "Refunded",
  forfeited: "Forfeited",
  applied: "Applied",
  draft: "Draft",
  inactive: "Inactive",
}

interface StatusBadgeProps {
  status: Status
  className?: string
}

export function StatusBadge({ status, className }: StatusBadgeProps) {
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium",
        styles[status],
        className,
      )}
    >
      {labels[status]}
    </span>
  )
}
