"use client";

import { use, useState } from "react";
import Link from "next/link";
import { useAdminTenant } from "@/hooks/use-admin-tenants";
import { useAdminTenantDetails } from "@/hooks/use-admin-details";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import { ArrowLeft, CheckCircle, XCircle, Edit2, Receipt, CreditCard } from "lucide-react";
import { toast } from "sonner";
import { EditTenantModal } from "@/components/modals/edit-tenant-modal";

function formatINR(amount: number) {
  return `₹${(amount / 100).toLocaleString("en-IN")}`;
}

export default function TenantDetailPage({ params }: { params: Promise<{ tenantId: string }> }) {
  const { tenantId } = use(params);
  const { data: tenant, isLoading } = useAdminTenant(tenantId);
  const { data: details, isLoading: detailsLoading } = useAdminTenantDetails(tenantId);
  const [editOpen, setEditOpen] = useState(false);

  if (isLoading || detailsLoading) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-8 w-32" />
        <Skeleton className="h-40 rounded-xl" />
      </div>
    );
  }

  if (!tenant) {
    return (
      <div className="space-y-6">
        <Link href="/dashboard/tenants" className="inline-flex items-center text-sm text-muted-foreground hover:text-foreground">
          <ArrowLeft className="mr-1 h-4 w-4" /> Back to Tenants
        </Link>
        <p className="text-sm text-muted-foreground">Tenant not found.</p>
      </div>
    );
  }

  function handleApprove() {
    // Use the approve mutation from the hook
    toast.success("Use the approve button on the list page");
  }

  function handleReject() {
    toast.success("Use the reject button on the list page");
  }

  const bills = details?.bills ?? [];
  const payments = details?.payments ?? [];
  const totalBilled = bills.reduce((sum, b) => sum + b.totalAmount, 0);
  const totalPaid = payments.reduce((sum, p) => sum + p.amount, 0);

  return (
    <div className="space-y-6">
      <Link href="/dashboard/tenants" className="inline-flex items-center text-sm text-muted-foreground hover:text-foreground">
        <ArrowLeft className="mr-1 h-4 w-4" /> Back to Tenants
      </Link>

      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-lg font-semibold tracking-tight">{tenant.name}</h1>
          <p className="mt-0.5 text-sm text-muted-foreground font-mono">{tenant.phone}</p>
        </div>
        <div className="flex gap-2">
          {tenant.status !== "pending" && (
            <Button variant="outline" onClick={() => setEditOpen(true)}>
              <Edit2 className="mr-1.5 h-4 w-4" /> Edit
            </Button>
          )}
          {tenant.status === "pending" && (
            <>
              <Button onClick={handleApprove}>
                <CheckCircle className="mr-1.5 h-4 w-4" /> Approve
              </Button>
              <Button variant="outline" onClick={handleReject} className="text-destructive hover:text-destructive">
                <XCircle className="mr-1.5 h-4 w-4" /> Reject
              </Button>
            </>
          )}
        </div>
      </div>

      {/* Financial Summary */}
      <div className="grid gap-4 sm:grid-cols-3">
        <div className="rounded-xl border bg-card p-5 shadow-xs">
          <p className="text-xs text-muted-foreground">Total Billed</p>
          <p className="text-xl font-semibold font-mono mt-1">{formatINR(totalBilled)}</p>
          <p className="text-xs text-muted-foreground mt-1">{bills.length} bills</p>
        </div>
        <div className="rounded-xl border bg-card p-5 shadow-xs">
          <p className="text-xs text-muted-foreground">Total Paid</p>
          <p className="text-xl font-semibold font-mono text-green-700 mt-1">{formatINR(totalPaid)}</p>
          <p className="text-xs text-muted-foreground mt-1">{payments.length} payments</p>
        </div>
        <div className="rounded-xl border bg-card p-5 shadow-xs">
          <p className="text-xs text-muted-foreground">Balance</p>
          <p className="text-xl font-semibold font-mono text-orange-600 mt-1">{formatINR(totalBilled - totalPaid)}</p>
          <p className="text-xs text-muted-foreground mt-1">Outstanding</p>
        </div>
      </div>

      <div className="rounded-xl border bg-card p-5 shadow-xs">
        <h2 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground mb-4">Tenant Info</h2>
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          <div>
            <p className="text-xs text-muted-foreground">Status</p>
            <Badge variant="secondary">{tenant.status}</Badge>
          </div>
          <div>
            <p className="text-xs text-muted-foreground">Property</p>
            <p className="text-sm">{tenant.propertyName || "-"}</p>
          </div>
          <div>
            <p className="text-xs text-muted-foreground">Room / Bed</p>
            <p className="text-sm">
              {details?.roomNumber || "-"} / {details?.bedNumber || "-"}
            </p>
          </div>
          <div>
            <p className="text-xs text-muted-foreground">Email</p>
            <p className="text-sm">{tenant.email || "-"}</p>
          </div>
          <div>
            <p className="text-xs text-muted-foreground">Joined</p>
            <p className="text-sm">{new Date(tenant.joiningDate).toLocaleDateString("en-IN")}</p>
          </div>
        </div>
      </div>

      {/* Bill History */}
      {bills.length > 0 && (
        <div className="rounded-xl border bg-card p-5 shadow-xs">
          <div className="flex items-center gap-2 mb-4">
            <Receipt className="h-4 w-4 text-muted-foreground" />
            <h2 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground">Bill History</h2>
          </div>
          <div className="rounded-lg border overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b bg-muted/50 text-left text-xs text-muted-foreground">
                  <th className="px-4 py-3 font-medium">MONTH</th>
                  <th className="px-4 py-3 font-medium">TOTAL</th>
                  <th className="px-4 py-3 font-medium">PAID</th>
                  <th className="px-4 py-3 font-medium">BALANCE</th>
                  <th className="px-4 py-3 font-medium">STATUS</th>
                </tr>
              </thead>
              <tbody>
                {bills.map((b) => (
                  <tr key={b.id} className="border-b last:border-0 hover:bg-muted/30">
                    <td className="px-4 py-3 font-mono">{b.billMonth}</td>
                    <td className="px-4 py-3 font-mono">{formatINR(b.totalAmount)}</td>
                    <td className="px-4 py-3 font-mono text-green-700">{formatINR(b.paidAmount)}</td>
                    <td className="px-4 py-3 font-mono">{formatINR(b.balance)}</td>
                    <td className="px-4 py-3">
                      <Badge variant="secondary">{b.voidedAt ? "Voided" : b.status}</Badge>
                    </td>
                  </tr>
                ))}
              </tbody>
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

      <EditTenantModal
        open={editOpen}
        onOpenChange={setEditOpen}
        tenant={tenant}
      />
    </div>
  );
}
