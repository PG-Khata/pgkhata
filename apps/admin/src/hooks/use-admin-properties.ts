"use client";

import { keepPreviousData, useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api, buildQuery } from "@/lib/api-client";
import type { AdminProperty } from "@/types";

export const PROPERTIES_PAGE_SIZE = 25;

export interface AdminPropertyFilters {
  /** Free text across name, code and city. */
  q?: string;
  ownerId?: string;
  city?: string;
  electricityMode?: "flat" | "metered";
  /** "Has at least one active tenant" — the same predicate as `activeTenants > 0`. */
  hasTenants?: boolean;
  page?: number;
  pageSize?: number;
}

/**
 * One page of the platform-wide property list. Rows now carry `totalBeds`,
 * `occupiedBeds` and `activeTenants`, which the unbounded version could not
 * afford and which is why the table used to render `0/0` for every property.
 */
export function useAdminProperties(filters: AdminPropertyFilters = {}) {
  return useQuery({
    queryKey: ["admin", "properties", "list", filters],
    queryFn: () => api.getPage<AdminProperty>(`/v1/admin/properties${buildQuery({ ...filters })}`),
    placeholderData: keepPreviousData,
  });
}

export function useAdminProperty(propertyId: string) {
  return useQuery({
    queryKey: ["admin", "properties", propertyId],
    queryFn: () => api.get<AdminProperty>(`/v1/admin/properties/${propertyId}`),
    enabled: !!propertyId,
  });
}

/**
 * Re-derives every bed's status from the tenants actually occupying it. Safe
 * because it reads the tenancy rows rather than accepting a status from the
 * caller — the removed bed PATCH could mark an occupied bed vacant.
 */
export function useReconcilePropertyBeds() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (propertyId: string) =>
      api.post(`/v1/admin/properties/${propertyId}/reconcile-beds`),
    onSuccess: (_data, propertyId) => {
      qc.invalidateQueries({ queryKey: ["admin", "properties"] });
      qc.invalidateQueries({ queryKey: ["admin", "structure", propertyId] });
    },
  });
}

/** Re-derives overdue status on the property's bills from their due dates and ledger. */
export function useReconcilePropertyOverdue() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (propertyId: string) =>
      api.post(`/v1/admin/properties/${propertyId}/reconcile-overdue`),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["admin", "properties"] });
      qc.invalidateQueries({ queryKey: ["admin", "bills"] });
    },
  });
}
