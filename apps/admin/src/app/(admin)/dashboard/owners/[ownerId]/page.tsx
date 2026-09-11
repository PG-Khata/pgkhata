"use client";

import { use, useState } from "react";
import Link from "next/link";
import { useAdminOwner } from "@/hooks/use-admin-owners";
import { useAdminOwnerDetails } from "@/hooks/use-admin-details";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import { ArrowLeft, Building2, Edit2, Eye, IndianRupee } from "lucide-react";
import { EditOwnerModal } from "@/components/modals/edit-owner-modal";
import { StartImpersonationModal } from "@/components/modals/start-impersonation-modal";
import { formatCurrency } from "@/lib/utils";


export default function OwnerDetailPage({ params }: { params: Promise<{ ownerId: string }> }) {
  const { ownerId } = use(params);
  const { data: owner, isLoading } = useAdminOwner(ownerId);
  const { data: details, isLoading: detailsLoading } = useAdminOwnerDetails(ownerId);
  const [editOpen, setEditOpen] = useState(false);
  const [impersonateOpen, setImpersonateOpen] = useState(false);

  if (isLoading || detailsLoading) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-8 w-32" />
        <Skeleton className="h-40 rounded-xl" />
      </div>
    );
  }

  if (!owner) {
    return (
      <div className="space-y-6">
        <Link href="/dashboard/owners" className="inline-flex items-center text-sm text-muted-foreground hover:text-foreground">
          <ArrowLeft className="mr-1 h-4 w-4" /> Back to Owners
        </Link>
        <p className="text-sm text-muted-foreground">Owner not found.</p>
      </div>
    );
  }

  const summary = details?.billingSummary;

  return (
    <div className="space-y-6">
      <Link href="/dashboard/owners" className="inline-flex items-center text-sm text-muted-foreground hover:text-foreground">
        <ArrowLeft className="mr-1 h-4 w-4" /> Back to Owners
      </Link>

      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-lg font-semibold tracking-tight">{owner.name}</h1>
          <p className="mt-0.5 text-sm text-muted-foreground">{owner.email}</p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={() => setEditOpen(true)}>
            <Edit2 className="mr-1.5 h-4 w-4" />
            Edit
          </Button>
          <Button onClick={() => setImpersonateOpen(true)}>
            <Eye className="mr-1.5 h-4 w-4" />
            Impersonate
          </Button>
        </div>
      </div>

      {/* Billing Summary Cards */}
      {summary && (
        <div className="grid gap-4 sm:grid-cols-3">
          <div className="rounded-xl border bg-card p-5 shadow-xs">
            <div className="flex items-center gap-2 text-muted-foreground">
              <IndianRupee className="h-4 w-4" />
              <p className="text-xs uppercase tracking-wider">Total Billed</p>
            </div>
            <p className="mt-2 text-2xl font-semibold font-mono">{formatCurrency(summary.totalBilled)}</p>
            <p className="text-xs text-muted-foreground mt-1">{summary.totalBills} bills</p>
          </div>
          <div className="rounded-xl border bg-card p-5 shadow-xs">
            <div className="flex items-center gap-2 text-green-600">
              <IndianRupee className="h-4 w-4" />
              <p className="text-xs uppercase tracking-wider">Collected</p>
            </div>
            <p className="mt-2 text-2xl font-semibold font-mono text-green-700">{formatCurrency(summary.totalCollected)}</p>
            <p className="text-xs text-muted-foreground mt-1">
              {summary.totalBilled > 0 ? Math.round((summary.totalCollected / summary.totalBilled) * 100) : 0}% collected
            </p>
          </div>
          <div className="rounded-xl border bg-card p-5 shadow-xs">
            <div className="flex items-center gap-2 text-orange-600">
              <IndianRupee className="h-4 w-4" />
              <p className="text-xs uppercase tracking-wider">Pending</p>
            </div>
            <p className="mt-2 text-2xl font-semibold font-mono text-orange-600">{formatCurrency(summary.totalPending)}</p>
            <p className="text-xs text-muted-foreground mt-1">Outstanding amount</p>
          </div>
        </div>
      )}

      <div className="rounded-xl border bg-card p-5 shadow-xs">
        <h2 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground mb-4">Owner Info</h2>
        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <p className="text-xs text-muted-foreground">Phone</p>
            <p className="text-sm font-mono">{owner.phone || "-"}</p>
          </div>
          <div>
            <p className="text-xs text-muted-foreground">Joined</p>
            <p className="text-sm">{new Date(owner.createdAt).toLocaleDateString("en-IN")}</p>
          </div>
        </div>
      </div>

      {/* Properties */}
      {owner.properties && owner.properties.length > 0 && (
        <div className="rounded-xl border bg-card p-5 shadow-xs">
          <h2 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground mb-4">Properties</h2>
          <div className="space-y-3">
            {owner.properties.map((p) => (
              <div key={p.id} className="flex items-center justify-between rounded-lg border p-3">
                <div className="flex items-center gap-3">
                  <Building2 className="h-4 w-4 text-muted-foreground" />
                  <div>
                    <p className="text-sm font-medium">{p.name}</p>
                    <p className="text-xs text-muted-foreground">{p.address || p.city || "-"}</p>
                  </div>
                </div>
                <Link href={`/dashboard/properties/${p.id}`}>
                  <Button variant="outline" size="sm">View</Button>
                </Link>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Tenants */}
      {details?.tenants && details.tenants.length > 0 && (
        <div className="rounded-xl border bg-card p-5 shadow-xs">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground">Tenants</h2>
            <Badge variant="outline">{details.tenants.length} total</Badge>
          </div>
          <div className="rounded-lg border overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b bg-muted/50 text-left text-xs text-muted-foreground">
                  <th className="px-4 py-3 font-medium">NAME</th>
                  <th className="px-4 py-3 font-medium">PROPERTY</th>
                  <th className="px-4 py-3 font-medium">STATUS</th>
                </tr>
              </thead>
              <tbody>
                {details.tenants.slice(0, 10).map((t) => (
                  <tr key={t.id} className="border-b last:border-0 hover:bg-muted/30">
                    <td className="px-4 py-3">
                      <p className="font-medium">{t.name}</p>
                      <p className="text-xs text-muted-foreground font-mono">{t.phone}</p>
                    </td>
                    <td className="px-4 py-3 text-muted-foreground">{t.propertyName || "-"}</td>
                    <td className="px-4 py-3">
                      <Badge variant="secondary">{t.status}</Badge>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {details.tenants.length > 10 && (
            <p className="mt-3 text-xs text-muted-foreground text-center">
              Showing 10 of {details.tenants.length} tenants
            </p>
          )}
        </div>
      )}

      <EditOwnerModal
        open={editOpen}
        onOpenChange={setEditOpen}
        ownerId={owner.id}
        currentPhone={owner.phone}
      />

      <StartImpersonationModal
        open={impersonateOpen}
        onOpenChange={setImpersonateOpen}
        ownerId={owner.id}
        ownerName={owner.name}
      />
    </div>
  );
}
