"use client"

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query"
import { api } from "@/lib/api-client"

export interface ImpersonationStatus {
  active: boolean
  adminName?: string
  ownerName?: string
  mode?: "read_only" | "read_write"
  canWrite?: boolean
  reason?: string
  expiresAt?: string
  writeExpiresAt?: string | null
  absoluteExpiresAt?: string
}

export interface SupportVisit {
  id: string
  adminName: string
  reason: string
  mode: "read_only" | "read_write"
  writeReason: string | null
  writeGrantedAt: string | null
  startedAt: string
  endedAt: string | null
}

const STATUS_KEY = ["impersonation-status"]

/**
 * Polls rather than reading a cached profile field, because the banner has to
 * reflect expiry and read-only/write transitions while the page sits open.
 */
export function useImpersonationStatus() {
  return useQuery({
    queryKey: STATUS_KEY,
    queryFn: () => api.get<ImpersonationStatus>("/v1/impersonation/status"),
    refetchInterval: 60_000,
    retry: false,
    // A genuine owner gets `active: false`; there is nothing to refetch on focus.
    refetchOnWindowFocus: true,
  })
}

export function useEscalateImpersonation() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (reason: string) =>
      api.post<{ mode: string; writeExpiresAt: string }>("/v1/impersonation/escalate", { reason }),
    onSuccess: () => qc.invalidateQueries({ queryKey: STATUS_KEY }),
  })
}

export function useExtendImpersonation() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: () => api.post<{ expiresAt: string }>("/v1/impersonation/extend"),
    onSuccess: () => qc.invalidateQueries({ queryKey: STATUS_KEY }),
  })
}

export function useExitImpersonation() {
  return useMutation({
    mutationFn: () => api.post<{ ok: boolean; returnUrl: string }>("/v1/impersonation/exit"),
  })
}

/** The owner's own log of every support visit to their account. */
export function useSupportHistory(enabled = true) {
  return useQuery({
    queryKey: ["impersonation-history"],
    queryFn: () => api.get<SupportVisit[]>("/v1/impersonation/history"),
    retry: false,
    enabled,
  })
}
