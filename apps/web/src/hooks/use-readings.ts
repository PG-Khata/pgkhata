"use client"

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query"
import { api } from "@/lib/api-client"

interface ElectricityReading {
  id: string
  roomId: string
  reading: number
  units: number
  readingDate: string
  createdAt: string
}

interface ReadingWithRoom {
  reading: ElectricityReading
  roomNumber: string
}

export function useReadings(propertyId: string, roomId?: string) {
  const params = roomId ? `?roomId=${roomId}` : ""
  return useQuery({
    queryKey: ["readings", propertyId, roomId],
    queryFn: () => api.get<ReadingWithRoom[]>(`/v1/properties/${propertyId}/readings${params}`),
    enabled: !!propertyId,
  })
}

export function useCreateReading(propertyId: string) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (data: { roomId: string; reading: number; readingDate: string }) =>
      api.post<ElectricityReading>(`/v1/properties/${propertyId}/readings`, data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["readings", propertyId] })
    },
  })
}
