"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { useAdminOwnerDetails } from "@/hooks/use-admin-details";
import { EmptyNote, Panel } from "./owner-ui";

const STATUS_VARIANTS: Record<string, "default" | "secondary" | "outline" | "destructive"> = {
  active: "default",
  pending: "secondary",
  inactive: "outline",
  vacated: "outline",
  rejected: "destructive",
};

/**
 * A filter box rather than a paginated list: on a call the agent already knows
 * roughly who they are looking for and needs the row in one keystroke, not a
 * page control. Only the fields an agent reads back are shown — no government
 * ID surfaces here at all.
 */
export function OwnerTenantsTab({ ownerId }: { ownerId: string }) {
  const { data, isLoading } = useAdminOwnerDetails(ownerId);
  const [filter, setFilter] = useState("");

  const tenants = useMemo(() => data?.tenants ?? [], [data]);
  const visible = useMemo(() => {
    const needle = filter.trim().toLowerCase();
    if (!needle) return tenants;
    return tenants.filter((tenant) =>
      [tenant.name, tenant.phone, tenant.propertyName]
        .filter(Boolean)
        .some((field) => String(field).toLowerCase().includes(needle)),
    );
  }, [tenants, filter]);

  return (
    <Panel
      title={`Tenants${tenants.length ? ` (${tenants.length})` : ""}`}
      action={
        tenants.length > 0 ? (
          <Input
            value={filter}
            onChange={(event) => setFilter(event.target.value)}
            placeholder="Filter by name, phone, property"
            aria-label="Filter tenants"
            className="w-48 sm:w-64"
          />
        ) : null
      }
    >
      {isLoading ? (
        <div className="space-y-2">
          <Skeleton className="h-9 w-full" />
          <Skeleton className="h-9 w-full" />
          <Skeleton className="h-9 w-full" />
        </div>
      ) : tenants.length === 0 ? (
        <EmptyNote>No tenants on this account yet.</EmptyNote>
      ) : visible.length === 0 ? (
        <EmptyNote>No tenant matches “{filter.trim()}”.</EmptyNote>
      ) : (
        <div className="overflow-x-auto rounded-lg border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Tenant</TableHead>
                <TableHead>Property</TableHead>
                <TableHead>Status</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {visible.map((tenant) => (
                <TableRow key={tenant.id}>
                  <TableCell>
                    <Link
                      href={`/dashboard/tenants/${tenant.id}`}
                      className="font-medium hover:underline"
                    >
                      {tenant.name}
                    </Link>
                    <p className="font-mono text-xs text-muted-foreground">{tenant.phone}</p>
                  </TableCell>
                  <TableCell className="text-muted-foreground">
                    {tenant.propertyName || "—"}
                  </TableCell>
                  <TableCell>
                    <Badge variant={STATUS_VARIANTS[tenant.status] ?? "outline"}>
                      {tenant.status}
                    </Badge>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}
    </Panel>
  );
}
