"use client"

import { useQuery } from "@tanstack/react-query"
import { api } from "@/lib/api-client"
import { useProperties } from "@/hooks/use-properties"
import { StatusBadge } from "@/components/dashboard/status-badge"
import { Skeleton } from "@/components/ui/skeleton"
import { formatDate } from "@/lib/utils"
import type { Complaint } from "@/types"
import { useState } from "react"

export default function ComplaintsPage() {
  const { data: properties } = useProperties()
  const [selectedProperty, setSelectedProperty] = useState("")

  // Complaints are fetched per-property from the API
  // For now, show a placeholder since the API doesn't have a list endpoint for complaints
  // The complaints are submitted via public links

  return (
    <div className="space-y-6">
      <h1 className="text-lg font-semibold">Complaints</h1>

      <div className="rounded-md border border-dashed p-8 text-center">
        <p className="text-sm text-muted-foreground">
          Complaints are submitted by tenants via public links.
        </p>
        <p className="mt-1 text-xs text-muted-foreground">
          Share the complaint link from your property settings to receive tenant complaints.
        </p>
      </div>
    </div>
  )
}
