import { cn } from "@/lib/utils"
import { NumberTicker } from "@/components/ui/number-ticker"
import type { LucideIcon } from "lucide-react"

interface StatCardProps {
  label: string
  value: string | number
  subtitle?: string
  icon: LucideIcon
  iconColor?: string
  subtitleColor?: string
}

function isNumericString(val: string): boolean {
  return /^\d+(\.\d+)?%?$/.test(val.replace(/[₹,]/g, "").trim())
}

function parseNumericValue(val: string): { num: number; suffix: string } {
  const cleaned = val.replace(/[₹,]/g, "").trim()
  const match = cleaned.match(/^(\d+(?:\.\d+)?)(%?)$/)
  if (match) {
    return { num: Number(match[1]), suffix: match[2] }
  }
  return { num: 0, suffix: "" }
}

function isCurrencyString(val: string): boolean {
  return val.startsWith("₹")
}

export function StatCard({
  label,
  value,
  subtitle,
  icon: Icon,
  iconColor,
  subtitleColor,
}: StatCardProps) {
  const renderValue = () => {
    if (typeof value === "number") {
      return <NumberTicker value={value} />
    }

    if (typeof value === "string") {
      if (isCurrencyString(value)) {
        const numStr = value.replace(/[₹,]/g, "").trim()
        const num = Number(numStr)
        if (!isNaN(num)) {
          return (
            <>
              ₹<NumberTicker value={num} />
            </>
          )
        }
      }

      if (isNumericString(value)) {
        const { num, suffix } = parseNumericValue(value)
        return (
          <>
            <NumberTicker value={num} />
            {suffix}
          </>
        )
      }
    }

    return value
  }

  return (
    <div className="group relative overflow-hidden rounded-xl border bg-card p-4 shadow-xs transition-all hover:shadow-md">
      <div className="absolute inset-0 rounded-xl bg-gradient-to-b from-transparent to-black/[0.02] opacity-0 transition-opacity group-hover:opacity-100" />
      <div className="flex items-start justify-between">
        <p className="text-xs text-muted-foreground">{label}</p>
        <Icon className={cn("h-4 w-4 text-muted-foreground/50", iconColor)} />
      </div>
      <p className="mt-1 font-mono text-xl font-semibold tracking-tight tabular-nums">
        {renderValue()}
      </p>
      {subtitle && (
        <p className={cn("mt-0.5 text-xs", subtitleColor || "text-muted-foreground")}>
          {subtitle}
        </p>
      )}
    </div>
  )
}
