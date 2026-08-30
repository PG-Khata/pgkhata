"use client"

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query"
import { api } from "@/lib/api-client"
import type { Property } from "@/types"

export function useProperties() {
  return useQuery({
    queryKey: ["properties"],
    queryFn: () => api.get<Property[]>("/v1/properties"),
  })
}

export function useProperty(id: string) {
  return useQuery({
    queryKey: ["properties", id],
    queryFn: () => api.get<Property>(`/v1/properties/${id}`),
    enabled: !!id,
  })
}

export function useCreateProperty() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (data: Partial<Property>) => api.post<Property>("/v1/properties", data),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["properties"] }),
  })
}

export function useUpdateProperty(id: string) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (data: Partial<Property>) => api.put<Property>(`/v1/properties/${id}`, data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["properties"] })
      qc.invalidateQueries({ queryKey: ["properties", id] })
    },
  })
}

export function useDeleteProperty() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (id: string) => api.delete(`/v1/properties/${id}`),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["properties"] }),
  })
}
