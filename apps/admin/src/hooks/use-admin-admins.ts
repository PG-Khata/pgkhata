"use client";

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/api-client";
import type { PlatformAdminRole } from "@/components/admin-session";

export interface PlatformAdminRow {
  id: string;
  userId: string;
  role: PlatformAdminRole;
  isActive: boolean;
  notes: string | null;
  lastLoginAt: string | null;
  createdAt: string;
  name: string | null;
  email: string | null;
  /** A protected root admin: the API refuses any change to this row. */
  isRoot: boolean;
}

const KEY = ["admin", "admins"];

export function useAdminAdmins() {
  return useQuery({
    queryKey: KEY,
    queryFn: () => api.get<PlatformAdminRow[]>("/v1/admin/admins"),
  });
}

export function useCreateAdmin() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data: { email: string; role: PlatformAdminRole; notes?: string }) =>
      api.post<PlatformAdminRow>("/v1/admin/admins", data),
    onSuccess: () => qc.invalidateQueries({ queryKey: KEY }),
  });
}

export function useUpdateAdmin() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({
      adminId,
      ...data
    }: {
      adminId: string;
      role?: PlatformAdminRole;
      isActive?: boolean;
      notes?: string | null;
    }) => api.patch<PlatformAdminRow>(`/v1/admin/admins/${adminId}`, data),
    onSuccess: () => qc.invalidateQueries({ queryKey: KEY }),
  });
}

export function useRemoveAdmin() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (adminId: string) => api.delete(`/v1/admin/admins/${adminId}`),
    onSuccess: () => qc.invalidateQueries({ queryKey: KEY }),
  });
}
