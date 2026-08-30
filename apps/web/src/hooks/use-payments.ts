"use client"

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query"
import { api } from "@/lib/api-client"
import type { Payment, PaymentWithDetails } from "@/types"

export function usePayments(propertyId: string) {
  return useQuery({
    queryKey: ["payments", propertyId],
    queryFn: () => api.get<PaymentWithDetails[]>(`/v1/properties/${propertyId}/payments`),
    enabled: !!propertyId,
  })
}

export function useRecordPayment(propertyId: string) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (data: { billId: string; amount: number; paymentDate: string; method?: string; notes?: string }) =>
      api.post<Payment>(`/v1/properties/${propertyId}/payments`, data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["payments", propertyId] })
      qc.invalidateQueries({ queryKey: ["bills", propertyId] })
      qc.invalidateQueries({ queryKey: ["dashboard"] })
    },
  })
}

export function useDeletePayment(propertyId: string) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (paymentId: string) =>
      api.delete(`/v1/properties/${propertyId}/payments/${paymentId}`),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["payments", propertyId] })
      qc.invalidateQueries({ queryKey: ["bills", propertyId] })
      qc.invalidateQueries({ queryKey: ["dashboard"] })
    },
  })
}
