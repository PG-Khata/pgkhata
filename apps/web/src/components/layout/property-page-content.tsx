"use client"

import { useState } from "react"
import { usePathname } from "next/navigation"
import { Building2, Plus } from "lucide-react"
import { useSelectedProperty } from "./property-context"
import { AddPropertyModal } from "@/components/dashboard/add-property-modal"

/**
 * Account pages stay reachable before the first property exists — an owner
 * still needs to edit their profile and sign out.
 */
const PROPERTY_OPTIONAL_ROUTES = ["/dashboard/profile", "/dashboard/settings"]

/**
 * Property-scoped pages keep local filters, forms, and query state. Keying the
 * content by the header selection deliberately remounts the current page when
 * an owner changes PG, so no controls can retain data from the prior property.
 *
 * A new owner has no property yet, so every scoped page would render an empty
 * shell. Send them to create one instead.
 */
export function PropertyPageContent({ children }: { children: React.ReactNode }) {
  const { selectedProperty, properties, isLoading } = useSelectedProperty()
  const pathname = usePathname()
  const [addOpen, setAddOpen] = useState(false)

  const needsFirstProperty =
    !isLoading &&
    properties.length === 0 &&
    !PROPERTY_OPTIONAL_ROUTES.some((route) => pathname.startsWith(route))

  if (needsFirstProperty) {
    return (
      <>
        <div className="rounded-xl border border-dashed bg-background p-10 text-center">
          <Building2 className="mx-auto h-10 w-10 text-muted-foreground/40" />
          <p className="mt-4 text-base font-semibold">Add your first PG</p>
          <p className="mx-auto mt-2 max-w-sm text-sm text-muted-foreground">
            Set up a property to start adding rooms and beds, onboarding tenants,
            and generating monthly bills.
          </p>
          <button
            onClick={() => setAddOpen(true)}
            className="mt-6 inline-flex items-center gap-1.5 rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90"
          >
            <Plus className="h-4 w-4" />
            Add property
          </button>
        </div>
        <AddPropertyModal open={addOpen} onOpenChange={setAddOpen} />
      </>
    )
  }

  return <div key={selectedProperty?.id ?? "all-properties"}>{children}</div>
}
