"use client";

import { useState } from "react";
import { useAdminPayments, useDeleteAdminPayment } from "@/hooks/use-admin-payments";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { CreditCard, Search, Trash2 } from "lucide-react";
import { toast } from "sonner";

function formatINR(amount: number) {
  return `₹${(amount / 100).toLocaleString("en-IN")}`;
}

export default function PaymentsPage() {
  const { data: payments, isLoading } = useAdminPayments();
  const deletePayment = useDeleteAdminPayment();
  const [search, setSearch] = useState("");

  const filtered = (payments ?? []).filter((p) => {
    const q = search.toLowerCase();
    return (
      (p.tenantName ?? "").toLowerCase().includes(q) ||
      (p.billMonth ?? "").includes(q)
    );
  });

  function handleDelete(paymentId: string) {
    if (!confirm("Delete this payment? This will update the bill balance.")) return;
    deletePayment.mutate(paymentId, {
      onSuccess: () => toast.success("Payment deleted"),
      onError: (err) => toast.error(err instanceof Error ? err.message : "Failed"),
    });
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-lg font-semibold tracking-tight">Payments</h1>
        <p className="mt-0.5 text-sm text-muted-foreground">All payments across all properties.</p>
      </div>

      <div className="relative">
        <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
        <Input placeholder="Search by tenant or bill month..." value={search} onChange={(e) => setSearch(e.target.value)} className="pl-9" />
      </div>

      {isLoading ? (
        <div className="space-y-2">
          {Array.from({ length: 6 }).map((_, i) => (
            <Skeleton key={i} className="h-16 w-full rounded-xl" />
          ))}
        </div>
      ) : filtered.length > 0 ? (
        <div className="rounded-xl border bg-card shadow-xs overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b bg-muted/50 text-left text-xs text-muted-foreground">
                <th className="px-4 py-3 font-medium">TENANT</th>
                <th className="px-4 py-3 font-medium">BILL MONTH</th>
                <th className="px-4 py-3 font-medium">AMOUNT</th>
                <th className="px-4 py-3 font-medium">METHOD</th>
                <th className="px-4 py-3 font-medium">DATE</th>
                <th className="px-4 py-3 font-medium"></th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((p) => (
                <tr key={p.id} className="border-b last:border-0 hover:bg-muted/30">
                  <td className="px-4 py-3 font-medium">{p.tenantName || "-"}</td>
                  <td className="px-4 py-3 font-mono text-muted-foreground">{p.billMonth || "-"}</td>
                  <td className="px-4 py-3 font-mono text-green-700">{formatINR(p.amount)}</td>
                  <td className="px-4 py-3 text-muted-foreground capitalize">{p.method || "-"}</td>
                  <td className="px-4 py-3 text-muted-foreground">
                    {new Date(p.paymentDate).toLocaleDateString("en-IN")}
                  </td>
                  <td className="px-4 py-3">
                    <Button variant="ghost" size="sm" onClick={() => handleDelete(p.id)} className="text-destructive hover:text-destructive">
                      <Trash2 className="h-3.5 w-3.5" />
                    </Button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <div className="rounded-xl border border-dashed p-12 text-center">
          <CreditCard className="mx-auto h-10 w-10 text-muted-foreground/30" />
          <p className="mt-3 text-sm font-medium text-muted-foreground">No payments found</p>
        </div>
      )}
    </div>
  );
}
