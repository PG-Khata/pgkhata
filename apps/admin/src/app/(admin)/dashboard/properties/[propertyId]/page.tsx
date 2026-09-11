"use client";

import { use } from "react";
import Link from "next/link";
import {
  useAdminProperty,
  useReconcilePropertyBeds,
  useReconcilePropertyOverdue,
} from "@/hooks/use-admin-properties";
import { useAdminPropertyDetails } from "@/hooks/use-admin-details";
import { useAdminSession } from "@/components/admin-session";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import { ArrowLeft, ArrowRight, Users, Layers, LifeBuoy, RefreshCw, BedDouble } from "lucide-react";
import { toast } from "sonner";

export default function PropertyDetailPage({ params }: { params: Promise<{ propertyId: string }> }) {
  const { propertyId } = use(params);
  const { role } = useAdminSession();
  const { data: property, isLoading } = useAdminProperty(propertyId);
  const { data: details, isLoading: detailsLoading } = useAdminPropertyDetails(propertyId);
  const reconcileBeds = useReconcilePropertyBeds();
  const reconcileOverdue = useReconcilePropertyOverdue();

  if (isLoading || detailsLoading) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-8 w-32" />
        <Skeleton className="h-40 rounded-xl" />
      </div>
    );
  }

  if (!property) {
    return (
      <div className="space-y-6">
        <Link href="/dashboard/properties" className="inline-flex items-center text-sm text-muted-foreground hover:text-foreground">
          <ArrowLeft className="mr-1 h-4 w-4" /> Back to Properties
        </Link>
        <p className="text-sm text-muted-foreground">Property not found.</p>
      </div>
    );
  }

  function handleReconcileBeds() {
    reconcileBeds.mutate(propertyId, {
      onSuccess: () => toast.success("Bed statuses reconciled with current tenancies"),
      onError: (err) => toast.error(err instanceof Error ? err.message : "Failed"),
    });
  }

  function handleReconcileOverdue() {
    reconcileOverdue.mutate(propertyId, {
      onSuccess: () => toast.success("Overdue statuses reconciled"),
      onError: (err) => toast.error(err instanceof Error ? err.message : "Failed"),
    });
  }

  const bedRows = details?.beds ?? [];

  return (
    <div className="space-y-6">
      <Link href="/dashboard/properties" className="inline-flex items-center text-sm text-muted-foreground hover:text-foreground">
        <ArrowLeft className="mr-1 h-4 w-4" /> Back to Properties
      </Link>

      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-lg font-semibold tracking-tight">{property.name}</h1>
          <p className="mt-0.5 text-sm text-muted-foreground">{property.address || property.city || "-"}</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Link href={`/dashboard/properties/${propertyId}/structure`}>
            <Button variant="outline">
              <Layers className="mr-1.5 h-4 w-4" /> Structure
            </Button>
          </Link>
          {role === "super_admin" && (
            <>
              <Button variant="outline" onClick={handleReconcileBeds} disabled={reconcileBeds.isPending}>
                <BedDouble className="mr-1.5 h-4 w-4" /> Reconcile beds
              </Button>
              <Button variant="outline" onClick={handleReconcileOverdue} disabled={reconcileOverdue.isPending}>
                <RefreshCw className={`mr-1.5 h-4 w-4 ${reconcileOverdue.isPending ? "animate-spin" : ""}`} />
                Reconcile overdue
              </Button>
            </>
          )}
        </div>
      </div>

      <div className="rounded-xl border border-dashed bg-muted/30 p-4">
        <div className="flex items-start gap-2.5">
          <LifeBuoy className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground" />
          <div className="text-sm">
            <p className="font-medium">Edits happen in the owner&apos;s account</p>
            <p className="mt-0.5 text-muted-foreground">
              Editing a property here changed settings like electricity mode and rate, silently
              rewriting future bill maths for every tenant. Open a support session on the owner and
              edit in their account — it is audit-logged. The reconcile actions above only re-derive
              state that already exists.
            </p>
            <Link
              href={`/dashboard/owners/${property.ownerId}`}
              className="mt-2 inline-flex items-center font-medium text-foreground hover:underline"
            >
              {property.ownerName ? `Open ${property.ownerName}` : "Open owner"}
              <ArrowRight className="ml-1 h-3.5 w-3.5" />
            </Link>
          </div>
        </div>
      </div>

      <div className="rounded-xl border bg-card p-5 shadow-xs">
        <h2 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground mb-4">Property Details</h2>
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          <div>
            <p className="text-xs text-muted-foreground">Owner</p>
            <p className="text-sm font-medium">{property.ownerName || "-"}</p>
          </div>
          <div>
            <p className="text-xs text-muted-foreground">City</p>
            <p className="text-sm">{property.city || "-"}</p>
          </div>
          <div>
            <p className="text-xs text-muted-foreground">State</p>
            <p className="text-sm">{property.state || "-"}</p>
          </div>
          <div>
            <p className="text-xs text-muted-foreground">Pincode</p>
            <p className="text-sm font-mono">{property.pincode || "-"}</p>
          </div>
          <div>
            <p className="text-xs text-muted-foreground">Electricity Mode</p>
            <Badge variant="outline">{property.electricityMode}</Badge>
          </div>
        </div>
      </div>

      <div className="grid gap-4 sm:grid-cols-3">
        <div className="rounded-xl border bg-card p-5 shadow-xs text-center">
          <p className="text-2xl font-semibold">{property.totalBeds ?? 0}</p>
          <p className="text-xs text-muted-foreground mt-1">Total Beds</p>
        </div>
        <div className="rounded-xl border bg-card p-5 shadow-xs text-center">
          <p className="text-2xl font-semibold">{property.occupiedBeds ?? 0}</p>
          <p className="text-xs text-muted-foreground mt-1">Occupied</p>
        </div>
        <div className="rounded-xl border bg-card p-5 shadow-xs text-center">
          <p className="text-2xl font-semibold">{property.activeTenants ?? 0}</p>
          <p className="text-xs text-muted-foreground mt-1">Active Tenants</p>
        </div>
      </div>

      {/* Structure Tree */}
      {details && details.floors.length > 0 && (
        <div className="rounded-xl border bg-card p-5 shadow-xs">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2">
              <Layers className="h-4 w-4 text-muted-foreground" />
              <h2 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground">Structure</h2>
            </div>
            <Link
              href={`/dashboard/properties/${propertyId}/structure`}
              className="inline-flex items-center text-sm text-muted-foreground hover:text-foreground"
            >
              Full view <ArrowRight className="ml-1 h-3.5 w-3.5" />
            </Link>
          </div>
          <div className="space-y-4">
            {details.floors.map((f) => {
              const floorRooms = details.rooms.filter((r) => r.floorId === f.id);
              return (
                <div key={f.id} className="rounded-lg border p-3">
                  <p className="text-sm font-medium mb-2">{f.name}</p>
                  <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
                    {floorRooms.map((r) => {
                      const roomBeds = bedRows.filter((b) => b.roomId === r.id);
                      return (
                        <div key={r.id} className="rounded-md bg-muted/30 p-2">
                          <p className="text-xs font-medium">Room {r.number}</p>
                          <div className="flex gap-1 mt-1 flex-wrap">
                            {roomBeds.map((b) => (
                              <Badge
                                key={b.id}
                                variant={b.status === "occupied" ? "default" : "outline"}
                                className="text-xs"
                              >
                                {b.number}
                              </Badge>
                            ))}
                            {roomBeds.length === 0 && (
                              <p className="text-xs text-muted-foreground">No beds</p>
                            )}
                          </div>
                        </div>
                      );
                    })}
                    {floorRooms.length === 0 && (
                      <p className="text-xs text-muted-foreground">No rooms</p>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Tenants */}
      {details && details.tenants.length > 0 && (
        <div className="rounded-xl border bg-card p-5 shadow-xs">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2">
              <Users className="h-4 w-4 text-muted-foreground" />
              <h2 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground">Tenants</h2>
            </div>
            <Badge variant="outline">{details.tenants.length} active</Badge>
          </div>
          <div className="rounded-lg border overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b bg-muted/50 text-left text-xs text-muted-foreground">
                  <th className="px-4 py-3 font-medium">NAME</th>
                  <th className="px-4 py-3 font-medium">ROOM</th>
                  <th className="px-4 py-3 font-medium">BED</th>
                  <th className="px-4 py-3 font-medium">PHONE</th>
                </tr>
              </thead>
              <tbody>
                {details.tenants.map((t) => (
                  <tr key={t.id} className="border-b last:border-0 hover:bg-muted/30">
                    <td className="px-4 py-3 font-medium">{t.name}</td>
                    <td className="px-4 py-3 text-muted-foreground">{t.roomNumber || "-"}</td>
                    <td className="px-4 py-3 text-muted-foreground">{t.bedNumber || "-"}</td>
                    <td className="px-4 py-3 text-muted-foreground font-mono">{t.phone}</td>
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
