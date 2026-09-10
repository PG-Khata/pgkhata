"use client";

import { use } from "react";
import Link from "next/link";
import { useAdminOwner } from "@/hooks/use-admin-owners";
import { useImpersonate } from "@/hooks/use-impersonation";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import { ArrowLeft, Eye, Building2 } from "lucide-react";
import { toast } from "sonner";
import { useRouter } from "next/navigation";

export default function OwnerDetailPage({ params }: { params: Promise<{ ownerId: string }> }) {
  const { ownerId } = use(params);
  const { data: owner, isLoading } = useAdminOwner(ownerId);
  const impersonate = useImpersonate();
  const router = useRouter();

  function handleImpersonate() {
    impersonate.mutate(ownerId, {
      onSuccess: () => {
        toast.success("Now impersonating owner");
        router.push("/dashboard");
      },
      onError: (err) => {
        toast.error(err instanceof Error ? err.message : "Failed to impersonate");
      },
    });
  }

  if (isLoading) {
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

  return (
    <div className="space-y-6">
      <Link href="/dashboard/owners" className="inline-flex items-center text-sm text-muted-foreground hover:text-foreground">
        <ArrowLeft className="mr-1 h-4 w-4" /> Back to Owners
      </Link>

      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-lg font-semibold tracking-tight">{owner.user.name}</h1>
          <p className="mt-0.5 text-sm text-muted-foreground">{owner.user.email}</p>
        </div>
        <Button onClick={handleImpersonate} disabled={impersonate.isPending}>
          <Eye className="mr-1.5 h-4 w-4" />
          {impersonate.isPending ? "Impersonating..." : "Impersonate"}
        </Button>
      </div>

      <div className="rounded-xl border bg-card p-5 shadow-xs">
        <h2 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground mb-4">Owner Info</h2>
        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <p className="text-xs text-muted-foreground">Phone</p>
            <p className="text-sm font-mono">{owner.owner.phone || "-"}</p>
          </div>
          <div>
            <p className="text-xs text-muted-foreground">Joined</p>
            <p className="text-sm">{new Date(owner.owner.createdAt).toLocaleDateString("en-IN")}</p>
          </div>
          <div>
            <p className="text-xs text-muted-foreground">Owner ID</p>
            <p className="text-xs font-mono text-muted-foreground">{owner.owner.id}</p>
          </div>
          <div>
            <p className="text-xs text-muted-foreground">User ID</p>
            <p className="text-xs font-mono text-muted-foreground">{owner.owner.userId}</p>
          </div>
        </div>
      </div>

      {owner.properties && owner.properties.length > 0 && (
        <div className="rounded-xl border bg-card p-5 shadow-xs">
          <h2 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground mb-4">Properties</h2>
          <div className="space-y-3">
            {owner.properties.map((p: Record<string, unknown>) => (
              <div key={p.id as string} className="flex items-center justify-between rounded-lg border p-3">
                <div className="flex items-center gap-3">
                  <Building2 className="h-4 w-4 text-muted-foreground" />
                  <div>
                    <p className="text-sm font-medium">{p.name as string}</p>
                    <p className="text-xs text-muted-foreground">{(p.address as string) || (p.city as string) || "-"}</p>
                  </div>
                </div>
                <Link href={`/dashboard/properties/${p.id as string}`}>
                  <Button variant="outline" size="sm">View</Button>
                </Link>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
