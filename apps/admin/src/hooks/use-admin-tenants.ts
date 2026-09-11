"use client";

import { useQuery } from "@tanstack/react-query";
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

