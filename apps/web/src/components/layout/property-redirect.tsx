"use client"

import { useEffect } from "react"
import { useParams, useRouter } from "next/navigation"
import { useSelectedProperty } from "./property-context"

/**
 * Redirects a legacy per-property URL to its global, dropdown-scoped equivalent.
 * The PG in the URL becomes the selected PG so the destination shows the same
 * property the old link pointed at.
 */
export function PropertyRedirect({ to }: { to: string }) {
  const params = useParams()
  const router = useRouter()
  const { selectPropertyById } = useSelectedProperty()
  const propertyId = params.propertyId as string | undefined

  useEffect(() => {
    if (propertyId) selectPropertyById(propertyId)
    router.replace(to)
  }, [propertyId, to, router, selectPropertyById])

  return null
}
