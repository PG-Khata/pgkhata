"use client"

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query"
import { api } from "@/lib/api-client"

interface Notification {
  id: string
  propertyId: string
  type: string
  title: string
  message: string
  read: boolean
  link?: string | null
  createdAt: string
}

export function useNotifications(propertyId?: string) {
  const params = propertyId ? `?propertyId=${propertyId}` : ""
  return useQuery({
    queryKey: ["notifications", propertyId],
    queryFn: () => api.get<Notification[]>(`/v1/notifications${params}`),
    refetchInterval: 30000,
  })
}

export function useUnreadCount(propertyId?: string) {
  const params = propertyId ? `?propertyId=${propertyId}` : ""
  return useQuery({
    queryKey: ["notifications", "unread-count", propertyId],
    queryFn: () => api.get<{ count: number }>(`/v1/notifications/unread-count${params}`),
    refetchInterval: 30000,
  })
}

export function useMarkAsRead() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (notificationId: string) =>
      api.put(`/v1/notifications/${notificationId}/read`),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["notifications"] })
    },
  })
}

export function useMarkAllAsRead() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (propertyId?: string) =>
      api.post("/v1/notifications/mark-all-read", propertyId ? { propertyId } : {}),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["notifications"] })
    },
  })
}
