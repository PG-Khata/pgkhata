"use client";

import { keepPreviousData, useQuery } from "@tanstack/react-query";
import { api, buildQuery } from "@/lib/api-client";
import type { AdminPayment } from "@/types";

export const PAYMENTS_PAGE_SIZE = 25;

export type PaymentMethod = "cash" | "upi" | "bank_transfer" | "advance" | "other";

export interface AdminPaymentFilters {
  method?: PaymentMethod;
  /**
   * Inclusive `YYYY-MM-DD` bounds on `paymentDate` — when the money changed
   * hands, not when someone typed it in.
   */
  paidFrom?: string;
  paidTo?: string;
  ownerId?: string;
  propertyId?: string;
  amountMin?: number;
  amountMax?: number;
  page?: number;
  pageSize?: number;
}

/**
 * One page of the platform-wide payment list.
 *
 * The API answers 400 on an inverted date or amount range rather than an empty
 * page, so callers should surface the error instead of rendering "no results".
 */
export function useAdminPayments(filters: AdminPaymentFilters = {}) {
  return useQuery({
    queryKey: ["admin", "payments", "list", filters],
    queryFn: () => api.getPage<AdminPayment>(`/v1/admin/payments${buildQuery({ ...filters })}`),
    placeholderData: keepPreviousData,
  });
}
