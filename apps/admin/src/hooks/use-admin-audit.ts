"use client";

import { keepPreviousData, useQuery } from "@tanstack/react-query";
import { api } from "@/lib/api-client";

/** One append-only row of the admin audit log. */
export interface AuditLogRow {
  id: string;
  createdAt: string;
  action: string;
  adminEmail: string | null;
  adminUserId: string | null;
  ownerId: string | null;
  entityType: string | null;
  entityId: string | null;
  method: string | null;
  path: string | null;
  statusCode: number | null;
  reason: string | null;
  /** Set when the change was made while acting as an owner. */
  impersonationSessionId: string | null;
  ipAddress: string | null;
}

/** The single-row endpoint additionally returns the snapshots. */
export interface AuditLogEntry extends AuditLogRow {
  before: unknown;
  after: unknown;
}

export interface AuditLogFilters {
  ownerId?: string;
  adminUserId?: string;
  /** Prefix match, e.g. `owner.` or `bill.void`. */
  action?: string;
  entityType?: string;
  /** ISO timestamps. */
  from?: string;
  to?: string;
  page?: number;
  pageSize?: number;
}

function toQueryString(filters: AuditLogFilters): string {
  const params = new URLSearchParams();
  for (const [key, value] of Object.entries(filters)) {
    if (value === undefined || value === null || value === "") continue;
    params.set(key, String(value));
  }
  const qs = params.toString();
  return qs ? `?${qs}` : "";
}

/**
 * `GET /v1/admin/audit` paginates through the `X-Page` / `X-Has-More` response
 * headers, but `api.get()` only ever resolves the parsed JSON body — headers
 * are not exposed and `lib/api-client.ts` is owned elsewhere. So callers get
 * the rows and decide "is there a next page?" from the row count instead
 * (see `hasMore` on the audit page). A full last page shows a Next button that
 * may land on an empty page; that is the honest cost of not reading the header.
 */
export function useAuditLog(filters: AuditLogFilters) {
  return useQuery({
    queryKey: ["admin", "audit", filters],
    queryFn: () => api.get<AuditLogRow[]>(`/v1/admin/audit${toQueryString(filters)}`),
    placeholderData: keepPreviousData,
  });
}

/** Full row including `before` / `after`. Only fetched while a row is open. */
export function useAuditLogEntry(auditId: string | null) {
  return useQuery({
    queryKey: ["admin", "audit", "entry", auditId],
    queryFn: () => api.get<AuditLogEntry>(`/v1/admin/audit/${auditId}`),
    enabled: !!auditId,
    staleTime: Infinity,
  });
}
