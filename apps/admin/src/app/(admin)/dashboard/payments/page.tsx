"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import {
  useAdminPayments,
  PAYMENTS_PAGE_SIZE,
  type AdminPaymentFilters,
} from "@/hooks/use-admin-payments";
import { AdminPagination } from "@/components/admin-pagination";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { CreditCard, ArrowRight, LifeBuoy } from "lucide-react";
import { formatCurrency } from "@/lib/utils";

/** Blank and unparseable both mean "no bound", never 0 — 0 would exclude nothing but says something. */
function amountBound(draft: string): number | undefined {
  const trimmed = draft.trim();
  if (!trimmed) return undefined;
  const value = Number(trimmed);
  return Number.isFinite(value) && value >= 0 ? Math.trunc(value) : undefined;
}

export default function PaymentsPage() {
  // The list endpoint takes no free-text `q` (a payment has no name), so the
  // old tenant-name box is replaced by the filters the API actually honours.
  const [ownerDraft, setOwnerDraft] = useState("");
  const [propertyDraft, setPropertyDraft] = useState("");
  const [minDraft, setMinDraft] = useState("");
  const [maxDraft, setMaxDraft] = useState("");
  const [committed, setCommitted] = useState({ ownerId: "", propertyId: "", min: "", max: "" });
  const [method, setMethod] = useState("");
  const [paidFrom, setPaidFrom] = useState("");
  const [paidTo, setPaidTo] = useState("");
  const [page, setPage] = useState(1);

  useEffect(() => {
    const timer = setTimeout(() => {
      setCommitted({
        ownerId: ownerDraft.trim(),
        propertyId: propertyDraft.trim(),
        min: minDraft.trim(),
        max: maxDraft.trim(),
      });
      setPage(1);
    }, 350);
    return () => clearTimeout(timer);
  }, [ownerDraft, propertyDraft, minDraft, maxDraft]);

  const filters: AdminPaymentFilters = useMemo(
    () => ({
      method: (method || undefined) as AdminPaymentFilters["method"],
      paidFrom: paidFrom || undefined,
      paidTo: paidTo || undefined,
      ownerId: committed.ownerId || undefined,
      propertyId: committed.propertyId || undefined,
      amountMin: amountBound(committed.min),
      amountMax: amountBound(committed.max),
      page,
      pageSize: PAYMENTS_PAGE_SIZE,
    }),
    [method, paidFrom, paidTo, committed, page],
  );

  const { data, isLoading, isFetching, isError, error } = useAdminPayments(filters);
  const payments = data?.rows ?? [];

  const hasFilters =
    !!method ||
    !!paidFrom ||
    !!paidTo ||
    !!committed.ownerId ||
    !!committed.propertyId ||
    !!committed.min ||
    !!committed.max;

  function clearFilters() {
    setOwnerDraft("");
    setPropertyDraft("");
    setMinDraft("");
    setMaxDraft("");
    setCommitted({ ownerId: "", propertyId: "", min: "", max: "" });
    setMethod("");
    setPaidFrom("");
    setPaidTo("");
    setPage(1);
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-lg font-semibold tracking-tight">Payments</h1>
        <p className="mt-0.5 text-sm text-muted-foreground">All payments across all properties. Read-only.</p>
      </div>

      <div className="rounded-xl border border-dashed bg-muted/30 p-4">
        <div className="flex items-start gap-2.5">
          <LifeBuoy className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground" />
          <div className="text-sm">
            <p className="font-medium">Corrections happen in the owner&apos;s account</p>
            <p className="mt-0.5 text-muted-foreground">
              Editing or deleting a payment here left the parent bill&apos;s paid amount and balance
              untouched, so both controls are gone. Open a support session on the owner and correct
              the payment there — that recomputes the bill and is audit-logged.
            </p>
            <Link
              href="/dashboard/owners"
              className="mt-2 inline-flex items-center font-medium text-foreground hover:underline"
            >
              Find the owner
              <ArrowRight className="ml-1 h-3.5 w-3.5" />
            </Link>
          </div>
        </div>
      </div>

      <div className="grid gap-3 rounded-xl border bg-card p-3 shadow-xs sm:grid-cols-2 lg:grid-cols-3">
        <div>
          <label htmlFor="payment-method" className="mb-1 block text-xs text-muted-foreground">
            Method
          </label>
          <select
            id="payment-method"
            value={method}
            onChange={(e) => {
              setMethod(e.target.value);
              setPage(1);
            }}
            className="h-9 w-full rounded-lg border border-input bg-background px-2.5 text-sm"
          >
            <option value="">Any method</option>
            <option value="cash">Cash</option>
            <option value="upi">UPI</option>
            <option value="bank_transfer">Bank transfer</option>
            <option value="advance">Advance</option>
            <option value="other">Other</option>
          </select>
        </div>

        <div className="grid grid-cols-2 gap-2">
          <div>
            <label htmlFor="payment-from" className="mb-1 block text-xs text-muted-foreground">
              Paid from
            </label>
            <Input
              id="payment-from"
              type="date"
              value={paidFrom}
              max={paidTo || undefined}
              onChange={(e) => {
                setPaidFrom(e.target.value);
                setPage(1);
              }}
            />
          </div>
          <div>
            <label htmlFor="payment-to" className="mb-1 block text-xs text-muted-foreground">
              Paid to
            </label>
            <Input
              id="payment-to"
              type="date"
              value={paidTo}
              min={paidFrom || undefined}
              onChange={(e) => {
                setPaidTo(e.target.value);
                setPage(1);
              }}
            />
          </div>
        </div>

        <div className="grid grid-cols-2 gap-2">
          <div>
            <label htmlFor="payment-min" className="mb-1 block text-xs text-muted-foreground">
              Min amount
            </label>
            <Input
              id="payment-min"
              type="number"
              min={0}
              inputMode="numeric"
              placeholder="0"
              value={minDraft}
              onChange={(e) => setMinDraft(e.target.value)}
            />
          </div>
          <div>
            <label htmlFor="payment-max" className="mb-1 block text-xs text-muted-foreground">
              Max amount
            </label>
            <Input
              id="payment-max"
              type="number"
              min={0}
              inputMode="numeric"
              placeholder="Any"
              value={maxDraft}
              onChange={(e) => setMaxDraft(e.target.value)}
            />
          </div>
        </div>

        <div>
          {/* Ids, not dropdowns: there is no options endpoint, and a select built
              from one page of owners/properties would hide the rest. */}
          <label htmlFor="payment-owner" className="mb-1 block text-xs text-muted-foreground">
            Owner ID
          </label>
          <Input
            id="payment-owner"
            placeholder="Paste an owner ID"
            value={ownerDraft}
            onChange={(e) => setOwnerDraft(e.target.value)}
            className="font-mono"
          />
        </div>

        <div>
          <label htmlFor="payment-property" className="mb-1 block text-xs text-muted-foreground">
            Property ID
          </label>
          <Input
            id="payment-property"
            placeholder="Paste a property ID"
            value={propertyDraft}
            onChange={(e) => setPropertyDraft(e.target.value)}
            className="font-mono"
          />
        </div>

        <div className="flex items-end">
          <Button variant="outline" onClick={clearFilters} disabled={!hasFilters}>
            Clear filters
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
        // The API answers 400 on an inverted date or amount range rather than an
        // empty page; showing that beats an empty table the admin would misread.
        <div className="rounded-xl border border-dashed p-12 text-center">
          <p className="text-sm text-destructive">
            {error instanceof Error ? error.message : "Could not load payments."}
          </p>
        </div>
      ) : payments.length > 0 ? (
        <div
          className={`rounded-xl border bg-card shadow-xs overflow-x-auto${isFetching ? " opacity-60 transition-opacity" : ""}`}
        >
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b bg-muted/50 text-left text-xs text-muted-foreground">
                <th className="px-4 py-3 font-medium">TENANT</th>
                <th className="px-4 py-3 font-medium">BILL MONTH</th>
                <th className="px-4 py-3 font-medium">AMOUNT</th>
                <th className="px-4 py-3 font-medium">METHOD</th>
                <th className="px-4 py-3 font-medium">DATE</th>
              </tr>
            </thead>
            <tbody>
              {payments.map((p) => (
                <tr key={p.id} className="border-b last:border-0 hover:bg-muted/30">
                  <td className="px-4 py-3 font-medium">{p.tenantName || "-"}</td>
                  <td className="px-4 py-3 font-mono text-muted-foreground">{p.billMonth || "-"}</td>
                  <td className="px-4 py-3 font-mono text-green-700">{formatCurrency(p.amount)}</td>
                  <td className="px-4 py-3 text-muted-foreground capitalize">{p.method || "-"}</td>
                  <td className="px-4 py-3 text-muted-foreground">
                    {new Date(p.paymentDate).toLocaleDateString("en-IN")}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <div className="rounded-xl border border-dashed p-12 text-center">
          <CreditCard className="mx-auto h-10 w-10 text-muted-foreground/30" />
          <p className="mt-3 text-sm font-medium text-muted-foreground">
            {hasFilters ? "No payments match these filters" : "No payments yet"}
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
        noun="payments"
      />
    </div>
  );
}
