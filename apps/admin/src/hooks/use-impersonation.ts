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
    retry: false,
  });
}

export function useImpersonate() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (ownerId: string) => {
      const result = await api.post<{ token: string; ownerName: string }>(
        `/v1/admin/owners/${ownerId}/impersonate`,
      );
      if (result.token) {
        localStorage.setItem("impersonate_token", result.token);
        localStorage.setItem("impersonate_owner_id", ownerId);
      }
      return result;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["admin", "impersonation"] });
    },
  });
}

export function useExitImpersonation() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async () => {
      await api.post("/v1/admin/impersonate/exit");
      localStorage.removeItem("impersonate_token");
      localStorage.removeItem("impersonate_owner_id");
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["admin", "impersonation"] });
    },
  });
}

export function getImpersonationHeaders(): Record<string, string> {
  const token = typeof window !== "undefined" ? localStorage.getItem("impersonate_token") : null;
  const ownerId = typeof window !== "undefined" ? localStorage.getItem("impersonate_owner_id") : null;
  if (token && ownerId) {
    return {
      "x-impersonate-token": token,
      "x-impersonate-owner": ownerId,
    };
  }
  return {};
}
