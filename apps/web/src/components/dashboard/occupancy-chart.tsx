"use client"

import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip } from "recharts"
import { NumberTicker } from "@/components/ui/number-ticker"

interface OccupancyChartProps {
  occupied: number
  total: number
}

const COLORS = ["#059669", "#e5e7eb"]

export function OccupancyChart({ occupied, total }: OccupancyChartProps) {
  if (total === 0) {
    return (
      <div className="flex h-48 items-center justify-center text-sm text-muted-foreground">
        No beds configured
      </div>
    )
  }

  const vacant = total - occupied
  const data = [
    { name: "Occupied", value: occupied },
    { name: "Vacant", value: vacant },
  ].filter((d) => d.value > 0)

  const percentage = Math.round((occupied / total) * 100)

  return (
    <div className="flex items-center gap-6">
      <div className="relative h-48 w-48 shrink-0">
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
              startAngle={90}
              endAngle={-270}
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
              formatter={(value, name) => [`${value} beds`, name]}
              contentStyle={{
                borderRadius: "8px",
                border: "1px solid var(--border)",
                boxShadow: "0 4px 12px rgba(0,0,0,0.08)",
                fontSize: "13px",
              }}
            />
          </PieChart>
        </ResponsiveContainer>
        <div className="absolute inset-0 flex flex-col items-center justify-center">
          <span className="font-mono text-2xl font-bold tabular-nums">
            <NumberTicker value={percentage} />%
          </span>
          <span className="text-[11px] text-muted-foreground">occupied</span>
        </div>
      </div>

      <div className="flex flex-col gap-3">
        <div className="flex items-center gap-3">
          <div className="h-3 w-3 rounded-full bg-emerald-600" />
          <div>
            <p className="text-xs text-muted-foreground">Occupied</p>
            <p className="font-mono text-sm font-semibold tabular-nums">
              <NumberTicker value={occupied} /> beds
            </p>
          </div>
        </div>
        <div className="flex items-center gap-3">
          <div className="h-3 w-3 rounded-full bg-gray-200" />
          <div>
            <p className="text-xs text-muted-foreground">Vacant</p>
            <p className="font-mono text-sm font-semibold tabular-nums">
              <NumberTicker value={vacant} /> beds
            </p>
          </div>
        </div>
      </div>
    </div>
  )
}
