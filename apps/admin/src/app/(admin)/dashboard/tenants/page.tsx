"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import {
  useAdminTenants,
  TENANTS_PAGE_SIZE,
  type AdminTenantFilters,
} from "@/hooks/use-admin-tenants";
import { AdminPagination } from "@/components/admin-pagination";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import { Search, Users, ExternalLink } from "lucide-react";
import type { AdminTenant } from "@/types";

/**
 * The list endpoint now joins `room` and `bed`, so an assigned tenant shows the
 * actual bed instead of the "Unassigned" every row used to get from a payload
 * that only carried ids. The `bedId` branch survives as the honest middle case:
 * the tenant demonstrably holds a bed whose number we were not given.
 */
function bedLabel(t: AdminTenant): string {
  if (t.bedNumber) return t.roomNumber ? `${t.roomNumber}-${t.bedNumber}` : t.bedNumber;
  if (t.bedId) return "Assigned";
  return "Unassigned";
}

const STATUS_COLORS: Record<string, string> = {
  active: "bg-green-100 text-green-800",
  pending: "bg-yellow-100 text-yellow-800",
  vacated: "bg-gray-100 text-gray-800",
  vacating: "bg-orange-100 text-orange-800",
  rejected: "bg-red-100 text-red-800",
};

export default function TenantsPage() {
  const [searchDraft, setSearchDraft] = useState("");
  const [ownerDraft, setOwnerDraft] = useState("");
  const [propertyDraft, setPropertyDraft] = useState("");
  const [committed, setCommitted] = useState({ q: "", ownerId: "", propertyId: "" });
  const [status, setStatus] = useState("");
  const [pvStatus, setPvStatus] = useState("");
  const [page, setPage] = useState(1);

  useEffect(() => {
    const timer = setTimeout(() => {
      setCommitted({
        q: searchDraft.trim(),
        ownerId: ownerDraft.trim(),
        propertyId: propertyDraft.trim(),
      });
      setPage(1);
    }, 350);
    return () => clearTimeout(timer);
  }, [searchDraft, ownerDraft, propertyDraft]);

  const filters: AdminTenantFilters = useMemo(
    () => ({
      q: committed.q || undefined,
      ownerId: committed.ownerId || undefined,
      propertyId: committed.propertyId || undefined,
      status: (status || undefined) as AdminTenantFilters["status"],
      policeVerificationStatus: (pvStatus ||
        undefined) as AdminTenantFilters["policeVerificationStatus"],
      page,
      pageSize: TENANTS_PAGE_SIZE,
    }),
    [committed, status, pvStatus, page],
  );

  const { data, isLoading, isFetching, isError, error } = useAdminTenants(filters);
  const tenants = data?.rows ?? [];

  const hasFilters =
    !!committed.q || !!committed.ownerId || !!committed.propertyId || !!status || !!pvStatus;

  function clearFilters() {
    setSearchDraft("");
    setOwnerDraft("");
    setPropertyDraft("");
    setCommitted({ q: "", ownerId: "", propertyId: "" });
    setStatus("");
    setPvStatus("");
    setPage(1);
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-lg font-semibold tracking-tight">Tenants</h1>
        <p className="mt-0.5 text-sm text-muted-foreground">All tenants across all properties.</p>
      </div>

      <div className="grid gap-3 rounded-xl border bg-card p-3 shadow-xs sm:grid-cols-2 lg:grid-cols-3">
        <div className="lg:col-span-2">
          <label htmlFor="tenant-q" className="mb-1 block text-xs text-muted-foreground">
            Search
          </label>
          <div className="relative">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              id="tenant-q"
              placeholder="Name, phone, or email..."
              value={searchDraft}
              onChange={(e) => setSearchDraft(e.target.value)}
              className="pl-9"
            />
          </div>
        </div>

        <div>
          <label htmlFor="tenant-status" className="mb-1 block text-xs text-muted-foreground">
            Status
          </label>
          <select
            id="tenant-status"
            value={status}
            onChange={(e) => {
              setStatus(e.target.value);
              setPage(1);
            }}
            className="h-9 w-full rounded-lg border border-input bg-background px-2.5 text-sm"
          >
            <option value="">All status</option>
            <option value="active">Active</option>
            <option value="pending">Pending</option>
            <option value="vacating">Vacating</option>
            <option value="vacated">Vacated</option>
            <option value="rejected">Rejected</option>
          </select>
        </div>

        <div>
          {/* Ids rather than dropdowns: there is no options endpoint, and a select
              built from one page of owners/properties would hide the rest. */}
          <label htmlFor="tenant-owner" className="mb-1 block text-xs text-muted-foreground">
            Owner ID
          </label>
          <Input
            id="tenant-owner"
            placeholder="Paste an owner ID"
            value={ownerDraft}
            onChange={(e) => setOwnerDraft(e.target.value)}
            className="font-mono"
          />
        </div>

        <div>
          <label htmlFor="tenant-property" className="mb-1 block text-xs text-muted-foreground">
            Property ID
          </label>
          <Input
            id="tenant-property"
            placeholder="Paste a property ID"
            value={propertyDraft}
            onChange={(e) => setPropertyDraft(e.target.value)}
            className="font-mono"
          />
        </div>

        <div className="flex items-end gap-2">
          <div className="flex-1">
            <label htmlFor="tenant-pv" className="mb-1 block text-xs text-muted-foreground">
              Police verification
            </label>
            <select
              id="tenant-pv"
              value={pvStatus}
              onChange={(e) => {
                setPvStatus(e.target.value);
                setPage(1);
              }}
              className="h-9 w-full rounded-lg border border-input bg-background px-2.5 text-sm"
            >
              <option value="">Any</option>
              <option value="pending">Pending</option>
              <option value="submitted">Submitted</option>
              <option value="verified">Verified</option>
              <option value="rejected">Rejected</option>
              <option value="not_required">Not required</option>
            </select>
          </div>
          <Button variant="outline" onClick={clearFilters} disabled={!hasFilters}>
            Clear
          </Button>
        </div>
      </div>

      {isLoading ? (
        <div className="space-y-2">
          {Array.from({ length: 6 }).map((_, i) => (
            <Skeleton key={i} className="h-16 w-full rounded-xl" />
          ))}
        </div>
      ) : isError ? (
        <div className="rounded-xl border border-dashed p-12 text-center">
          <p className="text-sm text-destructive">
            {error instanceof Error ? error.message : "Could not load tenants."}
          </p>
        </div>
      ) : tenants.length > 0 ? (
        <div
          className={`rounded-xl border bg-card shadow-xs overflow-x-auto${isFetching ? " opacity-60 transition-opacity" : ""}`}
        >
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b bg-muted/50 text-left text-xs text-muted-foreground">
                <th className="px-4 py-3 font-medium">TENANT</th>
                <th className="px-4 py-3 font-medium">PROPERTY</th>
                <th className="px-4 py-3 font-medium">BED</th>
                <th className="px-4 py-3 font-medium">STATUS</th>
                <th className="px-4 py-3 font-medium">JOINED</th>
                <th className="px-4 py-3 font-medium"></th>
              </tr>
            </thead>
            <tbody>
              {tenants.map((t) => (
                <tr key={t.id} className="border-b last:border-0 hover:bg-muted/30">
                  <td className="px-4 py-3">
                    <p className="font-medium">{t.name}</p>
                    <p className="text-xs text-muted-foreground font-mono">{t.phone}</p>
                  </td>
                  <td className="px-4 py-3 text-muted-foreground">{t.propertyName || "-"}</td>
                  <td className="px-4 py-3 text-muted-foreground">{bedLabel(t)}</td>
                  <td className="px-4 py-3">
                    <Badge className={STATUS_COLORS[t.status] ?? "bg-gray-100 text-gray-800"} variant="secondary">
                      {t.status}
                    </Badge>
                  </td>
                  <td className="px-4 py-3 text-muted-foreground">
                    {new Date(t.joiningDate).toLocaleDateString("en-IN")}
                  </td>
                  <td className="px-4 py-3">
                    <Link href={`/dashboard/tenants/${t.id}`}>
                      <Button variant="outline" size="sm">View <ExternalLink className="ml-1.5 h-3 w-3" /></Button>
                    </Link>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <div className="rounded-xl border border-dashed p-12 text-center">
          <Users className="mx-auto h-10 w-10 text-muted-foreground/30" />
          <p className="mt-3 text-sm font-medium text-muted-foreground">
            {hasFilters ? "No tenants match these filters" : "No tenants yet"}
          </p>
          {hasFilters && (
            <Button variant="ghost" size="sm" className="mt-3" onClick={clearFilters}>
              Clear filters
            </Button>
          )}
        </div>
      )}

      <AdminPagination
        page={data}
        currentPage={page}
        onPageChange={setPage}
        isFetching={isFetching}
        noun="tenants"
      />
    </div>
  );
}
