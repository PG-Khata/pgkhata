"use client";

import Link from "next/link";
import { Inbox } from "lucide-react";
import { useDeliveries, type DeliveryFilters } from "@/hooks/use-admin-comms";
import { AdminPagination } from "@/components/admin-pagination";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  ChannelPill,
  LoadError,
  Panel,
  PanelSkeleton,
  StatusPill,
  formatCount,
  formatTimestamp,
} from "./comms-ui";
import { EntityLinks } from "./failures-panel";

/**
 * The raw feed. Secondary to the grouped failures above it: this is where you
 * go once you know *which* message you are looking for, not to find out that
 * something is wrong.
 */
export function DeliveriesPanel({
  filters,
  page,
  onPageChange,
}: {
  filters: DeliveryFilters;
  page: number;
  onPageChange: (page: number) => void;
}) {
  const { data, isLoading, isFetching, isError, error } = useDeliveries(filters);
  const rows = data?.rows ?? [];

  return (
    <div className="space-y-3">
      <Panel
        title="All deliveries"
        description="Every attempt the platform made, newest first, whatever the outcome."
      >
        {isLoading ? (
          <PanelSkeleton rows={8} />
        ) : isError ? (
          <LoadError endpoint="GET /v1/admin/deliveries" error={error} />
        ) : rows.length === 0 ? (
          <div className="rounded-lg border border-dashed px-3 py-10 text-center">
            <Inbox className="mx-auto h-8 w-8 text-muted-foreground/30" />
            <p className="mt-2 text-sm font-medium text-muted-foreground">
              No deliveries match these filters
            </p>
          </div>
        ) : (
          <div
            className={`overflow-hidden rounded-lg border${isFetching ? " opacity-60 transition-opacity" : ""}`}
          >
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Time</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Channel</TableHead>
                  <TableHead>Kind</TableHead>
                  <TableHead>Recipient</TableHead>
                  <TableHead>Owner</TableHead>
                  <TableHead>Template</TableHead>
                  <TableHead className="text-right">Cost</TableHead>
                  <TableHead>Linked to</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {rows.map((row) => (
                  <TableRow key={row.id}>
                    <TableCell className="whitespace-nowrap text-muted-foreground">
                      {formatTimestamp(row.createdAt)}
                    </TableCell>
                    <TableCell>
                      <StatusPill status={row.status} />
                      {row.status === "failed" && row.error ? (
                        <span
                          className="ml-1.5 text-xs text-muted-foreground"
                          title={row.error}
                        >
                          {row.error.length > 40 ? `${row.error.slice(0, 40)}…` : row.error}
                        </span>
                      ) : null}
                    </TableCell>
                    <TableCell>
                      <ChannelPill channel={row.channel} />
                    </TableCell>
                    <TableCell className="text-muted-foreground">{row.kind}</TableCell>
                    <TableCell className="font-mono text-xs break-all">{row.recipient}</TableCell>
                    <TableCell className="text-muted-foreground">
                      {row.ownerId ? (
                        <Link
                          href={`/dashboard/owners/${row.ownerId}`}
                          className="text-primary hover:underline"
                        >
                          {row.ownerName ?? row.ownerId.slice(0, 8)}
                        </Link>
                      ) : (
                        // No owner is correct for an OTP or password reset.
                        "Platform"
                      )}
                    </TableCell>
                    <TableCell className="font-mono text-xs">{row.template ?? "—"}</TableCell>
                    <TableCell className="text-right font-mono tabular-nums">
                      {formatCount(row.costUnits)}
                    </TableCell>
                    <TableCell className="text-xs">
                      <EntityLinks row={row} />
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        )}
      </Panel>

      <AdminPagination
        page={data}
        currentPage={page}
        onPageChange={onPageChange}
        isFetching={isFetching}
        noun="deliveries"
      />
    </div>
  );
}
