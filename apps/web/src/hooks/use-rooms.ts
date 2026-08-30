"use client"

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query"
import { api } from "@/lib/api-client"
import type { Room } from "@/types"

export function useRooms(propertyId: string) {
  return useQuery({
    queryKey: ["rooms", propertyId],
    queryFn: () => api.get<Room[]>(`/v1/properties/${propertyId}/rooms`),
    enabled: !!propertyId,
  })
}

export function useCreateRoom(propertyId: string) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (data: Partial<Room>) =>
      api.post<Room>(`/v1/properties/${propertyId}/rooms`, data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["rooms", propertyId] })
      qc.invalidateQueries({ queryKey: ["dashboard"] })
    },
  })
}

export function useUpdateRoom(propertyId: string, roomId: string) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (data: Partial<Room>) =>
      api.put<Room>(`/v1/properties/${propertyId}/rooms/${roomId}`, data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["rooms", propertyId] })
      qc.invalidateQueries({ queryKey: ["dashboard"] })
    },
  })
}

export function useDeleteRoom(propertyId: string) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (roomId: string) =>
      api.delete(`/v1/properties/${propertyId}/rooms/${roomId}`),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["rooms", propertyId] })
      qc.invalidateQueries({ queryKey: ["dashboard"] })
    },
  })
}
