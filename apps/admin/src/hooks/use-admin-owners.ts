"use client";

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/api-client";
import type { AdminOwner } from "@/types";

export function useAdminOwners() {
  return useQuery({
    queryKey: ["admin", "owners"],
    queryFn: () => api.get<AdminOwner[]>("/v1/admin/owners"),
  });
}

export function useAdminOwner(ownerId: string) {
  return useQuery({
    queryKey: ["admin", "owners", ownerId],
    queryFn: () => api.get<AdminOwner & { properties: Record<string, unknown>[] }>(`/v1/admin/owners/${ownerId}`),
    enabled: !!ownerId,
  });
}

export function useUpdateAdminOwner(ownerId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data: Record<string, unknown>) =>
      api.put(`/v1/admin/owners/${ownerId}`, data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["admin", "owners"] });
    },
  });
}

export function useDeleteAdminOwner() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (ownerId: string) =>
      api.delete(`/v1/admin/owners/${ownerId}`),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["admin", "owners"] });
    },
  });
}
