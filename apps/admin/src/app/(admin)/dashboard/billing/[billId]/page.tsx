"use client";

import { use, useState } from "react";
import Link from "next/link";
import { useAdminBill, useVoidAdminBill } from "@/hooks/use-admin-billing";
import { api } from "@/lib/api-client";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import { ArrowLeft, Ban, Edit2, CreditCard, List } from "lucide-react";
import { toast } from "sonner";
import { useQuery } from "@tanstack/react-query";
import { EditBillModal } from "@/components/modals/edit-bill-modal";

function formatINR(amount: number) {
  return `₹${(amount / 100).toLocaleString("en-IN")}`;
}

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
  const { data: bill, isLoading } = useAdminBill(billId);
  const voidBill = useVoidAdminBill();
  const [editOpen, setEditOpen] = useState(false);

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

  function handleVoid() {
    if (!confirm("Void this bill? This cannot be undone.")) return;
    voidBill.mutate(billId, {
      onSuccess: () => toast.success("Bill voided"),
      onError: (err) => toast.error(err instanceof Error ? err.message : "Failed"),
    });
  }

  const lineItems = details?.lineItems ?? bill.lineItems ?? [];
  const payments = details?.payments ?? [];

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
          <div className="flex gap-2">
            <Button variant="outline" onClick={() => setEditOpen(true)}>
              <Edit2 className="mr-1.5 h-4 w-4" /> Edit
            </Button>
            <Button variant="destructive" onClick={handleVoid} disabled={voidBill.isPending}>
              <Ban className="mr-1.5 h-4 w-4" /> Void
            </Button>
          </div>
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
                    <td className="px-4 py-3 font-mono text-right">{formatINR(item.amount)}</td>
                  </tr>
                ))}
              </tbody>
              <tfoot>
                <tr className="border-t bg-muted/30 font-medium">
                  <td className="px-4 py-3" colSpan={2}>Total</td>
                  <td className="px-4 py-3 font-mono text-right">{formatINR(bill.totalAmount)}</td>
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
                    <td className="px-4 py-3 font-mono text-green-700">{formatINR(p.amount)}</td>
                    <td className="px-4 py-3 capitalize text-muted-foreground">{p.method || "-"}</td>
                    <td className="px-4 py-3 text-muted-foreground">{p.notes || "-"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      <EditBillModal
        open={editOpen}
        onOpenChange={setEditOpen}
        bill={bill}
      />
    </div>
  );
}
