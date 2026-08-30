"use client"

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query"
import { api } from "@/lib/api-client"
import type { RentPlan, RentPlanWithRoomCount } from "@/types"

export function useRentPlans(propertyId: string) {
  return useQuery({
    queryKey: ["rent-plans", propertyId],
    queryFn: () =>
      api.get<RentPlanWithRoomCount[]>(`/v1/properties/${propertyId}/rent-plans`),
    enabled: !!propertyId,
  })
}

export function useCreateRentPlan(propertyId: string) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (data: Partial<RentPlan>) =>
      api.post<RentPlan>(`/v1/properties/${propertyId}/rent-plans`, data),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["rent-plans", propertyId] }),
  })
}

export function useUpdateRentPlan(propertyId: string) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ planId, ...data }: Partial<RentPlan> & { planId: string }) =>
      api.put<RentPlan>(`/v1/properties/${propertyId}/rent-plans/${planId}`, data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["rent-plans", propertyId] })
      qc.invalidateQueries({ queryKey: ["rooms", propertyId] })
    },
  })
}

export function useDeleteRentPlan(propertyId: string) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (planId: string) =>
      api.delete(`/v1/properties/${propertyId}/rent-plans/${planId}`),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["rent-plans", propertyId] }),
  })
}
