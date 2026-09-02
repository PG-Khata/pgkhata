"use client"

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query"
import { api } from "@/lib/api-client"

interface BedBooking {
  id: string
  bedId: string
  tenantName: string
  tenantPhone: string
  status: "pending" | "confirmed" | "cancelled" | "converted"
  bookingDate: string
  expiryDate?: string | null
  notes?: string | null
  createdAt: string
  updatedAt: string
  bedNumber?: string
  roomNumber?: string
  floorName?: string | null
}

export function useBookings(propertyId: string, status?: string) {
  const params = status ? `?status=${status}` : ""
  return useQuery({
    queryKey: ["bookings", propertyId, status],
    queryFn: () =>
      api.get<BedBooking[]>(`/v1/properties/${propertyId}/bed-bookings${params}`),
    enabled: !!propertyId,
  })
}

export function useCreateBooking(propertyId: string) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (data: {
      bedId: string
      tenantName: string
      tenantPhone: string
      expiryDays?: number
      notes?: string
    }) => api.post<BedBooking>(`/v1/properties/${propertyId}/bed-bookings`, data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["bookings", propertyId] })
      qc.invalidateQueries({ queryKey: ["beds", propertyId] })
      qc.invalidateQueries({ queryKey: ["dashboard"] })
    },
  })
}

export function useCancelBooking(propertyId: string) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (bookingId: string) =>
      api.post(`/v1/properties/${propertyId}/bed-bookings/${bookingId}/cancel`),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["bookings", propertyId] })
      qc.invalidateQueries({ queryKey: ["beds", propertyId] })
      qc.invalidateQueries({ queryKey: ["dashboard"] })
    },
  })
}

export function useConvertBooking(propertyId: string) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (bookingId: string) =>
      api.post(`/v1/properties/${propertyId}/bed-bookings/${bookingId}/convert`),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["bookings", propertyId] })
      qc.invalidateQueries({ queryKey: ["tenants", propertyId] })
      qc.invalidateQueries({ queryKey: ["beds", propertyId] })
      qc.invalidateQueries({ queryKey: ["dashboard"] })
    },
  })
}

export function useUpdateBooking(propertyId: string) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ bookingId, data }: { bookingId: string; data: { tenantName?: string; tenantPhone?: string; notes?: string; expiryDays?: number } }) =>
      api.put(`/v1/properties/${propertyId}/bed-bookings/${bookingId}`, data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["bookings", propertyId] })
    },
  })
}

export function useDeleteBooking(propertyId: string) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (bookingId: string) =>
      api.delete(`/v1/properties/${propertyId}/bed-bookings/${bookingId}`),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["bookings", propertyId] })
      qc.invalidateQueries({ queryKey: ["beds", propertyId] })
      qc.invalidateQueries({ queryKey: ["dashboard"] })
    },
  })
}
