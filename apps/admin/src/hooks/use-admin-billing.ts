"use client";

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/api-client";
import type { AdminBill } from "@/types";

export function useAdminBills() {
  return useQuery({
    queryKey: ["admin", "bills"],
    queryFn: () => api.get<AdminBill[]>("/v1/admin/bills"),
  });
}

export function useAdminBill(billId: string) {
  return useQuery({
    queryKey: ["admin", "bills", billId],
    queryFn: () => api.get<AdminBill>(`/v1/admin/bills/${billId}`),
    enabled: !!billId,
  });
}

export function useUpdateAdminBill(billId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data: Record<string, unknown>) =>
      api.patch(`/v1/admin/bills/${billId}`, data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["admin", "bills"] });
    },
  });
}

export function useVoidAdminBill() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (billId: string) =>
      api.post(`/v1/admin/bills/${billId}/void`),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["admin", "bills"] });
    },
  });
}
