"use client"

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import { api } from "@/lib/api-client"
import type { BillingPolicy } from "@/types"

export function useBillingPolicy(propertyId: string) {
  return useQuery({
    queryKey: ["billing-policy", propertyId],
    queryFn: () => api.get<BillingPolicy>(`/v1/properties/${propertyId}/billing-policy`),
    enabled: !!propertyId,
  })
}

export function useUpdateBillingPolicy(propertyId: string) {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (data: Partial<Pick<BillingPolicy, "rentCycleMode" | "electricityMode" | "electricityRatePerUnit" | "flatElectricityAmount">>) =>
      api.put<BillingPolicy>(`/v1/properties/${propertyId}/billing-policy`, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["billing-policy", propertyId] })
      queryClient.invalidateQueries({ queryKey: ["properties", propertyId] })
      queryClient.invalidateQueries({ queryKey: ["properties"] })
    },
  })
}
