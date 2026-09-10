"use client";

import { useState } from "react";
import Link from "next/link";
import { useAdminBills } from "@/hooks/use-admin-billing";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import { Receipt, ExternalLink, Search } from "lucide-react";

const STATUS_COLORS: Record<string, string> = {
  paid: "bg-green-100 text-green-800",
  pending: "bg-yellow-100 text-yellow-800",
  partial: "bg-blue-100 text-blue-800",
  overdue: "bg-red-100 text-red-800",
};

function formatINR(amount: number) {
  return `₹${(amount / 100).toLocaleString("en-IN")}`;
}

export default function BillingPage() {
  const { data: bills, isLoading } = useAdminBills();
  const [search, setSearch] = useState("");

  const filtered = (bills ?? []).filter((b) => {
    const q = search.toLowerCase();
    return (
      (b.tenantName ?? "").toLowerCase().includes(q) ||
      (b.propertyName ?? "").toLowerCase().includes(q) ||
      b.billMonth.includes(q)
    );
  });

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-lg font-semibold tracking-tight">Billing</h1>
        <p className="mt-0.5 text-sm text-muted-foreground">All bills across all properties.</p>
      </div>

      <div className="relative">
        <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
        <Input placeholder="Search by tenant, property, or month..." value={search} onChange={(e) => setSearch(e.target.value)} className="pl-9" />
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
                <th className="px-4 py-3 font-medium">MONTH</th>
                <th className="px-4 py-3 font-medium">TOTAL</th>
                <th className="px-4 py-3 font-medium">PAID</th>
                <th className="px-4 py-3 font-medium">BALANCE</th>
                <th className="px-4 py-3 font-medium">STATUS</th>
                <th className="px-4 py-3 font-medium"></th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((b) => (
                <tr key={b.id} className="border-b last:border-0 hover:bg-muted/30">
                  <td className="px-4 py-3">
                    <p className="font-medium">{b.tenantName || "-"}</p>
                    <p className="text-xs text-muted-foreground">{b.propertyName || ""}</p>
                  </td>
                  <td className="px-4 py-3 font-mono text-muted-foreground">{b.billMonth}</td>
                  <td className="px-4 py-3 font-mono">{formatINR(b.totalAmount)}</td>
                  <td className="px-4 py-3 font-mono text-green-700">{formatINR(b.paidAmount)}</td>
                  <td className="px-4 py-3 font-mono">{formatINR(b.balance)}</td>
                  <td className="px-4 py-3">
                    <Badge className={STATUS_COLORS[b.status] ?? "bg-gray-100 text-gray-800"} variant="secondary">
                      {b.voidedAt ? "voided" : b.status}
                    </Badge>
                  </td>
                  <td className="px-4 py-3">
                    <Link href={`/dashboard/billing/${b.id}`}>
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
          <Receipt className="mx-auto h-10 w-10 text-muted-foreground/30" />
          <p className="mt-3 text-sm font-medium text-muted-foreground">No bills found</p>
        </div>
      )}
    </div>
  );
}
