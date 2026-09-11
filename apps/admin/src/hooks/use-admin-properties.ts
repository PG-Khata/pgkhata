"use client";

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/api-client";
import type { AdminProperty } from "@/types";

export function useAdminProperties() {
  return useQuery({
    queryKey: ["admin", "properties"],
    queryFn: () => api.get<AdminProperty[]>("/v1/admin/properties"),
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
