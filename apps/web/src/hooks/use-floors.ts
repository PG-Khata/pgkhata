"use client"

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query"
import { api } from "@/lib/api-client"
import type { Floor, FloorWithRoomCount } from "@/types"

export function useFloors(propertyId: string) {
  return useQuery({
    queryKey: ["floors", propertyId],
    queryFn: () =>
      api.get<FloorWithRoomCount[]>(`/v1/properties/${propertyId}/floors`),
    enabled: !!propertyId,
  })
}

export function useCreateFloor(propertyId: string) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (data: { name: string; position?: number; description?: string }) =>
      api.post<Floor>(`/v1/properties/${propertyId}/floors`, data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["floors", propertyId] })
      qc.invalidateQueries({ queryKey: ["rooms", propertyId] })
    },
  })
}

export function useUpdateFloor(propertyId: string) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ floorId, ...data }: { floorId: string; name?: string }) =>
      api.put<Floor>(`/v1/properties/${propertyId}/floors/${floorId}`, data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["floors", propertyId] })
      qc.invalidateQueries({ queryKey: ["rooms", propertyId] })
    },
  })
}

export function useDeleteFloor(propertyId: string) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (floorId: string) =>
      api.delete(`/v1/properties/${propertyId}/floors/${floorId}`),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["floors", propertyId] })
      qc.invalidateQueries({ queryKey: ["rooms", propertyId] })
    },
  })
}

export function useReorderFloors(propertyId: string) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (floorIds: string[]) =>
      api.post<Floor[]>(`/v1/properties/${propertyId}/floors/reorder`, { floorIds }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["floors", propertyId] })
      qc.invalidateQueries({ queryKey: ["rooms", propertyId] })
    },
  })
}
