import { cn } from "@/lib/utils"

type Status = "active" | "vacating" | "vacated" | "paid" | "partial" | "pending" | "overdue" | "open" | "in_progress" | "resolved" | "full" | "available"

const styles: Record<Status, string> = {
  active: "bg-emerald-50 text-emerald-700",
  paid: "bg-emerald-50 text-emerald-700",
  resolved: "bg-emerald-50 text-emerald-700",
  available: "bg-emerald-50 text-emerald-700",
  vacating: "bg-amber-50 text-amber-700",
  partial: "bg-amber-50 text-amber-700",
  pending: "bg-amber-50 text-amber-700",
  in_progress: "bg-amber-50 text-amber-700",
  vacated: "bg-red-50 text-red-700",
  overdue: "bg-red-50 text-red-700",
  full: "bg-red-50 text-red-700",
  open: "bg-blue-50 text-blue-700",
}

const labels: Record<Status, string> = {
  active: "Active",
  vacating: "Vacating",
  vacated: "Vacated",
  paid: "Paid",
  partial: "Partial",
  pending: "Pending",
  overdue: "Overdue",
  open: "Open",
  in_progress: "In Progress",
  resolved: "Resolved",
  full: "Full",
  available: "Available",
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
