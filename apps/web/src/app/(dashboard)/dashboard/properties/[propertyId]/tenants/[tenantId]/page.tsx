"use client"

import { useParams } from "next/navigation"
import Link from "next/link"
import { useTenant } from "@/hooks/use-tenants"
import { useProperty } from "@/hooks/use-properties"
import { StatusBadge } from "@/components/dashboard/status-badge"
import { Skeleton } from "@/components/ui/skeleton"
import { formatCurrency, formatPhone, formatDate } from "@/lib/utils"
import { ArrowLeft } from "lucide-react"

export default function TenantDetailPage() {
  const params = useParams()
  const propertyId = params.propertyId as string
  const tenantId = params.tenantId as string
  const { data: tenant, isLoading } = useTenant(propertyId, tenantId)
  const { data: property } = useProperty(propertyId)

  if (isLoading) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-6 w-48" />
        <Skeleton className="h-32 w-full" />
      </div>
    )
  }

  if (!tenant) {
    return (
      <div className="text-center py-12">
        <p className="text-sm text-muted-foreground">Tenant not found.</p>
        <Link
          href={`/dashboard/properties/${propertyId}/tenants`}
          className="mt-2 inline-block text-sm font-medium hover:underline"
        >
          Back to tenants
        </Link>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <Link
          href={`/dashboard/properties/${propertyId}/tenants`}
          className="text-muted-foreground hover:text-foreground"
        >
          <ArrowLeft className="h-4 w-4" />
        </Link>
        <div>
          <h1 className="text-lg font-semibold">{tenant.name}</h1>
          {property && (
            <p className="text-xs text-muted-foreground">{property.name}</p>
          )}
        </div>
      </div>

      <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
        <div className="space-y-0.5">
          <p className="text-xs text-muted-foreground">Status</p>
          <StatusBadge status={tenant.status} />
        </div>
        <div className="space-y-0.5">
          <p className="text-xs text-muted-foreground">Phone</p>
          <p className="font-mono text-sm">{formatPhone(tenant.phone)}</p>
        </div>
        <div className="space-y-0.5">
          <p className="text-xs text-muted-foreground">Joined</p>
          <p className="text-sm">{formatDate(tenant.joiningDate)}</p>
        </div>
        {tenant.monthlyRentOverride && (
          <div className="space-y-0.5">
            <p className="text-xs text-muted-foreground">Rent</p>
            <p className="font-mono text-sm">{formatCurrency(tenant.monthlyRentOverride)}</p>
          </div>
        )}
      </div>

      {tenant.email && (
        <div className="space-y-0.5">
          <p className="text-xs text-muted-foreground">Email</p>
          <p className="text-sm">{tenant.email}</p>
        </div>
      )}

      {tenant.deposit && (
        <div className="space-y-0.5">
          <p className="text-xs text-muted-foreground">Deposit</p>
          <p className="font-mono text-sm">{formatCurrency(tenant.deposit)}</p>
        </div>
      )}

      {tenant.notes && (
        <div className="space-y-0.5">
          <p className="text-xs text-muted-foreground">Notes</p>
          <p className="text-sm">{tenant.notes}</p>
        </div>
      )}
    </div>
  )
}
