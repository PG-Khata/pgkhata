"use client"

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query"
import { api } from "@/lib/api-client"
import type { Complaint } from "@/types"

export function useComplaints(propertyId: string) {
  return useQuery({
    queryKey: ["complaints", propertyId],
    queryFn: () => api.get<Complaint[]>(`/v1/properties/${propertyId}/complaints`),
    enabled: !!propertyId,
    refetchInterval: 5000, // Refetch every 5 seconds for real-time updates
    refetchIntervalInBackground: true,
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
