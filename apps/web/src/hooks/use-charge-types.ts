"use client"

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query"
import { api } from "@/lib/api-client"
import type { ChargeType } from "@/types"

export function useChargeTypes(propertyId: string) {
  return useQuery({
    queryKey: ["charge-types", propertyId],
    queryFn: () => api.get<ChargeType[]>(`/v1/properties/${propertyId}/charge-types`),
    enabled: !!propertyId,
  })
}

export function useCreateChargeType(propertyId: string) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (data: Partial<ChargeType>) =>
      api.post<ChargeType>(`/v1/properties/${propertyId}/charge-types`, data),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["charge-types", propertyId] }),
  })
}

export function useUpdateChargeType(propertyId: string) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ id, ...data }: Partial<ChargeType> & { id: string }) =>
      api.put<ChargeType>(`/v1/properties/${propertyId}/charge-types/${id}`, data),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["charge-types", propertyId] }),
  })
}

export function useDeleteChargeType(propertyId: string) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (id: string) =>
      api.delete(`/v1/properties/${propertyId}/charge-types/${id}`),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["charge-types", propertyId] }),
  })
}
