"use client";

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/api-client";
import type { AdminPayment } from "@/types";

export function useAdminPayments() {
  return useQuery({
    queryKey: ["admin", "payments"],
    queryFn: () => api.get<AdminPayment[]>("/v1/admin/payments"),
  });
}

export function useUpdateAdminPayment(paymentId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data: Record<string, unknown>) =>
      api.put(`/v1/admin/payments/${paymentId}`, data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["admin", "payments"] });
    },
  });
}

export function useDeleteAdminPayment() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (paymentId: string) =>
      api.delete(`/v1/admin/payments/${paymentId}`),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["admin", "payments"] });
    },
  });
}
