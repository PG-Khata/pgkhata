"use client";

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/api-client";
import type { AdminTenant } from "@/types";

export function useAdminTenants() {
  return useQuery({
    queryKey: ["admin", "tenants"],
    queryFn: () => api.get<AdminTenant[]>("/v1/admin/tenants"),
  });
}

export function useAdminTenant(tenantId: string) {
  return useQuery({
    queryKey: ["admin", "tenants", tenantId],
    queryFn: () => api.get<AdminTenant>(`/v1/admin/tenants/${tenantId}`),
    enabled: !!tenantId,
  });
}

export function useUpdateAdminTenant(tenantId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data: Record<string, unknown>) =>
      api.put(`/v1/admin/tenants/${tenantId}`, data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["admin", "tenants"] });
    },
  });
}

export function useApproveAdminTenant() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (tenantId: string) =>
      api.post(`/v1/admin/tenants/${tenantId}/approve`),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["admin", "tenants"] });
    },
  });
}

export function useRejectAdminTenant() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (tenantId: string) =>
      api.post(`/v1/admin/tenants/${tenantId}/reject`),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["admin", "tenants"] });
    },
  });
}
