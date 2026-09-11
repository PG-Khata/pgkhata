"use client";

import { useState } from "react";
import Link from "next/link";
import { useAdminOwners } from "@/hooks/use-admin-owners";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { Search, Users, ExternalLink } from "lucide-react";

export default function OwnersPage() {
  const { data: owners, isLoading } = useAdminOwners();
  const [search, setSearch] = useState("");

  const filtered = (owners ?? []).filter((o) => {
    const q = search.toLowerCase();
    return (
      (o.name ?? "").toLowerCase().includes(q) ||
      (o.email ?? "").toLowerCase().includes(q) ||
      (o.phone ?? "").includes(q)
    );
  });

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-lg font-semibold tracking-tight">Owners</h1>
        <p className="mt-0.5 text-sm text-muted-foreground">
          All registered PG owners on the platform.
        </p>
      </div>

      <div className="relative">
        <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
        <Input
          placeholder="Search by name, email, or phone..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="pl-9"
        />
      </div>

      {isLoading ? (
        <div className="space-y-2">
          {Array.from({ length: 6 }).map((_, i) => (
            <Skeleton key={i} className="h-16 w-full rounded-xl" />
          ))}
        </div>
      ) : filtered.length > 0 ? (
        <div className="rounded-xl border bg-card shadow-xs">
          <div className="hidden sm:block overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b bg-muted/50 text-left text-xs text-muted-foreground">
                  <th className="px-4 py-3 font-medium">OWNER</th>
                  <th className="px-4 py-3 font-medium">EMAIL</th>
                  <th className="px-4 py-3 font-medium">PHONE</th>
                  <th className="px-4 py-3 font-medium">JOINED</th>
                  <th className="px-4 py-3 font-medium"></th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((o) => (
                  <tr key={o.id} className="border-b last:border-0 hover:bg-muted/30">
                    <td className="px-4 py-3 font-medium">{o.name}</td>
                    <td className="px-4 py-3 text-muted-foreground">{o.email}</td>
                    <td className="px-4 py-3 text-muted-foreground font-mono">{o.phone || "-"}</td>
                    <td className="px-4 py-3 text-muted-foreground">
                      {new Date(o.createdAt).toLocaleDateString("en-IN")}
                    </td>
                    <td className="px-4 py-3">
                      <Link href={`/dashboard/owners/${o.id}`}>
                        <Button variant="outline" size="sm">
                          View
                          <ExternalLink className="ml-1.5 h-3 w-3" />
                        </Button>
                      </Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {/* Mobile cards */}
          <div className="sm:hidden divide-y">
            {filtered.map((o) => (
              <div key={o.id} className="p-4 space-y-2">
                <div className="flex items-center justify-between">
                  <p className="font-medium">{o.name}</p>
                  <Link href={`/dashboard/owners/${o.id}`}>
                    <Button variant="outline" size="sm">View</Button>
                  </Link>
                </div>
                <p className="text-sm text-muted-foreground">{o.email}</p>
                <p className="text-sm text-muted-foreground font-mono">{o.phone || "-"}</p>
              </div>
            ))}
          </div>
        </div>
      ) : (
        <div className="rounded-xl border border-dashed p-12 text-center">
          <Users className="mx-auto h-10 w-10 text-muted-foreground/30" />
          <p className="mt-3 text-sm font-medium text-muted-foreground">No owners found</p>
        </div>
      )}
    </div>
  );
}
