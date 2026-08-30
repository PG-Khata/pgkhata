"use client"

import Link from "next/link"
import { useOwnerDashboard } from "@/hooks/use-dashboard"
import { useProperties } from "@/hooks/use-properties"
import { StatGroup } from "@/components/dashboard/stat-row"
import { Skeleton } from "@/components/ui/skeleton"
import { formatCurrency } from "@/lib/utils"

export default function DashboardPage() {
  const { data: dashboard, isLoading: dashLoading } = useOwnerDashboard()
  const { data: properties, isLoading: propsLoading } = useProperties()

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-lg font-semibold">Dashboard</h1>
      </div>

      {dashLoading ? (
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
          {Array.from({ length: 7 }).map((_, i) => (
            <div key={i} className="space-y-1">
              <Skeleton className="h-3 w-20" />
              <Skeleton className="h-6 w-16" />
            </div>
          ))}
        </div>
      ) : dashboard ? (
        <>
          <div className="space-y-1">
            <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
              Portfolio
            </p>
            <div className="border-b" />
          </div>
          <StatGroup
            stats={[
              { label: "Properties", value: dashboard.totalProperties },
              { label: "Rooms", value: dashboard.totalRooms },
              { label: "Tenants", value: dashboard.totalTenants },
              { label: "Occupancy", value: `${dashboard.occupancyRate}%` },
            ]}
          />

          <div className="space-y-1">
            <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
              Collections
            </p>
            <div className="border-b" />
          </div>
          <StatGroup
            stats={[
              { label: "Collected", value: formatCurrency(dashboard.monthlyCollection) },
              { label: "Pending", value: formatCurrency(dashboard.pendingRent) },
              { label: "Overdue", value: formatCurrency(dashboard.overdueRent) },
            ]}
          />
        </>
      ) : null}

      <div className="space-y-1">
        <div className="flex items-center justify-between">
          <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
            Properties
          </p>
          <Link
            href="/dashboard/properties"
            className="text-xs text-muted-foreground hover:text-foreground"
          >
            View all
          </Link>
        </div>
        <div className="border-b" />
      </div>

      {propsLoading ? (
        <div className="space-y-2">
          {Array.from({ length: 3 }).map((_, i) => (
            <Skeleton key={i} className="h-10 w-full" />
          ))}
        </div>
      ) : properties && properties.length > 0 ? (
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b text-left text-xs text-muted-foreground">
                <th className="pb-2 font-medium">Name</th>
                <th className="pb-2 font-medium">Address</th>
                <th className="pb-2 font-medium">Electricity</th>
              </tr>
            </thead>
            <tbody>
              {properties.map((p) => (
                <tr key={p.id} className="border-b last:border-0">
                  <td className="py-2.5">
                    <Link
                      href={`/dashboard/properties/${p.id}`}
                      className="font-medium hover:underline"
                    >
                      {p.name}
                    </Link>
                  </td>
                  <td className="py-2.5 text-muted-foreground">
                    {[p.address, p.city].filter(Boolean).join(", ") || "—"}
                  </td>
                  <td className="py-2.5 text-muted-foreground">
                    {p.electricityMode === "meter"
                      ? `₹${p.electricityRatePerUnit}/unit`
                      : "Flat rate"}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <div className="rounded-md border border-dashed p-8 text-center">
          <p className="text-sm text-muted-foreground">
            No properties yet.
          </p>
          <Link
            href="/dashboard/properties/new"
            className="mt-2 inline-block text-sm font-medium hover:underline"
          >
            Add your first property
          </Link>
        </div>
      )}
    </div>
  )
}
