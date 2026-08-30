"use client"

import { useQuery } from "@tanstack/react-query"
import { api } from "@/lib/api-client"
import type { OwnerDashboard, PropertyDashboard } from "@/types"

export function useOwnerDashboard() {
  return useQuery({
    queryKey: ["dashboard", "owner"],
    queryFn: () => api.get<OwnerDashboard>("/v1/dashboard/owner"),
  })
}

export function usePropertyDashboard(propertyId: string) {
  return useQuery({
    queryKey: ["dashboard", "property", propertyId],
    queryFn: () => api.get<PropertyDashboard>(`/v1/dashboard/property/${propertyId}`),
    enabled: !!propertyId,
  })
}
