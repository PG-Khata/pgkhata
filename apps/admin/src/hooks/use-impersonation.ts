"use client";

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/api-client";

interface ImpersonationStatus {
  impersonating: boolean;
  ownerId?: string;
  ownerName?: string;
}

export function useImpersonationStatus() {
  return useQuery({
    queryKey: ["admin", "impersonation"],
    queryFn: () => api.get<ImpersonationStatus>("/v1/admin/impersonate/status"),
    refetchInterval: 30_000,
  });
}

export function useImpersonate() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (ownerId: string) =>
      api.post<{ ownerName: string }>(`/v1/admin/owners/${ownerId}/impersonate`),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["admin", "impersonation"] });
    },
  });
}

export function useExitImpersonation() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: () => api.post("/v1/admin/impersonate/exit"),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["admin", "impersonation"] });
    },
  });
}
