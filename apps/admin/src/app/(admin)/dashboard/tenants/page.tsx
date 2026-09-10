"use client";

import { useState } from "react";
import Link from "next/link";
import { useAdminTenants } from "@/hooks/use-admin-tenants";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import { Search, Users, ExternalLink } from "lucide-react";

const STATUS_COLORS: Record<string, string> = {
  active: "bg-green-100 text-green-800",
  pending: "bg-yellow-100 text-yellow-800",
  vacated: "bg-gray-100 text-gray-800",
  vacating: "bg-orange-100 text-orange-800",
  rejected: "bg-red-100 text-red-800",
};

export default function TenantsPage() {
  const { data: tenants, isLoading } = useAdminTenants();
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");

  const filtered = (tenants ?? []).filter((t) => {
    const q = search.toLowerCase();
    const matchesSearch =
      t.name.toLowerCase().includes(q) ||
      t.phone.includes(q) ||
      (t.propertyName ?? "").toLowerCase().includes(q);
    const matchesStatus = statusFilter === "all" || t.status === statusFilter;
    return matchesSearch && matchesStatus;
  });

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-lg font-semibold tracking-tight">Tenants</h1>
        <p className="mt-0.5 text-sm text-muted-foreground">All tenants across all properties.</p>
      </div>

      <div className="flex flex-col gap-3 sm:flex-row">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input placeholder="Search by name, phone, or property..." value={search} onChange={(e) => setSearch(e.target.value)} className="pl-9" />
        </div>
        <select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)} className="h-9 rounded-lg border bg-background px-3 text-sm">
          <option value="all">All Status</option>
          <option value="active">Active</option>
          <option value="pending">Pending</option>
          <option value="vacating">Vacating</option>
          <option value="vacated">Vacated</option>
        </select>
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
                <th className="px-4 py-3 font-medium">PROPERTY</th>
                <th className="px-4 py-3 font-medium">BED</th>
                <th className="px-4 py-3 font-medium">STATUS</th>
                <th className="px-4 py-3 font-medium">JOINED</th>
                <th className="px-4 py-3 font-medium"></th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((t) => (
                <tr key={t.id} className="border-b last:border-0 hover:bg-muted/30">
                  <td className="px-4 py-3">
                    <p className="font-medium">{t.name}</p>
                    <p className="text-xs text-muted-foreground font-mono">{t.phone}</p>
                  </td>
                  <td className="px-4 py-3 text-muted-foreground">{t.propertyName || "-"}</td>
                  <td className="px-4 py-3 text-muted-foreground">
                    {t.bedNumber ? `${t.roomNumber || ""}-${t.bedNumber}` : "Unassigned"}
                  </td>
                  <td className="px-4 py-3">
                    <Badge className={STATUS_COLORS[t.status] ?? "bg-gray-100 text-gray-800"} variant="secondary">
                      {t.status}
                    </Badge>
                  </td>
                  <td className="px-4 py-3 text-muted-foreground">
                    {new Date(t.joiningDate).toLocaleDateString("en-IN")}
                  </td>
                  <td className="px-4 py-3">
                    <Link href={`/dashboard/tenants/${t.id}`}>
                      <Button variant="outline" size="sm">View <ExternalLink className="ml-1.5 h-3 w-3" /></Button>
                    </Link>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <div className="rounded-xl border border-dashed p-12 text-center">
          <Users className="mx-auto h-10 w-10 text-muted-foreground/30" />
          <p className="mt-3 text-sm font-medium text-muted-foreground">No tenants found</p>
        </div>
      )}
    </div>
  );
}
