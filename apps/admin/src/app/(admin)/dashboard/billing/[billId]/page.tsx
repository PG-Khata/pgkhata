"use client";

import { use } from "react";
import Link from "next/link";
import { useAdminBill, useVoidAdminBill } from "@/hooks/use-admin-billing";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import { ArrowLeft, Ban } from "lucide-react";
import { toast } from "sonner";

function formatINR(amount: number) {
  return `₹${(amount / 100).toLocaleString("en-IN")}`;
}

export default function BillDetailPage({ params }: { params: Promise<{ billId: string }> }) {
  const { billId } = use(params);
  const { data: bill, isLoading } = useAdminBill(billId);
  const voidBill = useVoidAdminBill();

  if (isLoading) {
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

  function handleVoid() {
    voidBill.mutate(billId, {
      onSuccess: () => toast.success("Bill voided"),
      onError: (err) => toast.error(err instanceof Error ? err.message : "Failed"),
    });
  }

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
        {!bill.voidedAt && (
          <Button variant="destructive" onClick={handleVoid} disabled={voidBill.isPending}>
            <Ban className="mr-1.5 h-4 w-4" /> Void Bill
          </Button>
        )}
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <div className="rounded-xl border bg-card p-5 shadow-xs">
          <p className="text-xs text-muted-foreground">Total</p>
          <p className="text-xl font-semibold font-mono">{formatINR(bill.totalAmount)}</p>
        </div>
        <div className="rounded-xl border bg-card p-5 shadow-xs">
          <p className="text-xs text-muted-foreground">Paid</p>
          <p className="text-xl font-semibold font-mono text-green-700">{formatINR(bill.paidAmount)}</p>
        </div>
        <div className="rounded-xl border bg-card p-5 shadow-xs">
          <p className="text-xs text-muted-foreground">Balance</p>
          <p className="text-xl font-semibold font-mono">{formatINR(bill.balance)}</p>
        </div>
        <div className="rounded-xl border bg-card p-5 shadow-xs">
          <p className="text-xs text-muted-foreground">Status</p>
          <Badge variant="secondary" className="mt-1">{bill.voidedAt ? "Voided" : bill.status}</Badge>
        </div>
      </div>

      <div className="rounded-xl border bg-card p-5 shadow-xs">
        <h2 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground mb-4">Bill Info</h2>
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          <div>
            <p className="text-xs text-muted-foreground">Bill ID</p>
            <p className="text-xs font-mono text-muted-foreground">{bill.id}</p>
          </div>
          <div>
            <p className="text-xs text-muted-foreground">Approved</p>
            <Badge variant="outline">{bill.approved ? "Yes" : "No"}</Badge>
          </div>
          <div>
            <p className="text-xs text-muted-foreground">Created</p>
            <p className="text-sm">{new Date(bill.createdAt).toLocaleDateString("en-IN")}</p>
          </div>
        </div>
      </div>
    </div>
  );
}
