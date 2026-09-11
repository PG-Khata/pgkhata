"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { ChevronDown, ChevronRight, CircleCheck, TriangleAlert } from "lucide-react";
import {
  useFailedDeliveries,
  FAILURE_SAMPLE_SIZE,
  type DeliveryFilters,
  type DeliveryRow,
} from "@/hooks/use-admin-comms";
import { groupFailures, NO_ERROR_TEXT, type FailureGroup } from "./failure-groups";
import {
  ChannelPill,
  LoadError,
  Panel,
  PanelSkeleton,
  formatCount,
  formatRelative,
  formatTimestamp,
} from "./comms-ui";
import { cn } from "@/lib/utils";

type Filters = Omit<DeliveryFilters, "status" | "page" | "pageSize">;

/**
 * The failures feed, grouped by error.
 *
 * This is the front page of the console because it answers the only question
 * that gets asked in anger: did the message actually go out. A systemic Meta
 * template rejection is one incident that hit 400 recipients, and it reads as
 * one row of 400 — scrolling past 400 identical rows is how a single fixable
 * cause gets mistaken for background noise.
 */
export function FailuresPanel({ filters }: { filters: Filters }) {
  const { data, isLoading, isFetching, isError, error, dataUpdatedAt } =
    useFailedDeliveries(filters);
  const [expanded, setExpanded] = useState<Record<string, boolean>>({});

  const rows = useMemo(() => data?.rows ?? [], [data]);
  const groups = useMemo(() => groupFailures(rows), [rows]);

  // `dataUpdatedAt` is the clock: reading `Date.now()` during render is impure
  // and would make two renders disagree about how long ago something broke.
  const asOf = dataUpdatedAt;

  // `/deliveries` uses `sendPage`, not `sendPageWithTotal`, so there is no
  // `X-Total-Count` to report — `X-Has-More` is the only thing we can prove,
  // and the caption claims nothing beyond it.
  const truncated = data?.hasMore ?? false;
  const sampleCap = data?.pageSize ?? FAILURE_SAMPLE_SIZE;

  function toggle(pattern: string) {
    setExpanded((prev) => ({ ...prev, [pattern]: !prev[pattern] }));
  }

  return (
    <Panel
      title="Failures, grouped by error"
      description={
        truncated ? (
          <>
            Grouped across the {formatCount(sampleCap)} most recent failures. There are more
            beyond this page, and the endpoint sends no total — so these counts describe the
            sample, not the window. Narrow the filters to see the rest.
          </>
        ) : (
          <>
            Grouped across all {formatCount(rows.length)} failures matching these filters.
          </>
        )
      }
    >
      {isLoading ? (
        <PanelSkeleton />
      ) : isError ? (
        <LoadError endpoint="GET /v1/admin/deliveries?status=failed" error={error} />
      ) : groups.length === 0 ? (
        <div className="rounded-lg border border-dashed px-3 py-10 text-center">
          <CircleCheck className="mx-auto h-8 w-8 text-emerald-600/50" />
          <p className="mt-2 text-sm font-medium">No failed deliveries in this window</p>
          <p className="mt-1 text-xs text-muted-foreground">
            The deliveries endpoint answered and returned nothing failed — this is a real zero.
          </p>
        </div>
      ) : (
        <ul
          className={cn("space-y-2", isFetching && "opacity-60 transition-opacity")}
          aria-busy={isFetching}
        >
          {groups.map((group) => (
            <FailureGroupRow
              key={group.pattern}
              group={group}
              asOf={asOf}
              open={!!expanded[group.pattern]}
              onToggle={() => toggle(group.pattern)}
            />
          ))}
        </ul>
      )}
    </Panel>
  );
}

