"use client"

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query"
import { api } from "@/lib/api-client"
import type { Bill, BillWithDetails } from "@/types"

export function useBills(propertyId: string, month?: string) {
  const params = month ? `?month=${month}` : ""
  return useQuery({
    queryKey: ["bills", propertyId, month],
    queryFn: () => api.get<BillWithDetails[]>(`/v1/properties/${propertyId}/bills${params}`),
    enabled: !!propertyId,
  })
}

export function useGenerateBills(propertyId: string) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (month: string) =>
      api.post<{ message: string; bills: Bill[] }>(
        `/v1/properties/${propertyId}/bills/generate`,
        { month },
      ),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["bills", propertyId] }),
  })
}

export function useApproveBills(propertyId: string) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (billIds: string[]) =>
      api.post<{ message: string; bills: Bill[] }>(
        `/v1/properties/${propertyId}/bills/approve`,
        { billIds },
      ),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["bills", propertyId] }),
  })
}
