"use client"

import { useParams } from "next/navigation"
import Link from "next/link"
import { useTenants, useDeleteTenant } from "@/hooks/use-tenants"
import { useProperty } from "@/hooks/use-properties"
import { StatusBadge } from "@/components/dashboard/status-badge"
import { Button } from "@/components/ui/button"
import { Skeleton } from "@/components/ui/skeleton"
import { formatCurrency, formatPhone, formatDateShort } from "@/lib/utils"
import { toast } from "sonner"
import { ArrowLeft, Plus, Trash2 } from "lucide-react"
import { useState } from "react"

export default function TenantsPage() {
  const params = useParams()
  const propertyId = params.propertyId as string
  const [statusFilter, setStatusFilter] = useState<string>("")
  const { data: property } = useProperty(propertyId)
  const { data: tenants, isLoading } = useTenants(propertyId, statusFilter || undefined)
  const deleteTenant = useDeleteTenant(propertyId)

  function handleDelete(tenantId: string, name: string) {
    if (!confirm(`Delete tenant "${name}"?`)) return
    deleteTenant.mutate(tenantId, {
      onSuccess: () => toast.success("Tenant deleted"),
      onError: () => toast.error("Failed to delete tenant"),
    })
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Link
            href={`/dashboard/properties/${propertyId}`}
            className="text-muted-foreground hover:text-foreground"
          >
            <ArrowLeft className="h-4 w-4" />
          </Link>
          <div>
            <h1 className="text-lg font-semibold">Tenants</h1>
            {property && (
              <p className="text-xs text-muted-foreground">{property.name}</p>
            )}
          </div>
        </div>
        <Button size="sm" render={<Link href={`/dashboard/properties/${propertyId}/tenants/new`} />}>
          <Plus className="mr-1.5 h-3.5 w-3.5" />
          Add tenant
        </Button>
      </div>

      <div className="flex gap-2">
        {["", "active", "vacating", "vacated"].map((s) => (
          <button
            key={s}
            onClick={() => setStatusFilter(s)}
            className={`rounded-md px-3 py-1.5 text-xs ${
              statusFilter === s
                ? "bg-foreground text-background"
                : "bg-muted text-muted-foreground hover:text-foreground"
            }`}
          >
            {s === "" ? "All" : s.charAt(0).toUpperCase() + s.slice(1)}
          </button>
        ))}
      </div>

      {isLoading ? (
        <div className="space-y-2">
          {Array.from({ length: 5 }).map((_, i) => (
            <Skeleton key={i} className="h-10 w-full" />
          ))}
        </div>
      ) : tenants && tenants.length > 0 ? (
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b text-left text-xs text-muted-foreground">
                <th className="pb-2 font-medium">Name</th>
                <th className="pb-2 font-medium">Phone</th>
                <th className="pb-2 font-medium">Bed</th>
                <th className="pb-2 font-medium">Status</th>
                <th className="pb-2 font-medium">Joined</th>
                <th className="pb-2 font-medium"></th>
              </tr>
            </thead>
            <tbody>
              {tenants.map((t) => (
                <tr key={t.id} className="border-b last:border-0 hover:bg-muted/50">
                  <td className="py-2.5">
                    <Link
                      href={`/dashboard/properties/${propertyId}/tenants/${t.id}`}
                      className="font-medium hover:underline"
                    >
                      {t.name}
                    </Link>
                  </td>
                  <td className="py-2.5 font-mono text-muted-foreground">
                    {formatPhone(t.phone)}
                  </td>
                  <td className="py-2.5 font-mono text-muted-foreground">
                    {t.bedNumber ? `${t.roomNumber}-${t.bedNumber}` : "—"}
                  </td>
                  <td className="py-2.5">
                    <StatusBadge status={t.status} />
                  </td>
                  <td className="py-2.5 text-muted-foreground">
                    {formatDateShort(t.joiningDate)}
                  </td>
                  <td className="py-2.5 text-right">
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-7 w-7 text-muted-foreground hover:text-destructive"
                      onClick={() => handleDelete(t.id, t.name)}
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </Button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <div className="rounded-md border border-dashed p-8 text-center">
          <p className="text-sm text-muted-foreground">No tenants yet.</p>
          <Link
            href={`/dashboard/properties/${propertyId}/tenants/new`}
            className="mt-2 inline-block text-sm font-medium hover:underline"
          >
            Add your first tenant
          </Link>
        </div>
      )}
    </div>
  )
}
