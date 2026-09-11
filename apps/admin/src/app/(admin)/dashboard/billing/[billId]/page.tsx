"use client";

import { use } from "react";
import Link from "next/link";
import { useAdminBill, useRecomputeAdminBill } from "@/hooks/use-admin-billing";
import { useAdminTenant } from "@/hooks/use-admin-tenants";
import { useAdminProperty } from "@/hooks/use-admin-properties";
import { useAdminSession } from "@/components/admin-session";
import { api } from "@/lib/api-client";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import { ArrowLeft, ArrowRight, RefreshCw, CreditCard, List, LifeBuoy } from "lucide-react";
import { toast } from "sonner";
import { useQuery } from "@tanstack/react-query";
import { formatCurrency } from "@/lib/utils";


interface BillDetailWithRelations {
  id: string;
  billMonth: string;
  totalAmount: number;
  paidAmount: number;
  balance: number;
  status: string;
  approved: boolean;
  voidedAt: string | null;
  createdAt: string;
  lineItems: Array<{ code: string; name: string; amount: number }>;
  payments: Array<{
    id: string;
    amount: number;
    paymentDate: string;
    method: string | null;
    notes: string | null;
  }>;
}

export default function BillDetailPage({ params }: { params: Promise<{ billId: string }> }) {
  const { billId } = use(params);
  const { role } = useAdminSession();
  const { data: bill, isLoading } = useAdminBill(billId);
  const recompute = useRecomputeAdminBill();

  // The bill payload carries no ownerId, so walk tenant -> property to find the
  // owner whose account the support session has to be opened on.
  const { data: billTenant } = useAdminTenant(bill?.tenantId ?? "");
  const { data: billProperty } = useAdminProperty(billTenant?.propertyId ?? "");

  const { data: details, isLoading: detailsLoading } = useQuery({
    queryKey: ["admin", "bills", billId, "details"],
    queryFn: () => api.get<BillDetailWithRelations>(`/v1/admin/bills/${billId}/details`),
    enabled: !!billId,
  });

  if (isLoading || detailsLoading) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-8 w-32" />
        <Skeleton className="h-40 rounded-xl" />
      </div>
    );
  }

  if (!bill) {
    return (
      <div className="space-y-6">
        <Link href="/dashboard/billing" className="inline-flex items-center text-sm text-muted-foreground hover:text-foreground">
          <ArrowLeft className="mr-1 h-4 w-4" /> Back to Billing
        </Link>
        <p className="text-sm text-muted-foreground">Bill not found.</p>
      </div>
    );
  }

  function handleRecompute() {
    recompute.mutate(billId, {
      onSuccess: () => toast.success("Totals recomputed from line items and payments"),
      onError: (err) => toast.error(err instanceof Error ? err.message : "Failed"),
    });
  }

  const lineItems = details?.lineItems ?? bill.lineItems ?? [];
  const payments = details?.payments ?? [];
  const ownerHref = billProperty?.ownerId
    ? `/dashboard/owners/${billProperty.ownerId}`
    : "/dashboard/owners";

  return (
    <div className="space-y-6">
      <Link href="/dashboard/billing" className="inline-flex items-center text-sm text-muted-foreground hover:text-foreground">
        <ArrowLeft className="mr-1 h-4 w-4" /> Back to Billing
      </Link>

      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-lg font-semibold tracking-tight">Bill — {bill.billMonth}</h1>
          <p className="mt-0.5 text-sm text-muted-foreground">{bill.tenantName || "Unknown Tenant"}</p>
        </div>
        {role === "super_admin" && (
          <Button variant="outline" onClick={handleRecompute} disabled={recompute.isPending}>
            <RefreshCw className={`mr-1.5 h-4 w-4 ${recompute.isPending ? "animate-spin" : ""}`} />
            Recompute totals
          </Button>
        )}
      </div>

      <div className="rounded-xl border border-dashed bg-muted/30 p-4">
        <div className="flex items-start gap-2.5">
          <LifeBuoy className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground" />
          <div className="text-sm">
            <p className="font-medium">Edits and voids happen in the owner&apos;s account</p>
            <p className="mt-0.5 text-muted-foreground">
              The admin-side edit and void wrote amounts and status directly without recomputing the
              bill. Open a support session on the owner instead — that runs the owner&apos;s own
              billing routes and is audit-logged.
            </p>
            <Link
              href={ownerHref}
              className="mt-2 inline-flex items-center font-medium text-foreground hover:underline"
            >
              {billProperty?.ownerName ? `Open ${billProperty.ownerName}` : "Open owner"}
              <ArrowRight className="ml-1 h-3.5 w-3.5" />
            </Link>
          </div>
        </div>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <div className="rounded-xl border bg-card p-5 shadow-xs">
          <p className="text-xs text-muted-foreground">Total</p>
          <p className="text-xl font-semibold font-mono">{formatCurrency(bill.totalAmount)}</p>
        </div>
        <div className="rounded-xl border bg-card p-5 shadow-xs">
          <p className="text-xs text-muted-foreground">Paid</p>
          <p className="text-xl font-semibold font-mono text-green-700">{formatCurrency(bill.paidAmount)}</p>
        </div>
        <div className="rounded-xl border bg-card p-5 shadow-xs">
          <p className="text-xs text-muted-foreground">Balance</p>
          <p className="text-xl font-semibold font-mono">{formatCurrency(bill.balance)}</p>
        </div>
        <div className="rounded-xl border bg-card p-5 shadow-xs">
          <p className="text-xs text-muted-foreground">Status</p>
          <Badge variant="secondary" className="mt-1">{bill.voidedAt ? "Voided" : bill.status}</Badge>
        </div>
      </div>

      {/* Line Items */}
      {lineItems.length > 0 && (
        <div className="rounded-xl border bg-card p-5 shadow-xs">
          <div className="flex items-center gap-2 mb-4">
            <List className="h-4 w-4 text-muted-foreground" />
            <h2 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground">Line Items</h2>
          </div>
          <div className="rounded-lg border overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b bg-muted/50 text-left text-xs text-muted-foreground">
                  <th className="px-4 py-3 font-medium">ITEM</th>
                  <th className="px-4 py-3 font-medium">CODE</th>
                  <th className="px-4 py-3 font-medium text-right">AMOUNT</th>
                </tr>
              </thead>
              <tbody>
                {lineItems.map((item, idx) => (
                  <tr key={idx} className="border-b last:border-0 hover:bg-muted/30">
                    <td className="px-4 py-3 font-medium">{item.name}</td>
                    <td className="px-4 py-3 font-mono text-muted-foreground">{item.code}</td>
                    <td className="px-4 py-3 font-mono text-right">{formatCurrency(item.amount)}</td>
                  </tr>
                ))}
              </tbody>
              <tfoot>
                <tr className="border-t bg-muted/30 font-medium">
                  <td className="px-4 py-3" colSpan={2}>Total</td>
                  <td className="px-4 py-3 font-mono text-right">{formatCurrency(bill.totalAmount)}</td>
                </tr>
              </tfoot>
            </table>
          </div>
        </div>
      )}

      {/* Payment History */}
      {payments.length > 0 && (
        <div className="rounded-xl border bg-card p-5 shadow-xs">
          <div className="flex items-center gap-2 mb-4">
            <CreditCard className="h-4 w-4 text-muted-foreground" />
            <h2 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground">Payment History</h2>
          </div>
          <div className="rounded-lg border overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b bg-muted/50 text-left text-xs text-muted-foreground">
                  <th className="px-4 py-3 font-medium">DATE</th>
                  <th className="px-4 py-3 font-medium">AMOUNT</th>
                  <th className="px-4 py-3 font-medium">METHOD</th>
                  <th className="px-4 py-3 font-medium">NOTES</th>
                </tr>
              </thead>
              <tbody>
                {payments.map((p) => (
                  <tr key={p.id} className="border-b last:border-0 hover:bg-muted/30">
                    <td className="px-4 py-3">{new Date(p.paymentDate).toLocaleDateString("en-IN")}</td>
                    <td className="px-4 py-3 font-mono text-green-700">{formatCurrency(p.amount)}</td>
                    <td className="px-4 py-3 capitalize text-muted-foreground">{p.method || "-"}</td>
                    <td className="px-4 py-3 text-muted-foreground">{p.notes || "-"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
