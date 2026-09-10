"use client";

import { useAdminAnalytics } from "@/hooks/use-admin-analytics";
import { AdminStatCard } from "@/components/admin-stat-card";
import { Skeleton } from "@/components/ui/skeleton";
import { Building2, CreditCard, Users, UserCheck } from "lucide-react";

export default function DashboardPage() {
  const { data: analytics, isLoading } = useAdminAnalytics();

  if (isLoading) {
    return (
      <div className="space-y-6">
        <div>
          <h1 className="text-lg font-semibold tracking-tight">Platform Overview</h1>
          <p className="mt-0.5 text-sm text-muted-foreground">Loading analytics...</p>
        </div>
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <Skeleton key={i} className="h-28 rounded-xl" />
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-lg font-semibold tracking-tight">Platform Overview</h1>
        <p className="mt-0.5 text-sm text-muted-foreground">
          Real-time stats across all owners, properties, and tenants.
        </p>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <AdminStatCard
          label="Total Owners"
          value={analytics?.totalOwners ?? 0}
          icon={Users}
          description="Registered PG owners"
        />
        <AdminStatCard
          label="Properties"
          value={analytics?.totalProperties ?? 0}
          icon={Building2}
          description="PG properties created"
        />
        <AdminStatCard
          label="Active Tenants"
          value={analytics?.activeTenants ?? 0}
          icon={UserCheck}
          description="Currently active"
        />
        <AdminStatCard
          label="Users"
          value={analytics?.totalUsers ?? 0}
          icon={CreditCard}
          description="Total registered users"
        />
      </div>
    </div>
  );
}
