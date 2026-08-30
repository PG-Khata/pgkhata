import { cn } from "@/lib/utils"

interface StatRowProps {
  label: string
  value: string | number
  className?: string
}

export function StatRow({ label, value, className }: StatRowProps) {
  return (
    <div className={cn("space-y-0.5", className)}>
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className="font-mono text-lg font-semibold tabular-nums">{value}</p>
    </div>
  )
}

interface StatGroupProps {
  stats: { label: string; value: string | number }[]
}

export function StatGroup({ stats }: StatGroupProps) {
  return (
    <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
      {stats.map((stat) => (
        <StatRow key={stat.label} label={stat.label} value={stat.value} />
      ))}
    </div>
  )
}
