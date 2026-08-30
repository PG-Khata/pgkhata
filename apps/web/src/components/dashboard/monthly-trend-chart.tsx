"use client"

import { AreaChart, Area, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid } from "recharts"
import { formatCurrency } from "@/lib/utils"
import type { MonthlyTrendPoint } from "@/types"

function monthLabel(month: string) {
  const [year, m] = month.split("-")
  const date = new Date(Number(year), Number(m) - 1, 1)
  return date.toLocaleDateString("en-IN", { month: "short" })
}

export function MonthlyTrendChart({ data }: { data: MonthlyTrendPoint[] }) {
  return (
    <div className="h-56 w-full">
      <ResponsiveContainer width="100%" height="100%">
        <AreaChart data={data} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
          <CartesianGrid strokeDasharray="3 3" vertical={false} className="stroke-muted" />
          <XAxis
            dataKey="month"
            tickFormatter={monthLabel}
            tick={{ fontSize: 12 }}
            axisLine={false}
            tickLine={false}
          />
          <YAxis
            tick={{ fontSize: 12 }}
            axisLine={false}
            tickLine={false}
            tickFormatter={(v) => `₹${Math.round(v / 1000)}k`}
            width={48}
          />
          <Tooltip
            formatter={(value, name) => [formatCurrency(Number(value)), name]}
            labelFormatter={(label) => monthLabel(label as string)}
          />
          <Area
            type="monotone"
            dataKey="collected"
            name="Collected"
            stroke="#059669"
            fill="#05966920"
            strokeWidth={2}
          />
          <Area
            type="monotone"
            dataKey="expenses"
            name="Expenses"
            stroke="#dc2626"
            fill="#dc262620"
            strokeWidth={2}
          />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  )
}
