"use client"

import { useSelectedProperty } from "./property-context"

/**
 * Property-scoped pages keep local filters, forms, and query state. Keying the
 * content by the header selection deliberately remounts the current page when
 * an owner changes PG, so no controls can retain data from the prior property.
 */
export function PropertyPageContent({ children }: { children: React.ReactNode }) {
  const { selectedProperty } = useSelectedProperty()

  return <div key={selectedProperty?.id ?? "all-properties"}>{children}</div>
}
