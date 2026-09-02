"use client"

import { useParams } from "next/navigation"
import { useState } from "react"
import Link from "next/link"
import { useProperty } from "@/hooks/use-properties"
import {
  usePropertyDashboard,
  useMonthlyTrend,
  useDueRent,
  useOutstandingAging,
} from "@/hooks/use-dashboard"
import { StatGroup } from "@/components/dashboard/stat-row"
import { MonthlyTrendChart } from "@/components/dashboard/monthly-trend-chart"
import { Skeleton } from "@/components/ui/skeleton"
import { Button } from "@/components/ui/button"
import { EditPropertyModal } from "@/components/dashboard/edit-property-modal"
import { formatCurrency } from "@/lib/utils"
import { Pencil } from "lucide-react"

export default function PropertyDetailPage() {
  const [editOpen, setEditOpen] = useState(false)
  const params = useParams()
  const propertyId = params.propertyId as string
  const { data: property, isLoading: propLoading } = useProperty(propertyId)
  const { data: dashboard, isLoading: dashLoading } = usePropertyDashboard(propertyId)
  const { data: trend, isLoading: trendLoading } = useMonthlyTrend(propertyId)
  const { data: dueRent, isLoading: dueRentLoading } = useDueRent(propertyId)
  const { data: aging } = useOutstandingAging(propertyId)

  if (propLoading) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-6 w-48" />
        <Skeleton className="h-4 w-32" />
        <Skeleton className="h-24 w-full" />
      </div>
    )
  }

  if (!property) {
    return (
      <div className="text-center py-12">
        <p className="text-sm text-muted-foreground">Property not found.</p>
        <Link href="/dashboard/properties" className="mt-2 inline-block text-sm font-medium hover:underline">
          Back to properties
        </Link>
      </div>
    )
  }

  const tabs = [
    { label: "Overview", href: "/dashboard" },
    { label: "Rooms", href: "/dashboard/structure" },
    { label: "Tenants", href: "/dashboard/tenants" },
    { label: "Billing", href: "/dashboard/billing" },
    { label: "Readings", href: "/dashboard/readings" },
  ]

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-lg font-semibold">{property.name}</h1>
          <p className="text-xs text-muted-foreground">
            {[property.address, property.city, property.state, property.pincode]
              .filter(Boolean)
              .join(", ")}
          </p>
        </div>
        <Button variant="outline" size="sm" onClick={() => setEditOpen(true)}>
          <Pencil className="mr-1.5 h-3.5 w-3.5" />
          Edit
        </Button>
      </div>

      <EditPropertyModal property={property} open={editOpen} onOpenChange={setEditOpen} />

      <div className="flex gap-1 overflow-x-auto border-b">
        {tabs.map((tab) => {
          const isActive = tab.label === "Overview"
          return (
            <Link
              key={tab.href}
              href={tab.href}
              className={`shrink-0 border-b-2 px-3 py-2 text-sm ${
                isActive
                  ? "border-foreground font-medium"
                  : "border-transparent text-muted-foreground hover:text-foreground"
              }`}
            >
              {tab.label}
            </Link>
          )
        })}
      </div>

      {dashLoading ? (
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="space-y-1">
              <Skeleton className="h-3 w-20" />
              <Skeleton className="h-6 w-16" />
            </div>
          ))}
        </div>
      ) : dashboard ? (
        <StatGroup
          stats={[
            { label: "Rooms", value: dashboard.totalRooms },
            { label: "Tenants", value: dashboard.activeTenants },
            { label: "Occupancy", value: `${dashboard.occupancyRate}%` },
            { label: "Monthly Rent", value: formatCurrency(dashboard.monthlyBilled) },
          ]}
        />
      ) : null}

      {dashboard && (
        <>
          <div className="space-y-1">
            <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
              Collections
            </p>
            <div className="border-b" />
          </div>
          <StatGroup
            stats={[
              { label: "Billed", value: formatCurrency(dashboard.monthlyBilled) },
              { label: "Collected", value: formatCurrency(dashboard.monthlyCollected) },
              { label: "Pending", value: formatCurrency(dashboard.monthlyPending) },
            ]}
          />
        </>
      )}

      <div className="space-y-1">
        <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
          6-month trend
        </p>
        <div className="border-b" />
      </div>
      {trendLoading ? (
        <Skeleton className="h-56 w-full" />
      ) : trend && trend.length > 0 ? (
        <MonthlyTrendChart data={trend} />
      ) : null}

      <div className="grid gap-6 sm:grid-cols-2">
        <div className="space-y-2">
          <div className="space-y-1">
            <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
              Due rent
            </p>
            <div className="border-b" />
          </div>
          {dueRentLoading ? (
            <Skeleton className="h-24 w-full" />
          ) : dueRent && dueRent.length > 0 ? (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b text-left text-xs text-muted-foreground">
                    <th className="pb-2 font-medium">Tenant</th>
                    <th className="pb-2 font-medium">Room</th>
                    <th className="pb-2 text-right font-medium">Due</th>
                    <th className="pb-2 text-right font-medium">Days</th>
                  </tr>
                </thead>
                <tbody>
                  {dueRent.map((row) => (
                    <tr key={row.tenantId} className="border-b last:border-0">
                      <td className="py-2 font-medium">{row.tenantName}</td>
                      <td className="py-2 text-muted-foreground">{row.roomNumber ?? "—"}</td>
                      <td className="py-2 text-right font-mono">
                        {formatCurrency(row.amountDue)}
                      </td>
                      <td className="py-2 text-right font-mono text-muted-foreground">
                        {row.daysOverdue > 0 ? row.daysOverdue : "—"}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <p className="py-4 text-sm text-muted-foreground">No rent is currently due.</p>
          )}
        </div>

        <div className="space-y-2">
          <div className="space-y-1">
            <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
              Outstanding by age
            </p>
            <div className="border-b" />
          </div>
          {aging && aging.total > 0 ? (
            <div className="space-y-1.5">
              {aging.buckets
                .filter((b) => b.total > 0)
                .map((b) => (
                  <div key={b.bucket} className="flex items-center justify-between text-sm">
                    <span className="text-muted-foreground">
                      {b.bucket === "current" ? "Not yet due" : `${b.bucket} days`}
                    </span>
                    <span className="font-mono">{formatCurrency(b.total)}</span>
                  </div>
                ))}
              <div className="flex items-center justify-between border-t pt-1.5 text-sm font-medium">
                <span>Total outstanding</span>
                <span className="font-mono">{formatCurrency(aging.total)}</span>
              </div>
            </div>
          ) : (
            <p className="py-4 text-sm text-muted-foreground">Nothing outstanding.</p>
          )}
        </div>
      </div>
    </div>
  )
}
