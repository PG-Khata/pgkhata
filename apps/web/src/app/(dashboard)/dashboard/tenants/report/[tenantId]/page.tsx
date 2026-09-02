"use client"

import { useParams } from "next/navigation"
import Link from "next/link"
import { useSelectedProperty } from "@/components/layout/property-context"
import { useTenant } from "@/hooks/use-tenants"
import { useTenantFinancialReport, useTenantCheckoutPreview } from "@/hooks/use-tenant-report"
import { StatusBadge } from "@/components/dashboard/status-badge"
import { Skeleton } from "@/components/ui/skeleton"
import { StatCard } from "@/components/dashboard/stat-card"
import { formatCurrency, formatDateShort } from "@/lib/utils"
import {
  ArrowLeft,
  Banknote,
  Bed,
  CalendarDays,
  CreditCard,
  PiggyBank,
} from "lucide-react"

export default function TenantFinancialDetailPage() {
  const params = useParams()
  const tenantId = params.tenantId as string
  const { selectedProperty } = useSelectedProperty()
  const propertyId = selectedProperty?.id ?? ""

  const { data: tenant, isLoading: tenantLoading } = useTenant(propertyId, tenantId)
  const { data: report, isLoading: reportLoading } = useTenantFinancialReport(propertyId, tenantId)
  const { data: preview, isLoading: previewLoading } = useTenantCheckoutPreview(propertyId, tenantId)

  const isLoading = tenantLoading || reportLoading || previewLoading

  if (isLoading) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-8 w-40" />
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
          <Skeleton className="h-24" />
          <Skeleton className="h-24" />
          <Skeleton className="h-24" />
        </div>
        <Skeleton className="h-48" />
      </div>
    )
  }

  if (!tenant) {
    return (
      <div className="space-y-6">
        <Link href="/dashboard/tenants/report" className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground">
          <ArrowLeft className="h-4 w-4" /> Back to report
        </Link>
        <p className="text-sm text-muted-foreground">Tenant not found.</p>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-start justify-between">
        <div>
          <Link href="/dashboard/tenants/report" className="mb-2 inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground">
            <ArrowLeft className="h-4 w-4" /> Back to report
          </Link>
          <div className="flex items-center gap-3">
            <h1 className="text-lg font-semibold tracking-tight">{tenant.name}</h1>
            <StatusBadge status={tenant.status} />
          </div>
          <p className="mt-0.5 text-sm text-muted-foreground font-mono">{tenant.phone}</p>
        </div>
      </div>

      {/* Summary cards */}
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
        <StatCard
          label="Security deposit"
          value={`${formatCurrency(preview?.securityDepositHeld ?? 0)} / ${formatCurrency(preview?.securityDepositHeld ?? 0)}`}
          icon={Banknote}
        />
        <StatCard
          label="Advance available"
          value={formatCurrency(preview?.advanceAvailable ?? 0)}
          icon={PiggyBank}
        />
        <StatCard
          label="Rent pending"
          value={formatCurrency(report?.summary.totalBalance ?? 0)}
          icon={CreditCard}
        />
      </div>

      {/* Security Deposits */}
      <div className="rounded-xl border bg-card p-6">
        <p className="mb-4 text-sm font-medium">Security deposits</p>
        {preview?.securityDepositHeld ? (
          <div className="text-sm">
            <p>Held: {formatCurrency(preview.securityDepositHeld)}</p>
            {preview.securityDepositRefunded > 0 && (
              <p className="text-muted-foreground">Refunded: {formatCurrency(preview.securityDepositRefunded)}</p>
            )}
          </div>
        ) : (
          <div className="rounded-lg border border-dashed p-8 text-center">
            <Banknote className="mx-auto h-8 w-8 text-muted-foreground/30" />
            <p className="mt-2 text-sm text-muted-foreground">No security deposit collected yet</p>
          </div>
        )}
      </div>

      {/* Advance Payments */}
      <div className="rounded-xl border bg-card p-6">
        <p className="mb-4 text-sm font-medium">Advance payments</p>
        {preview?.advanceAvailable ? (
          <div className="text-sm">
            <p>Available: {formatCurrency(preview.advanceAvailable)}</p>
            {preview.advanceApplied > 0 && (
              <p className="text-muted-foreground">Applied: {formatCurrency(preview.advanceApplied)}</p>
            )}
          </div>
        ) : (
          <div className="rounded-lg border border-dashed p-8 text-center">
            <PiggyBank className="mx-auto h-8 w-8 text-muted-foreground/30" />
            <p className="mt-2 text-sm text-muted-foreground">No advance collected yet</p>
          </div>
        )}
      </div>

      {/* Month-wise Rent */}
      <div className="rounded-xl border bg-card p-6">
        <p className="mb-4 text-sm font-medium">Month-wise rent</p>
        {report?.bills && report.bills.length > 0 ? (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b text-left text-xs text-muted-foreground">
                  <th className="pb-2 font-medium">MONTH</th>
                  <th className="pb-2 font-medium">RENT</th>
                  <th className="pb-2 font-medium">ELECTRICITY</th>
                  <th className="pb-2 font-medium">TOTAL</th>
                  <th className="pb-2 font-medium">PAID</th>
                  <th className="pb-2 font-medium">BALANCE</th>
                  <th className="pb-2 font-medium">STATUS</th>
                </tr>
              </thead>
              <tbody>
                {report.bills.map((b) => (
                  <tr key={b.id} className="border-b last:border-0">
                    <td className="py-2">{b.billMonth}</td>
                    <td className="py-2 font-mono">{formatCurrency(b.rentAmount)}</td>
                    <td className="py-2 font-mono">{formatCurrency(b.electricityAmount)}</td>
                    <td className="py-2 font-mono">{formatCurrency(b.totalAmount)}</td>
                    <td className="py-2 font-mono">{formatCurrency(b.paidAmount)}</td>
                    <td className="py-2 font-mono">{formatCurrency(b.balance)}</td>
                    <td className="py-2">
                      <StatusBadge status={b.status} />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <div className="rounded-lg border border-dashed p-8 text-center">
            <CalendarDays className="mx-auto h-8 w-8 text-muted-foreground/30" />
            <p className="mt-2 text-sm text-muted-foreground">No bills generated yet</p>
          </div>
        )}
      </div>
    </div>
  )
}
