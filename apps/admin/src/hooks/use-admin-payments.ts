"use client";

import { useQuery } from "@tanstack/react-query";
import { api } from "@/lib/api-client";
import type { AdminPayment } from "@/types";

export function useAdminPayments() {
  return useQuery({
    queryKey: ["admin", "payments"],
    queryFn: () => api.get<AdminPayment[]>("/v1/admin/payments"),
  });
}
