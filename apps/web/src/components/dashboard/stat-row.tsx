import { cn } from "@/lib/utils"
import { NumberTicker } from "@/components/ui/number-ticker"

interface StatRowProps {
  label: string
  value: string | number
  className?: string
  emphasis?: boolean
}

function isNumericString(val: string): boolean {
  return /^\d+(\.\d+)?%?$/.test(val.replace(/,/g, ""))
}

function parseNumericValue(val: string): { num: number; suffix: string } {
  const cleaned = val.replace(/,/g, "")
  const match = cleaned.match(/^(\d+(?:\.\d+)?)(%?)$/)
  if (match) {
    return { num: Number(match[1]), suffix: match[2] }
  }
  return { num: 0, suffix: "" }
}

export function StatRow({ label, value, className, emphasis }: StatRowProps) {
  const renderValue = () => {
    if (typeof value === "number") {
      return <NumberTicker value={value} />
    }

    if (typeof value === "string" && isNumericString(value)) {
      const { num, suffix } = parseNumericValue(value)
      return (
        <>
          <NumberTicker value={num} />
          {suffix}
        </>
      )
    }

    return value
  }

  return (
    <div className={cn("space-y-1", className)}>
      <p className="text-xs text-muted-foreground">{label}</p>
      <p
        className={cn(
          "font-mono text-lg font-semibold tracking-tight tabular-nums",
          emphasis && "text-primary",
        )}
      >
        {renderValue()}
      </p>
    </div>
  )
}

interface StatGroupProps {
  stats: { label: string; value: string | number; emphasis?: boolean }[]
}

export function StatGroup({ stats }: StatGroupProps) {
  return (
    <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
      {stats.map((stat) => (
        <div
          key={stat.label}
          className="rounded-xl border bg-card p-4 transition-colors hover:bg-accent/50"
        >
          <StatRow
            label={stat.label}
            value={stat.value}
            emphasis={stat.emphasis}
          />
        </div>
      ))}
    </div>
  )
}
