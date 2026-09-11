"use client";

import { keepPreviousData, useQuery } from "@tanstack/react-query";
import { api, buildQuery } from "@/lib/api-client";
import type { AdminTenant } from "@/types";

export const TENANTS_PAGE_SIZE = 25;

export type TenantStatus = "pending" | "active" | "vacating" | "vacated" | "rejected";

export type PoliceVerificationStatus =
  | "pending"
  | "submitted"
  | "verified"
  | "rejected"
  | "not_required";

export interface AdminTenantFilters {
  /** Free text across name, phone and email. */
  q?: string;
  ownerId?: string;
  propertyId?: string;
  status?: TenantStatus;
  policeVerificationStatus?: PoliceVerificationStatus;
  page?: number;
  pageSize?: number;
}

/**
 * One page of the platform-wide tenant list. Rows now carry `roomNumber` and
 * `bedNumber`, so the BED column can show the actual bed rather than the
 * "Unassigned" every tenant used to get from a payload that only had ids.
 */
export function useAdminTenants(filters: AdminTenantFilters = {}) {
  return useQuery({
    queryKey: ["admin", "tenants", "list", filters],
    queryFn: () => api.getPage<AdminTenant>(`/v1/admin/tenants${buildQuery({ ...filters })}`),
    placeholderData: keepPreviousData,
  });
}

export function useAdminTenant(tenantId: string) {
  return useQuery({
    queryKey: ["admin", "tenants", tenantId],
    queryFn: () => api.get<AdminTenant>(`/v1/admin/tenants/${tenantId}`),
    enabled: !!tenantId,
  });
}
