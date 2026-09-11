"use client";

import { use } from "react";
import Link from "next/link";
import { useAdminTenant } from "@/hooks/use-admin-tenants";
import { useAdminProperty } from "@/hooks/use-admin-properties";
import { useAdminTenantDetails } from "@/hooks/use-admin-details";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import { ArrowLeft, ArrowRight, Receipt, CreditCard, LifeBuoy } from "lucide-react";
import { formatCurrency } from "@/lib/utils";


export default function TenantDetailPage({ params }: { params: Promise<{ tenantId: string }> }) {
  const { tenantId } = use(params);
  const { data: tenant, isLoading } = useAdminTenant(tenantId);
  const { data: details, isLoading: detailsLoading } = useAdminTenantDetails(tenantId);

  // Tenants carry a propertyId but no ownerId — the property lookup is what
  // resolves the owner to open a support session on.
  const { data: tenantProperty } = useAdminProperty(tenant?.propertyId ?? "");

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

  const bills = details?.bills ?? [];
  const payments = details?.payments ?? [];
  const totalBilled = bills.reduce((sum, b) => sum + b.totalAmount, 0);
  const totalPaid = payments.reduce((sum, p) => sum + p.amount, 0);
  const ownerHref = tenantProperty?.ownerId
    ? `/dashboard/owners/${tenantProperty.ownerId}`
    : "/dashboard/owners";
  const isPending = tenant.status === "pending";

  return (
    <div className="space-y-6">
      <Link href="/dashboard/tenants" className="inline-flex items-center text-sm text-muted-foreground hover:text-foreground">
        <ArrowLeft className="mr-1 h-4 w-4" /> Back to Tenants
      </Link>

      <div>
        <h1 className="text-lg font-semibold tracking-tight">{tenant.name}</h1>
        <p className="mt-0.5 text-sm text-muted-foreground font-mono">{tenant.phone}</p>
      </div>

      <div className="rounded-xl border border-dashed bg-muted/30 p-4">
        <div className="flex items-start gap-2.5">
          <LifeBuoy className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground" />
          <div className="text-sm">
            <p className="font-medium">
              {isPending ? "Approve this tenant in the owner's account" : "Edits happen in the owner's account"}
            </p>
            <p className="mt-0.5 text-muted-foreground">
              {isPending
                ? "Approving from here only flipped the status — it never assigned a bed or issued an onboarding link. Open a support session on the owner and approve in their account."
                : "Editing from here could change future bill maths without the owner's guards. Open a support session on the owner and edit in their account — it is audit-logged."}
            </p>
            <Link
              href={ownerHref}
              className="mt-2 inline-flex items-center font-medium text-foreground hover:underline"
            >
              {tenantProperty?.ownerName ? `Open ${tenantProperty.ownerName}` : "Open owner"}
              <ArrowRight className="ml-1 h-3.5 w-3.5" />
            </Link>
          </div>
        </div>
      </div>

      {/* Financial Summary */}
      <div className="grid gap-4 sm:grid-cols-3">
        <div className="rounded-xl border bg-card p-5 shadow-xs">
          <p className="text-xs text-muted-foreground">Total Billed</p>
          <p className="text-xl font-semibold font-mono mt-1">{formatCurrency(totalBilled)}</p>
          <p className="text-xs text-muted-foreground mt-1">{bills.length} bills</p>
        </div>
        <div className="rounded-xl border bg-card p-5 shadow-xs">
          <p className="text-xs text-muted-foreground">Total Paid</p>
          <p className="text-xl font-semibold font-mono text-green-700 mt-1">{formatCurrency(totalPaid)}</p>
          <p className="text-xs text-muted-foreground mt-1">{payments.length} payments</p>
        </div>
        <div className="rounded-xl border bg-card p-5 shadow-xs">
          <p className="text-xs text-muted-foreground">Balance</p>
          <p className="text-xl font-semibold font-mono text-orange-600 mt-1">{formatCurrency(totalBilled - totalPaid)}</p>
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
                    <td className="px-4 py-3 font-mono">{formatCurrency(b.totalAmount)}</td>
                    <td className="px-4 py-3 font-mono text-green-700">{formatCurrency(b.paidAmount)}</td>
                    <td className="px-4 py-3 font-mono">{formatCurrency(b.balance)}</td>
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
