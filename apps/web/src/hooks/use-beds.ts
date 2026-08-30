"use client"

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query"
import { api } from "@/lib/api-client"
import type { Bed, BedWithLocation } from "@/types"

export function useBeds(propertyId: string) {
  return useQuery({
    queryKey: ["beds", propertyId],
    queryFn: () => api.get<BedWithLocation[]>(`/v1/properties/${propertyId}/beds`),
    enabled: !!propertyId,
  })
}

export function useVacantBeds(propertyId: string) {
  return useQuery({
    queryKey: ["beds", propertyId, "vacant"],
    queryFn: () =>
      api.get<BedWithLocation[]>(`/v1/properties/${propertyId}/beds/vacant`),
    enabled: !!propertyId,
  })
}

/** Invalidates everything a bed change can move: beds, rooms and occupancy. */
function invalidateBedViews(
  qc: ReturnType<typeof useQueryClient>,
  propertyId: string,
) {
  qc.invalidateQueries({ queryKey: ["beds", propertyId] })
  qc.invalidateQueries({ queryKey: ["rooms", propertyId] })
  qc.invalidateQueries({ queryKey: ["dashboard"] })
}

export function useUpdateBedStatus(propertyId: string) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ bedId, status }: { bedId: string; status: Bed["status"] }) =>
      api.patch<Bed>(`/v1/properties/${propertyId}/beds/${bedId}/status`, { status }),
    onSuccess: () => invalidateBedViews(qc, propertyId),
  })
}

export function useUpdateBedRent(propertyId: string) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ bedId, monthlyRent }: { bedId: string; monthlyRent: number | null }) =>
      api.put<Bed>(`/v1/properties/${propertyId}/beds/${bedId}`, { monthlyRent }),
    onSuccess: () => invalidateBedViews(qc, propertyId),
  })
}
