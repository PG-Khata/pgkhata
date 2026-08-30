"use client"

import { useQuery } from "@tanstack/react-query"
import { api } from "@/lib/api-client"
import type {
  OwnerDashboard,
  PropertyDashboard,
  MonthlyTrendPoint,
  DueRentRow,
  AgingReport,
} from "@/types"

export function useOwnerDashboard() {
  return useQuery({
    queryKey: ["dashboard", "owner"],
    queryFn: () => api.get<OwnerDashboard>("/v1/dashboard/owner"),
  })
}

export function usePropertyDashboard(propertyId: string) {
  return useQuery({
    queryKey: ["dashboard", "property", propertyId],
    queryFn: () => api.get<PropertyDashboard>(`/v1/dashboard/property/${propertyId}`),
    enabled: !!propertyId,
  })
}

export function useMonthlyTrend(propertyId: string) {
  return useQuery({
    queryKey: ["dashboard", "property", propertyId, "monthly-trend"],
    queryFn: () =>
      api.get<MonthlyTrendPoint[]>(`/v1/dashboard/property/${propertyId}/monthly-trend`),
    enabled: !!propertyId,
  })
}

export function useDueRent(propertyId: string) {
  return useQuery({
    queryKey: ["dashboard", "property", propertyId, "due-rent"],
    queryFn: () => api.get<DueRentRow[]>(`/v1/dashboard/property/${propertyId}/due-rent`),
    enabled: !!propertyId,
  })
}

export function useOutstandingAging(propertyId: string) {
  return useQuery({
    queryKey: ["dashboard", "property", propertyId, "outstanding-payment"],
    queryFn: () =>
      api.get<AgingReport>(`/v1/dashboard/property/${propertyId}/outstanding-payment`),
    enabled: !!propertyId,
  })
}
