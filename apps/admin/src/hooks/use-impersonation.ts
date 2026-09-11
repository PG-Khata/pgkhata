"use client";

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/api-client";

export interface ImpersonationSessionRow {
  id: string;
  adminUserId: string;
  adminName: string | null;
  targetOwnerId: string;
  reason: string;
  mode: "read_only" | "read_write";
  startedAt: string;
  expiresAt: string;
  endedAt: string | null;
  endedReason: string | null;
}

const SESSIONS_KEY = ["admin", "impersonation", "sessions"];

/**
 * Starts a read-only support session and hands off to the owner app.
 *
 * There is no client-side token any more: the server returns a one-time URL and
 * the browser simply follows it. Nothing is stored in localStorage, and the
 * admin origin holds no impersonation state at all.
 */
export function useStartImpersonation() {
  return useMutation({
    mutationFn: ({ ownerId, reason }: { ownerId: string; reason: string }) =>
      api.post<{ sessionId: string; ownerName: string; redirectUrl: string }>(
        `/v1/admin/owners/${ownerId}/impersonate`,
        { reason },
      ),
  });
}

export function useImpersonationSessions() {
  return useQuery({
    queryKey: SESSIONS_KEY,
    queryFn: () => api.get<ImpersonationSessionRow[]>("/v1/admin/impersonation/sessions"),
    refetchInterval: 60_000,
  });
}

export function useEndImpersonationSession() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (sessionId: string) =>
      api.post(`/v1/admin/impersonation/sessions/${sessionId}/end`),
    onSuccess: () => qc.invalidateQueries({ queryKey: SESSIONS_KEY }),
  });
}

export function useEndAllImpersonations() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: () => api.post<{ ended: number }>("/v1/admin/impersonation/end-all"),
    onSuccess: () => qc.invalidateQueries({ queryKey: SESSIONS_KEY }),
  });
}
