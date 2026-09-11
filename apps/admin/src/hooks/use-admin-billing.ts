"use client";

import { keepPreviousData, useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api, buildQuery } from "@/lib/api-client";
import type { AdminBill } from "@/types";

export const BILLS_PAGE_SIZE = 25;

export type BillStatus = "pending" | "partial" | "paid" | "overdue";

export interface AdminBillFilters {
  ownerId?: string;
  propertyId?: string;
  tenantId?: string;
  /** `YYYY-MM`. */
  billMonth?: string;
  status?: BillStatus;
  /**
   * Tri-state: omitted means "either". `voided` and `hasBalance` are derived
   * server-side from `voidedAt` and `balance`, not from `status` — a voided
   * bill keeps whatever status it had.
   */
  approved?: boolean;
  voided?: boolean;
  hasBalance?: boolean;
  page?: number;
  pageSize?: number;
}

/**
 * One page of the platform-wide bill list. There is no free-text search
 * because a bill has no name; everything here is an exact match.
 */
export function useAdminBills(filters: AdminBillFilters = {}) {
  return useQuery({
    queryKey: ["admin", "bills", "list", filters],
    queryFn: () => api.getPage<AdminBill>(`/v1/admin/bills${buildQuery({ ...filters })}`),
    placeholderData: keepPreviousData,
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