function FailureGroupRow({
  group,
  asOf,
  open,
  onToggle,
}: {
  group: FailureGroup;
  asOf: number;
  open: boolean;
  onToggle: () => void;
}) {
  const channels = Object.entries(group.channels);
  const panelId = `failure-instances-${encodeURIComponent(group.pattern).slice(0, 60)}`;

  return (
    <li className="overflow-hidden rounded-lg border">
      <button
        type="button"
        onClick={onToggle}
        aria-expanded={open}
        aria-controls={panelId}
        className="flex w-full items-start gap-3 px-3 py-3 text-left transition-colors hover:bg-muted/50"
      >
        <span className="mt-0.5 shrink-0 text-muted-foreground">
          {open ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
        </span>

        <span className="shrink-0 rounded-lg bg-red-100 px-2 py-1 text-sm font-semibold tabular-nums text-red-900 dark:bg-red-500/15 dark:text-red-300">
          {formatCount(group.count)}
        </span>

        <span className="min-w-0 flex-1">
          <span className="flex items-start gap-1.5">
            <TriangleAlert className="mt-0.5 h-3.5 w-3.5 shrink-0 text-red-600" />
            <span
              className={cn(
                "text-sm font-medium",
                group.pattern === NO_ERROR_TEXT && "italic text-muted-foreground",
              )}
            >
              {group.pattern}
            </span>
          </span>

          <span className="mt-1.5 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted-foreground">
            {channels.map(([channel, count]) => (
              <span key={channel} className="inline-flex items-center gap-1">
                <ChannelPill channel={channel} />
                {formatCount(count)}
              </span>
            ))}
            {group.templates.length > 0 ? (
              <span className="font-mono">{group.templates.join(", ")}</span>
            ) : null}
            {group.kinds.length > 0 ? <span>{group.kinds.join(", ")}</span> : null}
            <span>last {formatRelative(group.lastAt, asOf)}</span>
            {group.count > 1 ? <span>first {formatRelative(group.firstAt, asOf)}</span> : null}
          </span>
        </span>
      </button>

      {open ? (
        <div id={panelId} className="border-t bg-muted/20 px-3 py-3">
          {/* The redacted heading is for grouping; this is what the provider
              literally said, kept so nobody debugs against a placeholder. */}
          {group.sample && group.sample !== group.pattern ? (
            <p className="mb-3 rounded-md bg-background px-2 py-1.5 font-mono text-xs break-words text-muted-foreground">
              {group.sample}
            </p>
          ) : null}

          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead>
                <tr className="border-b text-left text-muted-foreground">
                  <th className="py-1.5 pr-3 font-medium">Time</th>
                  <th className="py-1.5 pr-3 font-medium">Recipient</th>
                  <th className="py-1.5 pr-3 font-medium">Owner</th>
                  <th className="py-1.5 pr-3 font-medium">Kind</th>
                  <th className="py-1.5 pr-3 font-medium">Provider</th>
                  <th className="py-1.5 font-medium">Linked to</th>
                </tr>
              </thead>
              <tbody>
                {group.rows.map((row) => (
                  <tr key={row.id} className="border-b last:border-0">
                    <td className="py-1.5 pr-3 whitespace-nowrap text-muted-foreground">
                      {formatTimestamp(row.createdAt)}
                    </td>
                    <td className="py-1.5 pr-3 font-mono break-all">{row.recipient}</td>
                    <td className="py-1.5 pr-3 text-muted-foreground">
                      {/* Null owner is a platform message — an OTP or a
                          password reset, which belongs to nobody. */}
                      {row.ownerName ?? (row.ownerId ? row.ownerId.slice(0, 8) : "Platform")}
                    </td>
                    <td className="py-1.5 pr-3">{row.kind}</td>
                    <td className="py-1.5 pr-3 text-muted-foreground">
                      {row.provider ?? "—"}
                      {row.providerMessageId ? (
                        <span className="ml-1 font-mono opacity-60">
                          {row.providerMessageId.slice(0, 10)}
                        </span>
                      ) : null}
                    </td>
                    <td className="py-1.5">
                      <EntityLinks row={row} />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      ) : null}
    </li>
  );
}

/**
 * The row carries the ids of whatever the message was about, which is the
 * fastest route from "this failed" to "this is the bill the tenant never got".
 */
export function EntityLinks({ row }: { row: DeliveryRow }) {
  const links: Array<{ href: string; label: string }> = [];
  if (row.ownerId) links.push({ href: `/dashboard/owners/${row.ownerId}`, label: "Owner" });
  if (row.propertyId) links.push({ href: `/dashboard/properties/${row.propertyId}`, label: "Property" });
  if (row.tenantId) links.push({ href: `/dashboard/tenants/${row.tenantId}`, label: "Tenant" });
  if (row.billId) links.push({ href: `/dashboard/billing/${row.billId}`, label: "Bill" });

  if (links.length === 0) return <span className="text-muted-foreground">—</span>;

  return (
    <span className="flex flex-wrap gap-2">
      {links.map((link) => (
        <Link key={link.href} href={link.href} className="text-primary hover:underline">
          {link.label}
        </Link>
      ))}
    </span>
  );
}
