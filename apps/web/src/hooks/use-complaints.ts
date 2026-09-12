"use client"

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query"
import { api } from "@/lib/api-client"
import type { Complaint } from "@/types"

export function useComplaints(propertyId: string) {
  return useQuery({
    queryKey: ["complaints", propertyId],
    queryFn: () => api.get<Complaint[]>(`/v1/properties/${propertyId}/complaints`),
    enabled: !!propertyId,
    refetchInterval: 30000, // Refresh periodically; 30s balances freshness and load.
    refetchIntervalInBackground: false,
  })
}

export function useUpdateComplaintStatus(propertyId: string) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ complaintId, status }: { complaintId: string; status: string }) =>
      api.patch(`/v1/properties/${propertyId}/complaints/${complaintId}`, { status }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["complaints", propertyId] })
    },
  })
}
