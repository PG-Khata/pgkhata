"use client"

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query"
import { api } from "@/lib/api-client"

/** Shape returned by GET /v1/profile — owner profile joined with the user record. */
export interface OwnerAccount {
  id: string
  phone: string | null
  name: string
  email: string
  emailVerified: boolean
  createdAt: string
}

export function useOwnerProfile() {
  return useQuery({
    queryKey: ["owner-profile"],
    queryFn: () => api.get<OwnerAccount>("/v1/profile"),
  })
}

export function useUpdateOwnerProfile() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (data: { phone: string | null }) =>
      api.patch<OwnerAccount>("/v1/profile", data),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["owner-profile"] }),
  })
}
