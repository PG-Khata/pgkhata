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

/**
 * Re-derives totalAmount / paidAmount / balance / status from the bill's own
 * line items and payments. It cannot invent a number, so it is safe to expose
 * here — unlike the edit and void mutations it replaces, which wrote those
 * columns raw and skipped the owner routes' recalculation.
 */
export function useRecomputeAdminBill() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (billId: string) => api.post(`/v1/admin/bills/${billId}/recompute`),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["admin", "bills"] });
      qc.invalidateQueries({ queryKey: ["admin", "payments"] });
    },
  });
}
