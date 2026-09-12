"use client";

import { use, useState } from "react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useAdminSession } from "@/components/admin-session";
import { useAdminOwner } from "@/hooks/use-admin-owners";
import { useOwnerOverview } from "@/hooks/use-owner-overview";
import { EditOwnerModal } from "@/components/modals/edit-owner-modal";
import { StartImpersonationModal } from "@/components/modals/start-impersonation-modal";
import { ArrowLeft, Ban, Edit2, Eye, Mail, Phone, RotateCcw } from "lucide-react";
import { OwnerActivityTab } from "./owner-activity-tab";
import { OwnerBillingTab } from "./owner-billing-tab";
import { OwnerLifecycleDialog } from "./owner-lifecycle-dialog";
import { OwnerOverviewTab } from "./owner-overview-tab";
import { OwnerPropertiesTab } from "./owner-properties-tab";
import { OwnerTenantsTab } from "./owner-tenants-tab";
import { AccountStatusBadge, CopyButton, formatDate } from "./owner-ui";

/**
 * Owner 360.
 *
 * Built for a 9pm phone call, not for browsing. The sticky header keeps the
 * three things an agent needs mid-sentence — who this is, whether the account
 * is even switched on, and the buttons that act on it — pinned while they
 * scroll. Everything below is ordered by "what is wrong right now" rather than
 * by how impressive the number looks.
 *
 * Identity falls back to `GET /owners/:id` when the overview payload is not
 * available, so the page still works as a directory entry instead of going
 * blank on a partial backend.
 */
export default function OwnerDetailPage({ params }: { params: Promise<{ ownerId: string }> }) {
  const { ownerId } = use(params);
  const admin = useAdminSession();

  const overviewQuery = useOwnerOverview(ownerId);
  const ownerQuery = useAdminOwner(ownerId);

  const [editOpen, setEditOpen] = useState(false);
  const [impersonateOpen, setImpersonateOpen] = useState(false);
  const [lifecycleAction, setLifecycleAction] = useState<"suspend" | "reactivate" | null>(null);

  const overview = overviewQuery.data;
  const owner = ownerQuery.data;
  const identity = overview?.identity;

  // The clock comes from the query, never from `Date.now()` during render:
  // rendering twice must not produce two different "3 days ago"s.
  const asOf = Math.max(overviewQuery.dataUpdatedAt, ownerQuery.dataUpdatedAt);

  const name = identity?.name ?? owner?.name;
  const email = identity?.email ?? owner?.email ?? null;
  const phone = identity?.phone ?? owner?.phone ?? null;
  const status = identity?.status;
  const suspended = status === "suspended";

  if (overviewQuery.isLoading && ownerQuery.isLoading) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-5 w-32" />
        <Skeleton className="h-16 w-full rounded-xl" />
        <Skeleton className="h-40 w-full rounded-xl" />
      </div>
    );
  }

  if (!name) {
    return (
      <div className="space-y-6">
        <Link
          href="/dashboard/owners"
          className="inline-flex items-center text-sm text-muted-foreground hover:text-foreground"
        >
          <ArrowLeft className="mr-1 h-4 w-4" /> Back to owners
        </Link>
        <p className="text-sm text-muted-foreground">
          {overviewQuery.error instanceof Error
            ? overviewQuery.error.message
            : "Owner not found."}
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-5">
      <div className="sticky top-0 z-20 -mx-4 border-b bg-background/95 px-4 py-3 backdrop-blur supports-backdrop-filter:bg-background/80 md:-mx-6 md:px-6">
        <Link
          href="/dashboard/owners"
          className="inline-flex items-center text-xs text-muted-foreground hover:text-foreground"
        >
          <ArrowLeft className="mr-1 h-3.5 w-3.5" /> Back to owners
        </Link>

        <div className="mt-1.5 flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
          <div className="flex min-w-0 items-center gap-2.5">
            <h1 className="truncate text-lg font-semibold tracking-tight">{name}</h1>
            <AccountStatusBadge status={status} />
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <CopyButton value={phone} label="Phone" icon={<Phone className="h-3.5 w-3.5" />} />
            <CopyButton value={email} label="Email" icon={<Mail className="h-3.5 w-3.5" />} />
            <Button variant="outline" size="sm" onClick={() => setEditOpen(true)}>
              <Edit2 className="h-3.5 w-3.5" />
              Edit
            </Button>
            {/* Cosmetic gate only — `requireSuperAdminRole` is the real one. */}
            {admin.role === "super_admin" ? (
              suspended ? (
                <Button variant="outline" size="sm" onClick={() => setLifecycleAction("reactivate")}>
                  <RotateCcw className="h-3.5 w-3.5" />
                  Reactivate
                </Button>
              ) : (
                <Button
                  variant="destructive"
                  size="sm"
                  onClick={() => setLifecycleAction("suspend")}
                >
                  <Ban className="h-3.5 w-3.5" />
                  Suspend
                </Button>
              )
            ) : null}
            <Button size="sm" onClick={() => setImpersonateOpen(true)}>
              <Eye className="h-3.5 w-3.5" />
              Impersonate
            </Button>
          </div>
        </div>
      </div>

      {suspended ? (
        <div className="rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-900">
          <p className="font-medium">
            Account suspended{identity?.suspendedAt ? ` on ${formatDate(identity.suspendedAt)}` : ""}
            . Nobody on this account can sign in.
          </p>
          {identity?.suspendedReason ? (
            <p className="mt-1 opacity-90">Reason: {identity.suspendedReason}</p>
          ) : null}
        </div>
      ) : null}

      {overviewQuery.isError ? (
        <div className="rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900">
          <p className="font-medium">The 360 overview did not load.</p>
          <p className="mt-1 opacity-90">
            {overviewQuery.error instanceof Error
              ? overviewQuery.error.message
              : "Unknown error"}{" "}
            — tenant and activity data below still work.
          </p>
        </div>
      ) : null}

      <Tabs defaultValue="overview" className="gap-4">
        <TabsList className="w-full overflow-x-auto sm:w-fit">
          <TabsTrigger value="overview">Overview</TabsTrigger>
          <TabsTrigger value="properties">Properties</TabsTrigger>
          <TabsTrigger value="tenants">Tenants</TabsTrigger>
          <TabsTrigger value="billing">Billing</TabsTrigger>
          <TabsTrigger value="activity">Activity</TabsTrigger>
        </TabsList>

        <TabsContent value="overview">
          <OwnerOverviewTab overview={overview} asOf={asOf} />
        </TabsContent>
        <TabsContent value="properties">
          <OwnerPropertiesTab overview={overview} />
        </TabsContent>
        <TabsContent value="tenants">
          <OwnerTenantsTab ownerId={ownerId} />
        </TabsContent>
        <TabsContent value="billing">
          <OwnerBillingTab overview={overview} asOf={asOf} />
        </TabsContent>
        <TabsContent value="activity">
          <OwnerActivityTab ownerId={ownerId} asOf={asOf} />
        </TabsContent>
      </Tabs>

      <EditOwnerModal
        key={phone ?? ownerId}
        open={editOpen}
        onOpenChange={setEditOpen}
        ownerId={ownerId}
        currentPhone={phone}
      />

      <StartImpersonationModal
        open={impersonateOpen}
        onOpenChange={setImpersonateOpen}
        ownerId={ownerId}
        ownerName={name}
      />

      {lifecycleAction ? (
        <OwnerLifecycleDialog
          open
          onOpenChange={(next) => {
            if (!next) setLifecycleAction(null);
          }}
          ownerId={ownerId}
          ownerName={name}
          action={lifecycleAction}
        />
      ) : null}
    </div>
  );
}
