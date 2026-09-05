"use client"

import { useState } from "react"
import Link from "next/link"
import { useSelectedProperty } from "@/components/layout/property-context"
import { useTenants } from "@/hooks/use-tenants"
import { useSecurityDeposits } from "@/hooks/use-security-deposits"
import { useAdvancePayments } from "@/hooks/use-advance-payments"
import { StatusBadge } from "@/components/dashboard/status-badge"
import { Button } from "@/components/ui/button"
import { Skeleton } from "@/components/ui/skeleton"
import { Input } from "@/components/ui/input"
import { StatCard } from "@/components/dashboard/stat-card"
import { formatPhone, formatCurrency } from "@/lib/utils"
import {
  ArrowLeft,
  Banknote,
  CreditCard,
  PiggyBank,
  Search,
  Users,
} from "lucide-react"

export default function TenantReportPage() {
  const { selectedProperty } = useSelectedProperty()
  const propertyId = selectedProperty?.id ?? ""

  const { data: tenants, isLoading: tenantsLoading } = useTenants(propertyId)
  const { data: deposits, isLoading: depositsLoading } = useSecurityDeposits(propertyId)
  const { data: advances, isLoading: advancesLoading } = useAdvancePayments(propertyId)

  const [search, setSearch] = useState("")

  const isLoading = tenantsLoading || depositsLoading || advancesLoading

  const depositMap = new Map(
    (deposits ?? []).map((d) => [d.deposit.tenantId, d.deposit]),
  )
  const advanceMap = new Map<string, number>()
  if (advances) {
    for (const a of advances) {
      const key = a.advance.tenantId
      advanceMap.set(key, (advanceMap.get(key) ?? 0) + a.advance.amount)
    }
  }

  const totalDepositPending = (deposits ?? []).reduce(
    (sum, d) => sum + (d.deposit.amount - d.deposit.refundAmount),
    0,
  )
  const totalAdvance = (advances ?? []).reduce(
    (sum, a) => sum + a.advance.amount,
    0,
  )

  const filtered = (tenants ?? []).filter((t) => {
    const q = search.toLowerCase()
    return (
      t.name.toLowerCase().includes(q) ||
      t.phone.includes(search) ||
      t.roomNumber?.toLowerCase().includes(q) ||
      t.bedNumber?.toLowerCase().includes(q)
    )
  })

  if (!selectedProperty) {
    return (
      <div className="space-y-6">
        <div>
          <h1 className="text-lg font-semibold tracking-tight">Tenant report</h1>
          <p className="mt-0.5 text-sm text-muted-foreground">
            Select a property from the header to view the report.
          </p>
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <div>
        <Link
          href="/dashboard/tenants"
          className="mb-2 inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground"
        >
          <ArrowLeft className="h-4 w-4" />
          Back to Tenants
        </Link>
        <h1 className="text-lg font-semibold tracking-tight">Tenant report</h1>
        <p className="mt-0.5 text-sm text-muted-foreground">
          Security deposit, advance, and month-wise rent — all in one place.
        </p>
      </div>

      {/* Summary cards */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <StatCard label="Tenants" value={tenants?.length ?? 0} icon={Users} />
        <StatCard
          label="Deposit pending"
          value={formatCurrency(totalDepositPending)}
          icon={Banknote}
        />
        <StatCard
          label="Advance available"
          value={formatCurrency(totalAdvance)}
          icon={PiggyBank}
        />
        <StatCard label="Rent pending" value={formatCurrency(0)} icon={CreditCard} />
      </div>

      {/* Search */}
      <div className="relative w-full max-w-sm">
        <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
        <Input
          placeholder="Search by name, phone, room, or bed..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="pl-9"
        />
      </div>

      {isLoading ? (
        <div className="space-y-2">
          {Array.from({ length: 4 }).map((_, i) => (
            <Skeleton key={i} className="h-14 w-full rounded-xl" />
          ))}
        </div>
      ) : filtered.length > 0 ? (
        <div className="group relative overflow-hidden rounded-xl border bg-card shadow-xs">
          <div className="pointer-events-none absolute inset-0 rounded-xl bg-gradient-to-b from-transparent to-black/[0.02] opacity-0 transition-opacity group-hover:opacity-100" />
          {/* Desktop table */}
          <div className="hidden sm:block overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b bg-muted/50 text-left text-xs text-muted-foreground">
                  <th className="px-4 py-3 font-medium">TENANT</th>
                  <th className="px-4 py-3 font-medium">ROOM / BED</th>
                  <th className="px-4 py-3 font-medium">STATUS</th>
                  <th className="px-4 py-3 font-medium">SECURITY DEPOSIT</th>
                  <th className="px-4 py-3 font-medium">ADVANCE</th>
                  <th className="px-4 py-3 font-medium"></th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((t) => {
                  const deposit = depositMap.get(t.id)
                  const advanceTotal = advanceMap.get(t.id) ?? 0
                  return (
                    <tr
                      key={t.id}
                      className="border-b last:border-0 transition-colors hover:bg-muted/30"
                    >
                      <td className="px-4 py-3">
                        <div>
                          <p className="font-medium">{t.name}</p>
                          <p className="text-xs text-muted-foreground font-mono">
                            {formatPhone(t.phone)}
                          </p>
                        </div>
                      </td>
                      <td className="px-4 py-3 text-muted-foreground">
                        {t.bedNumber
                          ? `${t.roomNumber || ""}-${t.bedNumber}`
                          : "Unassigned"}
                      </td>
                      <td className="px-4 py-3">
                        <StatusBadge status={t.status} />
                      </td>
                      <td className="px-4 py-3 font-mono text-muted-foreground">
                        {formatCurrency(deposit?.amount ?? 0)}
                      </td>
                      <td className="px-4 py-3 font-mono text-muted-foreground">
                        {formatCurrency(advanceTotal)}
                      </td>
                      <td className="px-4 py-3">
                        <Link href={`/dashboard/tenants/report/${t.id}`}>
                          <Button variant="outline" size="sm" className="h-7">
                            View
                          </Button>
                        </Link>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
            <div className="flex items-center justify-between border-t px-4 py-3 text-xs text-muted-foreground">
              <span>
                Showing 1-{filtered.length} of {filtered.length}
              </span>
            </div>
          </div>
          {/* Mobile cards */}
          <div className="sm:hidden divide-y">
            {filtered.map((t) => {
              const deposit = depositMap.get(t.id)
              const advanceTotal = advanceMap.get(t.id) ?? 0
              return (
                <div key={t.id} className="p-4 space-y-3">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="font-medium">{t.name}</p>
                      <p className="text-xs text-muted-foreground font-mono">{formatPhone(t.phone)}</p>
                    </div>
                    <StatusBadge status={t.status} />
                  </div>
                  <div className="grid grid-cols-2 gap-2 text-sm">
                    <div>
                      <p className="text-xs text-muted-foreground">Room / Bed</p>
                      <p>{t.bedNumber ? `${t.roomNumber || ""}-${t.bedNumber}` : "Unassigned"}</p>
                    </div>
                    <div>
                      <p className="text-xs text-muted-foreground">Security Deposit</p>
                      <p className="font-mono text-muted-foreground">{formatCurrency(deposit?.amount ?? 0)}</p>
                    </div>
                    <div>
                      <p className="text-xs text-muted-foreground">Advance</p>
                      <p className="font-mono text-muted-foreground">{formatCurrency(advanceTotal)}</p>
                    </div>
                  </div>
                  <Link href={`/dashboard/tenants/report/${t.id}`}>
                    <Button variant="outline" size="sm" className="w-full h-9">
                      View Details
                    </Button>
                  </Link>
                </div>
              )
            })}
            <div className="px-4 py-3 text-xs text-muted-foreground text-center">
              Showing 1-{filtered.length} of {filtered.length}
            </div>
          </div>
        </div>
      ) : (
        <div className="rounded-xl border border-dashed p-12 text-center">
          <Users className="mx-auto h-10 w-10 text-muted-foreground/30" />
          <p className="mt-3 text-sm font-medium text-muted-foreground">No tenants</p>
        </div>
      )}
    </div>
  )
}
