"use client"

import Link from "next/link"
import { useProperties } from "@/hooks/use-properties"
import { useTenants } from "@/hooks/use-tenants"
import { StatusBadge } from "@/components/dashboard/status-badge"
import { Skeleton } from "@/components/ui/skeleton"
import { formatPhone, formatDateShort } from "@/lib/utils"

export default function TenantsPage() {
  const { data: properties, isLoading: propsLoading } = useProperties()

  // Show tenants for the first property by default
  // In a real app, you'd have a global tenants endpoint
  const firstPropertyId = properties?.[0]?.id || ""
  const { data: tenants, isLoading: tenantsLoading } = useTenants(firstPropertyId)

  const isLoading = propsLoading || tenantsLoading

  return (
    <div className="space-y-6">
      <h1 className="text-lg font-semibold">Tenants</h1>

      {properties && properties.length > 1 && (
        <p className="text-xs text-muted-foreground">
          Showing tenants for {properties[0]?.name}. Select a property to see its tenants.
        </p>
      )}

      {isLoading ? (
        <div className="space-y-2">
          {Array.from({ length: 6 }).map((_, i) => (
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
                <th className="pb-2 font-medium">Status</th>
                <th className="pb-2 font-medium">Joined</th>
              </tr>
            </thead>
            <tbody>
              {tenants.map((t) => (
                <tr key={t.id} className="border-b last:border-0 hover:bg-muted/50">
                  <td className="py-2.5">
                    <Link
                      href={`/dashboard/properties/${t.propertyId}/tenants/${t.id}`}
                      className="font-medium hover:underline"
                    >
                      {t.name}
                    </Link>
                  </td>
                  <td className="py-2.5 font-mono text-muted-foreground">
                    {formatPhone(t.phone)}
                  </td>
                  <td className="py-2.5">
                    <StatusBadge status={t.status} />
                  </td>
                  <td className="py-2.5 text-muted-foreground">
                    {formatDateShort(t.joiningDate)}
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
            href="/dashboard/properties"
            className="mt-2 inline-block text-sm font-medium hover:underline"
          >
            Go to a property to add tenants
          </Link>
        </div>
      )}
    </div>
  )
}
