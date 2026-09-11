"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import {
  useAdminBills,
  BILLS_PAGE_SIZE,
  type AdminBillFilters,
} from "@/hooks/use-admin-billing";
import { AdminPagination } from "@/components/admin-pagination";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import { formatCurrency } from "@/lib/utils";
import { Receipt, ExternalLink } from "lucide-react";

const STATUS_COLORS: Record<string, string> = {
  paid: "bg-green-100 text-green-800",
  pending: "bg-yellow-100 text-yellow-800",
  partial: "bg-blue-100 text-blue-800",
  overdue: "bg-red-100 text-red-800",
};

/** Maps a tri-state `<select>` value onto the API's optional boolean. */
function triState(value: string): boolean | undefined {
  return value === "" ? undefined : value === "true";
}

export default function BillingPage() {
  // No free-text box here: a bill has no name, and the list endpoint takes no
  // `q`. Every question support arrives with is one of the exact filters below.
  const [ownerDraft, setOwnerDraft] = useState("");
  const [propertyDraft, setPropertyDraft] = useState("");
  const [tenantDraft, setTenantDraft] = useState("");
  const [committed, setCommitted] = useState({ ownerId: "", propertyId: "", tenantId: "" });
  const [billMonth, setBillMonth] = useState("");
  const [status, setStatus] = useState("");
  const [approved, setApproved] = useState("");
  const [voided, setVoided] = useState("");
  const [hasBalance, setHasBalance] = useState("");
  const [page, setPage] = useState(1);

  useEffect(() => {
    const timer = setTimeout(() => {
      setCommitted({
        ownerId: ownerDraft.trim(),
        propertyId: propertyDraft.trim(),
        tenantId: tenantDraft.trim(),
      });
      setPage(1);
    }, 350);
    return () => clearTimeout(timer);
  }, [ownerDraft, propertyDraft, tenantDraft]);

  const filters: AdminBillFilters = useMemo(
    () => ({
      ownerId: committed.ownerId || undefined,
      propertyId: committed.propertyId || undefined,
      tenantId: committed.tenantId || undefined,
      billMonth: billMonth || undefined,
      status: (status || undefined) as AdminBillFilters["status"],
      approved: triState(approved),
      voided: triState(voided),
      hasBalance: triState(hasBalance),
      page,
      pageSize: BILLS_PAGE_SIZE,
    }),
    [committed, billMonth, status, approved, voided, hasBalance, page],
  );

  const { data, isLoading, isFetching, isError, error } = useAdminBills(filters);
  const bills = data?.rows ?? [];

  const hasFilters =
    !!committed.ownerId ||
    !!committed.propertyId ||
    !!committed.tenantId ||
    !!billMonth ||
    !!status ||
    !!approved ||
    !!voided ||
    !!hasBalance;

  function clearFilters() {
    setOwnerDraft("");
    setPropertyDraft("");
    setTenantDraft("");
    setCommitted({ ownerId: "", propertyId: "", tenantId: "" });
    setBillMonth("");
    setStatus("");
    setApproved("");
    setVoided("");
    setHasBalance("");
    setPage(1);
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-lg font-semibold tracking-tight">Billing</h1>
        <p className="mt-0.5 text-sm text-muted-foreground">All bills across all properties.</p>
      </div>

      <div className="grid gap-3 rounded-xl border bg-card p-3 shadow-xs sm:grid-cols-2 lg:grid-cols-4">
        <div>
          {/* Ids, not dropdowns: there is no options endpoint for owners or
              properties, and a select built from one page would hide the rest. */}
          <label htmlFor="bill-owner" className="mb-1 block text-xs text-muted-foreground">
            Owner ID
          </label>
          <Input
            id="bill-owner"
            placeholder="Paste an owner ID"
            value={ownerDraft}
            onChange={(e) => setOwnerDraft(e.target.value)}
            className="font-mono"
          />
        </div>

        <div>
          <label htmlFor="bill-property" className="mb-1 block text-xs text-muted-foreground">
            Property ID
          </label>
          <Input
            id="bill-property"
            placeholder="Paste a property ID"
            value={propertyDraft}
            onChange={(e) => setPropertyDraft(e.target.value)}
            className="font-mono"
          />
        </div>

        <div>
          <label htmlFor="bill-tenant" className="mb-1 block text-xs text-muted-foreground">
            Tenant ID
          </label>
          <Input
            id="bill-tenant"
            placeholder="Paste a tenant ID"
            value={tenantDraft}
            onChange={(e) => setTenantDraft(e.target.value)}
            className="font-mono"
          />
        </div>

        <div>
          <label htmlFor="bill-month" className="mb-1 block text-xs text-muted-foreground">
            Bill month
          </label>
          <Input
            id="bill-month"
            type="month"
            value={billMonth}
            onChange={(e) => {
              setBillMonth(e.target.value);
              setPage(1);
            }}
          />
        </div>

        <div>
          <label htmlFor="bill-status" className="mb-1 block text-xs text-muted-foreground">
            Status
          </label>
          <select
            id="bill-status"
            value={status}
            onChange={(e) => {
              setStatus(e.target.value);
              setPage(1);
            }}
            className="h-9 w-full rounded-lg border border-input bg-background px-2.5 text-sm"
          >
            <option value="">All status</option>
            <option value="pending">Pending</option>
            <option value="partial">Partial</option>
            <option value="paid">Paid</option>
            <option value="overdue">Overdue</option>
          </select>
        </div>

        <div>
          <label htmlFor="bill-approved" className="mb-1 block text-xs text-muted-foreground">
            Approval
          </label>
          <select
            id="bill-approved"
            value={approved}
            onChange={(e) => {
              setApproved(e.target.value);
              setPage(1);
            }}
            className="h-9 w-full rounded-lg border border-input bg-background px-2.5 text-sm"
          >
            <option value="">Any</option>
            <option value="true">Approved</option>
            <option value="false">Not approved</option>
          </select>
        </div>

        <div>
          <label htmlFor="bill-voided" className="mb-1 block text-xs text-muted-foreground">
            Voided
          </label>
          <select
            id="bill-voided"
            value={voided}
            onChange={(e) => {
              setVoided(e.target.value);
              setPage(1);
            }}
            className="h-9 w-full rounded-lg border border-input bg-background px-2.5 text-sm"
          >
            <option value="">Any</option>
            <option value="false">Not voided</option>
            <option value="true">Voided</option>
          </select>
        </div>

        <div className="flex items-end gap-2">
          <div className="flex-1">
            <label htmlFor="bill-balance" className="mb-1 block text-xs text-muted-foreground">
              Balance
            </label>
            <select
              id="bill-balance"
              value={hasBalance}
              onChange={(e) => {
                setHasBalance(e.target.value);
                setPage(1);
              }}
              className="h-9 w-full rounded-lg border border-input bg-background px-2.5 text-sm"
            >
              <option value="">Any</option>
              <option value="true">Outstanding</option>
              <option value="false">Settled</option>
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
            {error instanceof Error ? error.message : "Could not load bills."}
          </p>
        </div>
      ) : bills.length > 0 ? (
        <div
          className={`rounded-xl border bg-card shadow-xs overflow-x-auto${isFetching ? " opacity-60 transition-opacity" : ""}`}
        >
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b bg-muted/50 text-left text-xs text-muted-foreground">
                <th className="px-4 py-3 font-medium">TENANT</th>
                <th className="px-4 py-3 font-medium">MONTH</th>
                <th className="px-4 py-3 font-medium">TOTAL</th>
                <th className="px-4 py-3 font-medium">PAID</th>
                <th className="px-4 py-3 font-medium">BALANCE</th>
                <th className="px-4 py-3 font-medium">STATUS</th>
                <th className="px-4 py-3 font-medium"></th>
              </tr>
            </thead>
            <tbody>
              {bills.map((b) => (
                <tr key={b.id} className="border-b last:border-0 hover:bg-muted/30">
                  <td className="px-4 py-3">
                    <p className="font-medium">{b.tenantName || "-"}</p>
                    <p className="text-xs text-muted-foreground">{b.propertyName || ""}</p>
                  </td>
                  <td className="px-4 py-3 font-mono text-muted-foreground">{b.billMonth}</td>
                  <td className="px-4 py-3 font-mono">{formatCurrency(b.totalAmount)}</td>
                  <td className="px-4 py-3 font-mono text-green-700">{formatCurrency(b.paidAmount)}</td>
                  <td className="px-4 py-3 font-mono">{formatCurrency(b.balance)}</td>
                  <td className="px-4 py-3">
                    <Badge className={STATUS_COLORS[b.status] ?? "bg-gray-100 text-gray-800"} variant="secondary">
                      {b.voidedAt ? "voided" : b.status}
                    </Badge>
                  </td>
                  <td className="px-4 py-3">
                    <Link href={`/dashboard/billing/${b.id}`}>
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
          <Receipt className="mx-auto h-10 w-10 text-muted-foreground/30" />
          <p className="mt-3 text-sm font-medium text-muted-foreground">
            {hasFilters ? "No bills match these filters" : "No bills yet"}
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
        noun="bills"
      />
    </div>
  );
}
