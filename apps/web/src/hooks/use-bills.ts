"use client"

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query"
import { api } from "@/lib/api-client"
import type { Bill, BillWithDetails } from "@/types"

export function useBills(propertyId: string, month?: string) {
  const params = month ? `?month=${month}` : ""
  return useQuery({
    queryKey: ["bills", propertyId, month],
    queryFn: () => api.get<any[]>(`/v1/properties/${propertyId}/bills${params}`),
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

export function useApplyLateFees(propertyId: string) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (billIds?: string[]) =>
      api.post<{ message: string; updated: number }>(
        `/v1/properties/${propertyId}/bills/apply-late-fees`,
        billIds ? { billIds } : {},
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

export function useVoidBill(propertyId: string) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (billId: string) =>
      api.post<{ message: string; bill: Bill }>(
        `/v1/properties/${propertyId}/bills/${billId}/void`,
      ),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["bills", propertyId] }),
  })
}

export function useSetPromisedDate(propertyId: string) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ billId, promisedDate }: { billId: string; promisedDate: string | null }) =>
      api.patch<{ message: string; bill: Bill }>(
        `/v1/properties/${propertyId}/bills/${billId}/promised-date`,
        { promisedDate },
      ),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["bills", propertyId] }),
  })
}
