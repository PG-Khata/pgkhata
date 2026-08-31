"use client"

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query"
import { api } from "@/lib/api-client"
import type { AdvancePayment, AdvancePaymentWithTenant } from "@/types"

export function useAdvancePayments(propertyId: string) {
  return useQuery({
    queryKey: ["advance-payments", propertyId],
    queryFn: () =>
      api.get<AdvancePaymentWithTenant[]>(`/v1/properties/${propertyId}/advance-payments`),
    enabled: !!propertyId,
  })
}

export function useTenantAdvancePayments(propertyId: string, tenantId: string) {
  return useQuery({
    queryKey: ["advance-payments", propertyId, "tenant", tenantId],
    queryFn: () =>
      api.get<AdvancePayment[]>(
        `/v1/properties/${propertyId}/advance-payments/tenant/${tenantId}`,
      ),
    enabled: !!propertyId && !!tenantId,
  })
}

function invalidate(qc: ReturnType<typeof useQueryClient>, propertyId: string) {
  qc.invalidateQueries({ queryKey: ["advance-payments", propertyId] })
  qc.invalidateQueries({ queryKey: ["bills", propertyId] })
}

export function useCreateAdvancePayment(propertyId: string) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (data: { tenantId: string; amount: number; notes?: string }) =>
      api.post<AdvancePayment>(`/v1/properties/${propertyId}/advance-payments`, data),
    onSuccess: () => invalidate(qc, propertyId),
  })
}

export function useApplyAdvancePayment(propertyId: string) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({
      advanceId,
      ...data
    }: {
      advanceId: string
      billId: string
      amount?: number
    }) =>
      api.post<{ message: string; amountApplied: number }>(
        `/v1/properties/${propertyId}/advance-payments/${advanceId}/apply`,
        data,
      ),
    onSuccess: () => invalidate(qc, propertyId),
  })
}

export function useForfeitAdvancePayment(propertyId: string) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (advanceId: string) =>
      api.post<AdvancePayment>(
        `/v1/properties/${propertyId}/advance-payments/${advanceId}/forfeit`,
      ),
    onSuccess: () => invalidate(qc, propertyId),
  })
}
