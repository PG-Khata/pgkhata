"use client"

import { useState } from "react"
import {
  Bed,
  Building2,
  CheckCircle2,
  IndianRupee,
  LayoutGrid,
  Search,
  TrendingUp,
  Users,
  AlertTriangle,
  Wallet,
} from "lucide-react"
import { useOwnerDashboard, usePropertyDashboard, useDueRent } from "@/hooks/use-dashboard"
import { useSelectedProperty } from "@/components/layout/property-context"
import { StatCard } from "@/components/dashboard/stat-card"
import { PaymentStatusChart } from "@/components/dashboard/payment-status-chart"
import { OccupancyChart } from "@/components/dashboard/occupancy-chart"
import { Skeleton } from "@/components/ui/skeleton"
import { Input } from "@/components/ui/input"
import { formatCurrency } from "@/lib/utils"

export default function DashboardPage() {
  const { selectedProperty } = useSelectedProperty()
  const { data: ownerDashboard, isLoading: ownerLoading } = useOwnerDashboard()
  const { data: propertyDashboard, isLoading: propLoading } = usePropertyDashboard(
    selectedProperty?.id ?? "",
  )
  const { data: dueRent } = useDueRent(selectedProperty?.id ?? "")

  const [search, setSearch] = useState("")

  const isLoading = selectedProperty ? propLoading : ownerLoading
  const dashboard = selectedProperty ? propertyDashboard : ownerDashboard

  const totalBeds = dashboard?.totalBeds ?? 0
  const occupiedBeds = dashboard?.occupiedBeds ?? 0
  const vacantBeds = totalBeds - occupiedBeds
  const occupancyRate = dashboard?.occupancyRate ?? 0
  const monthlyCollection = selectedProperty
    ? (propertyDashboard?.monthlyCollected ?? 0)
    : (ownerDashboard?.monthlyCollection ?? 0)
  const pendingRent = selectedProperty
    ? (propertyDashboard?.monthlyPending ?? 0)
    : (ownerDashboard?.pendingRent ?? 0)
  const overdueRent = dashboard?.overdueRent ?? 0
  const totalRooms = dashboard?.totalRooms ?? 0
  const totalTenants = selectedProperty
    ? (propertyDashboard?.activeTenants ?? 0)
    : (ownerDashboard?.totalTenants ?? 0)
  const totalProperties = selectedProperty ? 1 : (ownerDashboard?.totalProperties ?? 0)

  const hasOverdue = overdueRent > 0

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-lg font-semibold tracking-tight">Dashboard</h1>
        <p className="mt-0.5 text-sm text-muted-foreground">
          {selectedProperty ? selectedProperty.name : "All properties"}
        </p>
      </div>

      {isLoading ? (
        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
            {Array.from({ length: 6 }).map((_, i) => (
              <div key={i} className="rounded-xl border bg-card p-4 space-y-2">
                <Skeleton className="h-3 w-20" />
                <Skeleton className="h-7 w-16" />
              </div>
            ))}
          </div>
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            {Array.from({ length: 4 }).map((_, i) => (
              <div key={i} className="rounded-xl border bg-card p-4 space-y-2">
                <Skeleton className="h-3 w-20" />
                <Skeleton className="h-7 w-16" />
              </div>
            ))}
          </div>
        </div>
      ) : dashboard ? (
        <>
          {/* Row 1: 6 stat cards */}
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
            <StatCard
              label="Total beds"
              value={totalBeds}
              icon={Bed}
            />
            <StatCard
              label="Occupied"
              value={occupiedBeds}
              subtitle={`${occupancyRate}%`}
              icon={Users}
              subtitleColor={occupancyRate > 80 ? "text-emerald-600" : "text-muted-foreground"}
            />
            <StatCard
              label="Vacant"
              value={vacantBeds}
              icon={Bed}
            />
            <StatCard
              label="Monthly collection"
              value={formatCurrency(monthlyCollection)}
              icon={IndianRupee}
            />
            <StatCard
              label="Pending rent"
              value={formatCurrency(pendingRent)}
              icon={AlertTriangle}
              iconColor="text-amber-500"
            />
            <StatCard
              label="Overdue"
              value={formatCurrency(overdueRent)}
              icon={AlertTriangle}
              iconColor="text-red-500"
            />
          </div>

          {/* Row 2: 4 stat cards */}
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            {!selectedProperty && (
              <StatCard
                label="Properties"
                value={totalProperties}
                icon={Building2}
              />
            )}
            <StatCard
              label="Rooms"
              value={totalRooms}
              icon={LayoutGrid}
            />
            <StatCard
              label="Tenants"
              value={totalTenants}
              icon={Users}
            />
            <StatCard
              label="Occupancy rate"
              value={`${occupancyRate}%`}
              icon={TrendingUp}
              iconColor={occupancyRate > 80 ? "text-emerald-600" : "text-muted-foreground"}
            />
          </div>

          {/* Charts */}
          <div className="grid gap-6 md:grid-cols-2">
            <div className="group relative overflow-hidden rounded-xl border bg-card p-5 shadow-xs transition-shadow hover:shadow-md">
              <div className="pointer-events-none absolute inset-0 rounded-xl bg-gradient-to-b from-transparent to-black/[0.02] opacity-0 transition-opacity group-hover:opacity-100" />
              <div className="mb-1 flex items-center justify-between">
                <h2 className="text-sm font-medium">Collection vs expenses</h2>
                <span className="text-xs text-muted-foreground">Last 6 months</span>
              </div>
              <PaymentStatusChart
                collected={monthlyCollection}
                pending={pendingRent}
                overdue={overdueRent}
              />
            </div>

            <div className="group relative overflow-hidden rounded-xl border bg-card p-5 shadow-xs transition-shadow hover:shadow-md">
              <div className="pointer-events-none absolute inset-0 rounded-xl bg-gradient-to-b from-transparent to-black/[0.02] opacity-0 transition-opacity group-hover:opacity-100" />
              <div className="mb-1 flex items-center justify-between">
                <h2 className="text-sm font-medium">Bed occupancy</h2>
                <span className="text-xs text-muted-foreground">
                  {totalBeds} total beds
                </span>
              </div>
              <OccupancyChart
                occupied={occupiedBeds}
                total={totalBeds}
              />
            </div>
          </div>

          {/* Status banner */}
          {!hasOverdue ? (
            <div className="flex items-center gap-3 rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3">
              <CheckCircle2 className="h-5 w-5 shrink-0 text-emerald-600" />
              <p className="text-sm text-emerald-800">
                No overdue rent right now - everything due is either paid or not yet past its due date.
              </p>
            </div>
          ) : (
            <div className="flex items-center gap-3 rounded-xl border border-red-200 bg-red-50 px-4 py-3">
              <AlertTriangle className="h-5 w-5 shrink-0 text-red-600" />
              <p className="text-sm text-red-800">
                {formatCurrency(overdueRent)} in overdue rent requires attention.
              </p>
            </div>
          )}

          {/* Outstanding payments section */}
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <h2 className="text-sm font-medium">Outstanding payments</h2>
              <div className="relative w-64">
                <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                <Input
                  placeholder="Search tenant, room, or bed"
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  className="pl-9 h-9"
                />
              </div>
            </div>

            {(() => {
              const rows = (dueRent ?? []).filter((r) => {
                const q = search.toLowerCase()
                return !search || r.tenantName.toLowerCase().includes(q) || (r.roomNumber ?? "").toLowerCase().includes(q)
              })

              if (rows.length === 0) {
                return (
                  <div className="rounded-xl border border-dashed bg-card p-12 text-center">
                    <Wallet className="mx-auto h-10 w-10 text-muted-foreground/30" />
                    <p className="mt-3 text-sm font-medium text-muted-foreground">Nothing outstanding</p>
                    <p className="mt-1 text-xs text-muted-foreground">Everyone is paid up - no pending rent, charges, or deposit.</p>
                  </div>
                )
              }

              return (
                <div className="rounded-xl border bg-card shadow-xs overflow-hidden">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b bg-muted/50 text-left text-xs text-muted-foreground">
                        <th className="px-4 py-3 font-medium">TENANT</th>
                        <th className="px-4 py-3 font-medium">ROOM</th>
                        <th className="px-4 py-3 font-medium">AMOUNT DUE</th>
                        <th className="px-4 py-3 font-medium">DAYS OVERDUE</th>
                      </tr>
                    </thead>
                    <tbody>
                      {rows.map((r) => (
                        <tr key={r.tenantId} className="border-b last:border-0 hover:bg-muted/30">
                          <td className="px-4 py-3 font-medium">{r.tenantName}</td>
                          <td className="px-4 py-3 text-muted-foreground">{r.roomNumber || "-"}</td>
                          <td className="px-4 py-3 font-mono">{formatCurrency(r.amountDue)}</td>
                          <td className="px-4 py-3">
                            <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${
                              r.daysOverdue > 30 ? "bg-red-50 text-red-700" :
                              r.daysOverdue > 0 ? "bg-amber-50 text-amber-700" :
                              "bg-zinc-100 text-zinc-700"
                            }`}>
                              {r.daysOverdue > 0 ? `${r.daysOverdue} days` : "Current"}
                            </span>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )
            })()}
          </div>
        </>
      ) : null}
    </div>
  )
}
