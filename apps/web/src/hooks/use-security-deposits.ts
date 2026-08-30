"use client"

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query"
import { api } from "@/lib/api-client"
import type {
  SecurityDeposit,
  SecurityDepositWithTenant,
  DepositLiabilityReport,
} from "@/types"

export function useSecurityDeposits(propertyId: string) {
  return useQuery({
    queryKey: ["security-deposits", propertyId],
    queryFn: () =>
      api.get<SecurityDepositWithTenant[]>(
        `/v1/properties/${propertyId}/security-deposits`,
      ),
    enabled: !!propertyId,
  })
}

export function useDepositLiabilityReport(propertyId: string) {
  return useQuery({
    queryKey: ["security-deposits", propertyId, "liability-report"],
    queryFn: () =>
      api.get<DepositLiabilityReport>(
        `/v1/properties/${propertyId}/security-deposits/liability-report`,
      ),
    enabled: !!propertyId,
  })
}

function invalidate(qc: ReturnType<typeof useQueryClient>, propertyId: string) {
  qc.invalidateQueries({ queryKey: ["security-deposits", propertyId] })
}

export function useCreateSecurityDeposit(propertyId: string) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (data: {
      tenantId: string
      amount: number
      promisedDate?: string
      notes?: string
    }) => api.post<SecurityDeposit>(`/v1/properties/${propertyId}/security-deposits`, data),
    onSuccess: () => invalidate(qc, propertyId),
  })
}

export function useRefundSecurityDeposit(propertyId: string) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({
      depositId,
      ...data
    }: {
      depositId: string
      amount: number
      date?: string
    }) =>
      api.post<SecurityDeposit>(
        `/v1/properties/${propertyId}/security-deposits/${depositId}/refund`,
        data,
      ),
    onSuccess: () => invalidate(qc, propertyId),
  })
}
