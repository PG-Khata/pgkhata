"use client";

import { useState } from "react";
import Link from "next/link";
import { useAdminProperties } from "@/hooks/use-admin-properties";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import { Building2, ExternalLink, Search } from "lucide-react";

export default function PropertiesPage() {
  const { data: properties, isLoading } = useAdminProperties();
  const [search, setSearch] = useState("");

  const filtered = (properties ?? []).filter((p) => {
    const q = search.toLowerCase();
    return (
      p.name.toLowerCase().includes(q) ||
      (p.city ?? "").toLowerCase().includes(q) ||
      (p.ownerName ?? "").toLowerCase().includes(q)
    );
  });

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-lg font-semibold tracking-tight">Properties</h1>
        <p className="mt-0.5 text-sm text-muted-foreground">All properties across all owners.</p>
      </div>

      <div className="relative">
        <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
        <Input placeholder="Search by name, city, or owner..." value={search} onChange={(e) => setSearch(e.target.value)} className="pl-9" />
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
                <th className="px-4 py-3 font-medium">PROPERTY</th>
                <th className="px-4 py-3 font-medium">OWNER</th>
                <th className="px-4 py-3 font-medium">LOCATION</th>
                <th className="px-4 py-3 font-medium">BEDS</th>
                <th className="px-4 py-3 font-medium">TENANTS</th>
                <th className="px-4 py-3 font-medium"></th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((p) => (
                <tr key={p.id} className="border-b last:border-0 hover:bg-muted/30">
                  <td className="px-4 py-3 font-medium">{p.name}</td>
                  <td className="px-4 py-3 text-muted-foreground">{p.ownerName || "-"}</td>
                  <td className="px-4 py-3 text-muted-foreground">{p.city || p.address || "-"}</td>
                  <td className="px-4 py-3">
                    <Badge variant="outline">{p.occupiedBeds ?? 0}/{p.totalBeds ?? 0}</Badge>
                  </td>
                  <td className="px-4 py-3 text-muted-foreground">{p.activeTenants ?? 0}</td>
                  <td className="px-4 py-3">
                    <Link href={`/dashboard/properties/${p.id}`}>
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
          <Building2 className="mx-auto h-10 w-10 text-muted-foreground/30" />
          <p className="mt-3 text-sm font-medium text-muted-foreground">No properties found</p>
        </div>
      )}
    </div>
  );
}
