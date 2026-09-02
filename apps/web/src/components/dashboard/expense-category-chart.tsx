"use client"

import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  CartesianGrid,
  Cell,
} from "recharts"
import { formatCurrency } from "@/lib/utils"
import type { ExpenseCategorySummary } from "@/types"

const COLORS = [
  "#059669",
  "#0891b2",
  "#7c3aed",
  "#e11d48",
  "#ea580c",
  "#ca8a04",
  "#2563eb",
  "#9333ea",
]

export function ExpenseCategoryChart({
  data,
}: {
  data: ExpenseCategorySummary[]
}) {
  if (data.length === 0) {
    return (
      <div className="flex h-56 items-center justify-center text-sm text-muted-foreground">
        No expenses recorded
      </div>
    )
  }

  const sorted = [...data].sort((a, b) => b.total - a.total)

  return (
    <div className="h-56 w-full">
      <ResponsiveContainer width="100%" height="100%">
        <BarChart
          data={sorted}
          layout="vertical"
          margin={{ top: 0, right: 8, left: 0, bottom: 0 }}
        >
          <CartesianGrid
            strokeDasharray="3 3"
            horizontal={false}
            className="stroke-muted"
          />
          <XAxis
            type="number"
            tick={{ fontSize: 12 }}
            axisLine={false}
            tickLine={false}
            tickFormatter={(v) => `${Math.round(v / 1000)}k`}
          />
          <YAxis
            type="category"
            dataKey="categoryName"
            tick={{ fontSize: 12 }}
            axisLine={false}
            tickLine={false}
            width={100}
          />
          <Tooltip
            formatter={(value) => formatCurrency(Number(value))}
            cursor={{ fill: "var(--muted)", opacity: 0.3 }}
            contentStyle={{
              borderRadius: "8px",
              border: "1px solid var(--border)",
              boxShadow: "0 4px 12px rgba(0,0,0,0.08)",
              fontSize: "13px",
            }}
          />
          <Bar dataKey="total" radius={[0, 4, 4, 0]} barSize={20}>
            {sorted.map((_, index) => (
              <Cell key={index} fill={COLORS[index % COLORS.length]} />
            ))}
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </div>
  )
}
