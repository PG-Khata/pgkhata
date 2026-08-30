"use client"

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query"
import { api } from "@/lib/api-client"
import type { Tenant } from "@/types"

export function useTenants(propertyId: string, status?: string) {
  const params = status ? `?status=${status}` : ""
  return useQuery({
    queryKey: ["tenants", propertyId, status],
    queryFn: () => api.get<Tenant[]>(`/v1/properties/${propertyId}/tenants${params}`),
    enabled: !!propertyId,
  })
}

export function useTenant(propertyId: string, tenantId: string) {
  return useQuery({
    queryKey: ["tenants", propertyId, tenantId],
    queryFn: () => api.get<Tenant>(`/v1/properties/${propertyId}/tenants/${tenantId}`),
    enabled: !!propertyId && !!tenantId,
  })
}

export function useCreateTenant(propertyId: string) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (data: Partial<Tenant>) =>
      api.post<Tenant>(`/v1/properties/${propertyId}/tenants`, data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["tenants", propertyId] })
      qc.invalidateQueries({ queryKey: ["dashboard"] })
    },
  })
}

export function useUpdateTenant(propertyId: string, tenantId: string) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (data: Partial<Tenant>) =>
      api.put<Tenant>(`/v1/properties/${propertyId}/tenants/${tenantId}`, data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["tenants", propertyId] })
      qc.invalidateQueries({ queryKey: ["dashboard"] })
    },
  })
}

export function useDeleteTenant(propertyId: string) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (tenantId: string) =>
      api.delete(`/v1/properties/${propertyId}/tenants/${tenantId}`),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["tenants", propertyId] })
      qc.invalidateQueries({ queryKey: ["dashboard"] })
    },
  })
}
