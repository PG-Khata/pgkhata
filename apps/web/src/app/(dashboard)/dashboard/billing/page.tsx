"use client"

import Link from "next/link"
import { useProperties } from "@/hooks/use-properties"
import { Skeleton } from "@/components/ui/skeleton"

export default function BillingPage() {
  const { data: properties, isLoading } = useProperties()

  return (
    <div className="space-y-6">
      <h1 className="text-lg font-semibold">Billing</h1>

      {isLoading ? (
        <div className="space-y-2">
          {Array.from({ length: 3 }).map((_, i) => (
            <Skeleton key={i} className="h-12 w-full" />
          ))}
        </div>
      ) : properties && properties.length > 0 ? (
        <div className="space-y-2">
          <p className="text-sm text-muted-foreground">
            Select a property to manage billing.
          </p>
          {properties.map((p) => (
            <Link
              key={p.id}
              href={`/dashboard/properties/${p.id}/billing`}
              className="flex items-center justify-between rounded-md border p-3 hover:bg-muted/50"
            >
              <span className="text-sm font-medium">{p.name}</span>
              <span className="text-xs text-muted-foreground">View bills</span>
            </Link>
          ))}
        </div>
      ) : (
        <div className="rounded-md border border-dashed p-8 text-center">
          <p className="text-sm text-muted-foreground">No properties yet.</p>
          <Link
            href="/dashboard/properties/new"
            className="mt-2 inline-block text-sm font-medium hover:underline"
          >
            Add a property first
          </Link>
        </div>
      )}
    </div>
  )
}
