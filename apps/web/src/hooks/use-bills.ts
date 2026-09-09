"use client"

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query"
import { api } from "@/lib/api-client"
import type { Bill } from "@/types"

export type BillListItem = Bill & {
  tenantName: string
  roomNumber: string
}

export function useBills(propertyId: string, month?: string) {
  const params = month ? `?month=${month}` : ""
  return useQuery({
    queryKey: ["bills", propertyId, month],
    queryFn: () => api.get<BillListItem[]>(`/v1/properties/${propertyId}/bills${params}`),
    enabled: !!propertyId,
  })
}

export function useGenerateBills(propertyId: string) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (data: { month: string; tenantId?: string }) =>
      api.post<{ message: string; bills: Bill[] }>(
        `/v1/properties/${propertyId}/bills/generate`,
        data,
      ),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["bills", propertyId] }),
  })
}

export type MeterPreflight = { complete: boolean; missingRooms: Array<{ roomId: string; roomNumber: string; tenants: Array<{ id: string; name: string }>; latestReading: { reading: number; readingDate: string } | null }> }

export function useBillingPreflight(propertyId: string) {
  return useMutation({ mutationFn: (data: { month: string; tenantId?: string }) =>
    api.get<MeterPreflight>(`/v1/properties/${propertyId}/bills/preflight?month=${data.month}${data.tenantId ? `&tenantId=${data.tenantId}` : ""}`) })
}

export function useSaveReadingBatch(propertyId: string) {
  return useMutation({ mutationFn: (readings: Array<{ roomId: string; reading: number; readingDate: string }>) =>
    api.post(`/v1/properties/${propertyId}/readings/batch`, { readings }) })
}

export function useDeliverBill(propertyId: string) {
  return useMutation({ mutationFn: ({ billId, channels }: { billId: string; channels: Array<"email" | "whatsapp"> }) =>
    api.post<{ results: Array<{ channel: string; status: string; reason?: string }> }>(`/v1/properties/${propertyId}/bills/${billId}/deliver`, { channels }) })
}

export function useShareBill(propertyId: string) {
  return useMutation({ mutationFn: (billId: string) => api.get<{ url: string; message: string }>(`/v1/properties/${propertyId}/bills/${billId}/share-link`) })
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

export function useDeleteBill(propertyId: string) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (billId: string) =>
      api.delete(`/v1/properties/${propertyId}/bills/${billId}`),
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
