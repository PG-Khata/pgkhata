"use client";

import { useAdminAnalytics } from "@/hooks/use-admin-analytics";
import { AdminStatCard } from "@/components/admin-stat-card";
import { Skeleton } from "@/components/ui/skeleton";
import { Building2, Users, UserCheck, IndianRupee, TrendingUp, TrendingDown } from "lucide-react";
import { api } from "@/lib/api-client";
import { useQuery } from "@tanstack/react-query";

interface AnalyticsTrend {
  month: string;
  owners: number;
  properties: number;
  tenants: number;
  billed: number;
  collected: number;
}

function formatINR(amount: number) {
  return `₹${(amount / 100).toLocaleString("en-IN")}`;
}

export default function AnalyticsPage() {
  const { data: analytics, isLoading } = useAdminAnalytics();

  const { data: trends, isLoading: trendsLoading } = useQuery({
    queryKey: ["admin", "analytics", "trends"],
    queryFn: () => api.get<AnalyticsTrend[]>("/v1/admin/analytics/trends"),
  });

  if (isLoading) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-8 w-48" />
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
        <h1 className="text-lg font-semibold tracking-tight">Platform Analytics</h1>
        <p className="mt-0.5 text-sm text-muted-foreground">
          Growth trends and key metrics across all owners.
        </p>
      </div>

      {/* Main Stats */}
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
          icon={IndianRupee}
          description="Total registered users"
        />
      </div>

      {/* Trends Table */}
      {trends && trends.length > 0 && (
        <div className="rounded-xl border bg-card p-5 shadow-xs">
          <h2 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground mb-4">
            Monthly Trends (Last 6 Months)
          </h2>
          <div className="rounded-lg border overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b bg-muted/50 text-left text-xs text-muted-foreground">
                  <th className="px-4 py-3 font-medium">MONTH</th>
                  <th className="px-4 py-3 font-medium">OWNERS</th>
                  <th className="px-4 py-3 font-medium">PROPERTIES</th>
                  <th className="px-4 py-3 font-medium">TENANTS</th>
                  <th className="px-4 py-3 font-medium">BILLED</th>
                  <th className="px-4 py-3 font-medium">COLLECTED</th>
                </tr>
              </thead>
              <tbody>
                {trends.map((t) => (
                  <tr key={t.month} className="border-b last:border-0 hover:bg-muted/30">
                    <td className="px-4 py-3 font-medium">{t.month}</td>
                    <td className="px-4 py-3">{t.owners}</td>
                    <td className="px-4 py-3">{t.properties}</td>
                    <td className="px-4 py-3">{t.tenants}</td>
                    <td className="px-4 py-3 font-mono">{formatINR(t.billed)}</td>
                    <td className="px-4 py-3 font-mono text-green-700">{formatINR(t.collected)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Placeholder for future charts */}
      <div className="grid gap-4 sm:grid-cols-2">
        <div className="rounded-xl border bg-card p-5 shadow-xs">
          <div className="flex items-center gap-2 mb-4">
            <TrendingUp className="h-4 w-4 text-green-600" />
            <h2 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground">Growth</h2>
          </div>
          <p className="text-sm text-muted-foreground">
            Owner and property growth over time will be visualized here.
          </p>
        </div>
        <div className="rounded-xl border bg-card p-5 shadow-xs">
          <div className="flex items-center gap-2 mb-4">
            <IndianRupee className="h-4 w-4 text-blue-600" />
            <h2 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground">Revenue</h2>
          </div>
          <p className="text-sm text-muted-foreground">
            Billing and collection trends will be visualized here.
          </p>
        </div>
      </div>
    </div>
  );
}
