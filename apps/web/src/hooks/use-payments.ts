"use client"

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query"
import { api } from "@/lib/api-client"
import type { Payment, PaymentWithDetails } from "@/types"

type PaymentInput = { billId: string; amount: number; paymentDate: string; method?: string; notes?: string }
type InFlightPayment = { idempotencyKey: string; requestCount: number }

const inFlightPaymentKeys = new Map<string, InFlightPayment>()
const requestPaymentKeys = new WeakMap<PaymentInput, { fingerprint: string; idempotencyKey: string }>()

function paymentFingerprint(data: PaymentInput) {
  return JSON.stringify([data.billId, data.amount, data.paymentDate, data.method ?? null, data.notes ?? null])
}

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
    mutationFn: (data: PaymentInput) => {
      const existingRequest = requestPaymentKeys.get(data)
      if (existingRequest) {
        return api.post<Payment>(`/v1/properties/${propertyId}/payments`, {
          ...data,
          idempotencyKey: existingRequest.idempotencyKey,
        })
      }

      const fingerprint = paymentFingerprint(data)
      const inFlight = inFlightPaymentKeys.get(fingerprint)
      const idempotencyKey = inFlight?.idempotencyKey ?? crypto.randomUUID()
      inFlightPaymentKeys.set(fingerprint, {
        idempotencyKey,
        requestCount: (inFlight?.requestCount ?? 0) + 1,
      })
      requestPaymentKeys.set(data, { fingerprint, idempotencyKey })
      return api.post<Payment>(`/v1/properties/${propertyId}/payments`, {
        ...data,
        idempotencyKey,
      })
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["payments", propertyId] })
      qc.invalidateQueries({ queryKey: ["bills", propertyId] })
      qc.invalidateQueries({ queryKey: ["dashboard"] })
    },
    onSettled: (_data, _error, variables) => {
      const request = requestPaymentKeys.get(variables)
      if (!request) return

      requestPaymentKeys.delete(variables)
      const inFlight = inFlightPaymentKeys.get(request.fingerprint)
      if (!inFlight || inFlight.requestCount <= 1) {
        inFlightPaymentKeys.delete(request.fingerprint)
      } else {
        inFlightPaymentKeys.set(request.fingerprint, {
          ...inFlight,
          requestCount: inFlight.requestCount - 1,
        })
      }
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
