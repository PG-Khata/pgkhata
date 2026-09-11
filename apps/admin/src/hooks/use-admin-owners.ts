"use client";

import { keepPreviousData, useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api, buildQuery } from "@/lib/api-client";
import type { AdminOwner } from "@/types";

export const OWNERS_PAGE_SIZE = 25;

export interface AdminOwnerFilters {
  /** Free text across name, email and phone. */
  q?: string;
  /** Inclusive `YYYY-MM-DD` bounds on the signup date. */
  createdFrom?: string;
  createdTo?: string;
  /** Signup order; the API allows no other sort column. */
  order?: "asc" | "desc";
  page?: number;
  pageSize?: number;
}

/**
 * One page of the platform-wide owner list.
 *
 * `keepPreviousData` is what stops the table blanking to a skeleton on every
 * keystroke and page step — the previous page stays on screen, dimmed by the
 * caller, until the next one lands.
 */
export function useAdminOwners(filters: AdminOwnerFilters = {}) {
  return useQuery({
    // "list" segment keeps this under the ["admin","owners"] prefix the
    // mutations below invalidate, without colliding with the by-id key.
    queryKey: ["admin", "owners", "list", filters],
    queryFn: () => api.getPage<AdminOwner>(`/v1/admin/owners${buildQuery({ ...filters })}`),
    placeholderData: keepPreviousData,
  });
}

export function useAdminOwner(ownerId: string) {
  return useQuery({
    queryKey: ["admin", "owners", ownerId],
    queryFn: () => api.get<AdminOwner>(`/v1/admin/owners/${ownerId}`),
    enabled: !!ownerId,
  });
}

export function useUpdateAdminOwner(ownerId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data: Record<string, unknown>) =>
      api.put(`/v1/admin/owners/${ownerId}`, data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["admin", "owners"] });
    },
  });
}

export function useDeleteAdminOwner() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (ownerId: string) =>
      api.delete(`/v1/admin/owners/${ownerId}`),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["admin", "owners"] });
    },
  });
}
