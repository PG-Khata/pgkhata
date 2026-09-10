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

export function useUpdateAdminProperty(propertyId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data: Record<string, unknown>) =>
      api.put(`/v1/admin/properties/${propertyId}`, data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["admin", "properties"] });
    },
  });
}
