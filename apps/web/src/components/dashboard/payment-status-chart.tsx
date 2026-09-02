"use client"

import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip } from "recharts"
import { formatCurrency } from "@/lib/utils"

interface PaymentStatusChartProps {
  collected: number
  pending: number
  overdue: number
}

const COLORS = ["#059669", "#eab308", "#dc2626"]
const LABELS = ["Collected", "Pending", "Overdue"]

export function PaymentStatusChart({
  collected,
  pending,
  overdue,
}: PaymentStatusChartProps) {
  const total = collected + pending + overdue
  if (total === 0) {
    return (
      <div className="flex h-48 items-center justify-center text-sm text-muted-foreground">
        No billing data yet
      </div>
    )
  }

  const data = [
    { name: "Collected", value: collected },
    { name: "Pending", value: pending },
    { name: "Overdue", value: overdue },
  ].filter((d) => d.value > 0)

  return (
    <div className="flex items-center gap-6">
      <div className="h-48 w-48 shrink-0">
        <ResponsiveContainer width="100%" height="100%">
          <PieChart>
            <Pie
              data={data}
              cx="50%"
              cy="50%"
              innerRadius={50}
              outerRadius={72}
              paddingAngle={3}
              dataKey="value"
              strokeWidth={0}
            >
              {data.map((_, index) => (
                <Cell
                  key={index}
                  fill={COLORS[index]}
                  className="transition-opacity hover:opacity-80"
                />
              ))}
            </Pie>
            <Tooltip
              formatter={(value) => formatCurrency(Number(value))}
              contentStyle={{
                borderRadius: "8px",
                border: "1px solid var(--border)",
                boxShadow: "0 4px 12px rgba(0,0,0,0.08)",
                fontSize: "13px",
              }}
            />
          </PieChart>
        </ResponsiveContainer>
      </div>

      <div className="flex flex-col gap-3">
        {data.map((item, index) => {
          const colorIndex = LABELS.indexOf(item.name)
          return (
            <div key={item.name} className="flex items-center gap-3">
              <div
                className="h-3 w-3 rounded-full"
                style={{ backgroundColor: COLORS[colorIndex] }}
              />
              <div>
                <p className="text-xs text-muted-foreground">{item.name}</p>
                <p className="font-mono text-sm font-semibold tabular-nums">
                  {formatCurrency(item.value)}
                </p>
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}
